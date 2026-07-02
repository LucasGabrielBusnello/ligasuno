import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/storage-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = Date.now();
        const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
        const THREE_YEARS = 3 * ONE_YEAR;
        const cashCutoff = new Date(now - ONE_YEAR).toISOString();
        const signCutoff = new Date(now - THREE_YEARS).toISOString();

        let deletedReceipts = 0;
        let deletedSignatures = 0;
        const errors: string[] = [];

        // 1) cash-receipts older than 1 year
        try {
          const { data: leagues } = await supabaseAdmin.storage.from("cash-receipts").list("", { limit: 1000 });
          for (const folder of leagues ?? []) {
            if (!folder.name) continue;
            const { data: files } = await supabaseAdmin.storage.from("cash-receipts").list(folder.name, { limit: 1000 });
            const oldPaths = (files ?? [])
              .filter((f) => f.created_at && f.created_at < cashCutoff)
              .map((f) => `${folder.name}/${f.name}`);
            if (oldPaths.length === 0) continue;
            const { error } = await supabaseAdmin.storage.from("cash-receipts").remove(oldPaths);
            if (error) { errors.push(`cash-receipts: ${error.message}`); continue; }
            deletedReceipts += oldPaths.length;
            // clear references
            await supabaseAdmin.from("league_cash_entries").update({ receipt_url: null }).in("receipt_url", oldPaths);
          }
        } catch (e: any) {
          errors.push(`cash-receipts scan: ${e?.message || String(e)}`);
        }

        // 2) league-signatures orphans older than 3 years (files not referenced by any active template or signature)
        try {
          const { data: refsTpl } = await supabaseAdmin.from("league_certificate_templates").select("template_url");
          const { data: refsSig } = await supabaseAdmin.from("league_president_signatures").select("signature_url");
          const referenced = new Set<string>();
          for (const r of refsTpl ?? []) if (r.template_url) referenced.add(r.template_url as string);
          for (const r of refsSig ?? []) if (r.signature_url) referenced.add(r.signature_url as string);

          const { data: leagues } = await supabaseAdmin.storage.from("league-signatures").list("", { limit: 1000 });
          for (const folder of leagues ?? []) {
            if (!folder.name) continue;
            const { data: files } = await supabaseAdmin.storage.from("league-signatures").list(folder.name, { limit: 1000 });
            const oldPaths = (files ?? [])
              .filter((f) => f.created_at && f.created_at < signCutoff)
              .map((f) => `${folder.name}/${f.name}`)
              .filter((p) => !referenced.has(p));
            if (oldPaths.length === 0) continue;
            const { error } = await supabaseAdmin.storage.from("league-signatures").remove(oldPaths);
            if (error) { errors.push(`league-signatures: ${error.message}`); continue; }
            deletedSignatures += oldPaths.length;
          }
        } catch (e: any) {
          errors.push(`league-signatures scan: ${e?.message || String(e)}`);
        }

        const result = { ok: true, deletedReceipts, deletedSignatures, errors };
        console.log("storage-cleanup", result);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
