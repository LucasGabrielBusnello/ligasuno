import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function assertPresident(admin: any, leagueId: string, userId: string) {
  const { data: l } = await admin.from("leagues").select("president_id, president2_id").eq("id", leagueId).maybeSingle();
  if (!l) throw new Error("Liga não encontrada");
  if (l.president_id !== userId) {
    const { data: r } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
    if (!r) throw new Error("Sem permissão");
  }
}

async function gatewayFetch(path: string, init: RequestInit = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAIL_API_KEY; // same workspace conn handles drive/sheets via gateway alias if linked
  // The user must link Google Sheets separately; we expose dedicated env if present:
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY || connKey;
  if (!lovableKey || !sheetsKey) throw new Error("Integração Google Sheets não configurada (conecte em Configurações).");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": sheetsKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets API ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export const getSheetConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ league_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await assertPresident(admin, data.league_id, context.userId);
    const { data: row } = await admin.from("league_sheets_sync").select("*").eq("league_id", data.league_id).maybeSingle();
    return row ?? null;
  });

export const saveSheetConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    league_id: z.string().uuid(),
    spreadsheet_id: z.string().trim().min(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await assertPresident(admin, data.league_id, context.userId);
    const sid = data.spreadsheet_id.replace(/.*\/d\//, "").split("/")[0];
    await admin.from("league_sheets_sync").upsert({
      league_id: data.league_id, spreadsheet_id: sid,
    }, { onConflict: "league_id" } as any);
    return { ok: true, spreadsheet_id: sid };
  });

export const syncEventToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: ev } = await admin.from("league_events").select("id,title,league_id,event_date").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado");
    await assertPresident(admin, (ev as any).league_id, context.userId);

    const { data: cfg } = await admin.from("league_sheets_sync").select("spreadsheet_id").eq("league_id", (ev as any).league_id).maybeSingle();
    if (!cfg?.spreadsheet_id) throw new Error("Planilha não configurada");
    const sid = cfg.spreadsheet_id;

    const sheetName = `Evento ${String((ev as any).title).slice(0, 60)}`;

    // Ensure sheet exists
    const meta = await gatewayFetch(`/spreadsheets/${sid}`);
    const exists = (meta.sheets || []).some((s: any) => s.properties?.title === sheetName);
    if (!exists) {
      await gatewayFetch(`/spreadsheets/${sid}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
    }

    // Load registrations + checkins
    const { data: regs } = await admin.from("event_registrations")
      .select("id,full_name,cpf,checkin_code,status,category,paid_price,user_id,created_at")
      .eq("event_id", data.event_id).order("full_name");
    const list = regs ?? [];
    const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const pmap: Record<string, any> = {};
    if (uids.length) {
      const { data: profs } = await admin.from("profiles").select("id,email,phone").in("id", uids);
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
    }
    const { data: chks } = await admin.from("event_checkins").select("registration_id,checkin_index").eq("event_id", data.event_id);
    const cmap: Record<string, Set<number>> = {};
    (chks ?? []).forEach((c: any) => { (cmap[c.registration_id] ||= new Set()).add(c.checkin_index); });

    const header = ["Nome", "CPF", "E-mail", "Telefone", "Categoria", "Status", "Valor", "Código", "Credenciamentos", "Inscrito em"];
    const rows = list.map((r: any) => [
      r.full_name || "", r.cpf || "", pmap[r.user_id]?.email || "", pmap[r.user_id]?.phone || "",
      r.category || "", r.status || "", String(r.paid_price ?? ""), r.checkin_code || "",
      Array.from(cmap[r.id] || []).sort().join(","),
      r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "",
    ]);
    const values = [header, ...rows];

    // Clear + write
    await gatewayFetch(`/spreadsheets/${sid}/values/${sheetName}!A1:Z10000:clear`, { method: "POST", body: "{}" });
    await gatewayFetch(`/spreadsheets/${sid}/values/${sheetName}!A1?valueInputOption=RAW`, {
      method: "PUT", body: JSON.stringify({ values }),
    });

    await admin.from("league_sheets_sync").update({
      last_synced_at: new Date().toISOString(), last_error: null,
    }).eq("league_id", (ev as any).league_id);

    return { ok: true, rows: rows.length, sheet: sheetName };
  });
