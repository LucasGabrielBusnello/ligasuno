import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, IFMSA_TAB_LABELS, ALL_IFMSA_TABS_LIST, type IfmsaTab } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Globe2,
  KeyRound,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/ifmsa-painel")({ component: IfmsaPanelPage });

function IfmsaPanelPage() {
  const { user, ifmsaPanelTabs, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth" });
  }, [loading, user]);

  if (loading) return <div className="p-12 text-center">Carregando...</div>;

  const visible = ifmsaPanelTabs;
  if (visible.length === 0)
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <h1 className="text-2xl font-black">Acesso negado</h1>
        <p className="text-muted-foreground mt-2">Apenas pessoas autorizadas acessam o Painel do IFMSA.</p>
        <Button asChild className="mt-4">
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    );

  const tabDefs: { key: IfmsaTab; icon: React.ReactNode }[] = [
    { key: "info", icon: <SettingsIcon className="size-4 mr-1.5" /> },
    { key: "setores", icon: <Layers className="size-4 mr-1.5" /> },
    { key: "diretoria", icon: <UsersIcon className="size-4 mr-1.5" /> },
    { key: "intercambio", icon: <Globe2 className="size-4 mr-1.5" /> },
  ];
  const shown = tabDefs.filter((t) => visible.includes(t.key));

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Início
          </Link>
          <Badge className="bg-gradient-to-r from-emerald-600 to-sky-600">IFMSA</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do IFMSA</h1>
        <p className="text-muted-foreground mb-6">Gerencie a página pública, comitês, diretoria e depoimentos.</p>
        <Tabs defaultValue={shown[0]?.key ?? "info"}>
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1">
            {shown.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="py-2 flex-1 min-w-[7.5rem] whitespace-nowrap">
                {t.icon}
                {IFMSA_TAB_LABELS[t.key]}
              </TabsTrigger>
            ))}
          </TabsList>
          {visible.includes("info") && (
            <TabsContent value="info" className="mt-6">
              <InfoTab canManageAccess={isAdminMaster} />
            </TabsContent>
          )}
          {visible.includes("setores") && (
            <TabsContent value="setores" className="mt-6">
              <SectorsTab />
            </TabsContent>
          )}
          {visible.includes("diretoria") && (
            <TabsContent value="diretoria" className="mt-6">
              <MembersTab />
            </TabsContent>
          )}
          {visible.includes("intercambio") && (
            <TabsContent value="intercambio" className="mt-6">
              <TestimonialsTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- INFO ---------------- */
function InfoTab({ canManageAccess }: { canManageAccess: boolean }) {
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    (supabase as any).from("ifmsa_info").select("*").eq("id", 1).maybeSingle().then(({ data }: any) => setForm(data ?? { id: 1 }));
  }, []);
  async function save() {
    const { error } = await (supabase as any)
      .from("ifmsa_info")
      .upsert({ ...form, id: 1, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Informações salvas");
  }
  if (!form) return null;
  const set = (k: string) => (v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Página pública</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title")(e.target.value)} />
          </div>
          <div>
            <Label>Subtítulo</Label>
            <Input value={form.subtitle ?? ""} onChange={(e) => set("subtitle")(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={5} value={form.description ?? ""} onChange={(e) => set("description")(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ImageUpload label="Logo" folder="ifmsa" value={form.logo_url ?? ""} onChange={set("logo_url")} />
            <ImageUpload label="Imagem de fundo do topo" folder="ifmsa" value={form.hero_image_url ?? ""} onChange={set("hero_image_url")} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Instagram (URL)</Label>
              <Input value={form.instagram_url ?? ""} onChange={(e) => set("instagram_url")(e.target.value)} />
            </div>
            <div>
              <Label>Grupo WhatsApp (URL)</Label>
              <Input value={form.whatsapp_url ?? ""} onChange={(e) => set("whatsapp_url")(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cartilha do Calouro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Chamada</Label>
            <Input value={form.cartilha_cta ?? ""} onChange={(e) => set("cartilha_cta")(e.target.value)} />
          </div>
          <div>
            <Label>Nome do arquivo exibido</Label>
            <Input value={form.cartilha_title ?? ""} onChange={(e) => set("cartilha_title")(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.cartilha_description ?? ""} onChange={(e) => set("cartilha_description")(e.target.value)} />
          </div>
          <div>
            <Label>Link do PDF</Label>
            <Input value={form.cartilha_url ?? ""} onChange={(e) => set("cartilha_url")(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Deixe em branco para esconder o bloco da cartilha.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save}>Salvar alterações</Button>

      {canManageAccess && <PanelAccessSection />}
    </div>
  );
}

function PanelAccessSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<IfmsaTab[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function reload() {
    const { data } = await (supabase as any).from("ifmsa_panel_access").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    reload();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const target = (editing?.email ?? email).trim();
    if (!target) return toast.error("Informe o e-mail");
    if (perms.length === 0) return toast.error("Selecione ao menos uma aba");
    const { error } = await (supabase as any)
      .from("ifmsa_panel_access")
      .upsert({ email: target, permissions: perms, updated_at: new Date().toISOString() }, { onConflict: "email" });
    if (error) return toast.error(error.message);
    toast.success(editing ? "Permissões atualizadas" : "Acesso concedido");
    setEmail("");
    setPerms([]);
    setEditing(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Revogar acesso ao painel?")) return;
    const { error } = await (supabase as any).from("ifmsa_panel_access").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-emerald-600" /> Acesso ao Painel do IFMSA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Conceda acesso parcial para pessoas registradas no site. Elas verão apenas as abas selecionadas.
        </p>
        <form onSubmit={save} className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <div>
            <Label>E-mail cadastrado no site</Label>
            <Input
              type="email"
              required
              disabled={!!editing}
              value={editing?.email ?? email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.com"
            />
          </div>
          <div>
            <Label>Abas liberadas</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {ALL_IFMSA_TABS_LIST.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm p-2 rounded border bg-background cursor-pointer">
                  <Checkbox
                    checked={perms.includes(k)}
                    onCheckedChange={() => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                  />
                  {IFMSA_TAB_LABELS[k]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{editing ? "Salvar alterações" : "Conceder acesso"}</Button>
            {editing && (
              <Button type="button" variant="ghost" onClick={() => { setEditing(null); setEmail(""); setPerms([]); }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-xs text-muted-foreground italic">Ninguém adicionado ainda.</p>}
          {rows.map((r) => (
            <div key={r.id} className="p-3 rounded border flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold truncate">{r.email}</div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {(r.permissions ?? []).map((k: string) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {IFMSA_TAB_LABELS[k as IfmsaTab] ?? k}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(r);
                    setPerms((r.permissions ?? []).filter((k: string): k is IfmsaTab =>
                      (ALL_IFMSA_TABS_LIST as readonly string[]).includes(k)
                    ));
                  }}
                >
                  <Edit className="size-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- SETORES ---------------- */
const EMPTY_SECTOR = {
  code: "",
  name: "",
  full_name: "",
  short_description: "",
  description: "",
  color: "#0a8f4a",
  emoji: "🐾",
  image_url: "",
  links: [] as { label: string; url: string }[],
  highlights: [] as string[],
  is_exchange: false,
  published: true,
  display_order: 0,
};

function SectorsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function reload() {
    const { data } = await (supabase as any).from("ifmsa_sectors").select("*").order("display_order");
    setRows(data ?? []);
  }
  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!editing.code?.trim() || !editing.name?.trim()) return toast.error("Sigla e nome são obrigatórios");
    const payload = {
      code: editing.code.trim(),
      name: editing.name.trim(),
      full_name: editing.full_name || null,
      short_description: editing.short_description || null,
      description: editing.description || null,
      color: editing.color || "#0a8f4a",
      emoji: editing.emoji || "🐾",
      image_url: editing.image_url || null,
      links: (editing.links ?? []).filter((l: any) => l?.url),
      highlights: (editing.highlights ?? []).filter(Boolean),
      is_exchange: !!editing.is_exchange,
      published: editing.published !== false,
      display_order: Number(editing.display_order) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await (supabase as any).from("ifmsa_sectors").update(payload).eq("id", editing.id)
      : await (supabase as any).from("ifmsa_sectors").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Setor salvo");
    setEditing(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Remover este setor?")) return;
    const { error } = await (supabase as any).from("ifmsa_sectors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Comitês / setores</CardTitle>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_SECTOR, display_order: rows.length + 1 })}>
          <Plus className="size-4 mr-1" /> Novo setor
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((s) => (
          <div key={s.id} className="p-3 rounded-lg border flex items-center gap-3 flex-wrap">
            <span className="text-2xl">{s.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-black truncate">
                {s.name} {s.is_exchange && <Badge className="ml-1 text-[10px] bg-sky-600">intercâmbio</Badge>}
                {!s.published && <Badge variant="outline" className="ml-1 text-[10px]">oculto</Badge>}
              </div>
              <div className="text-xs text-muted-foreground truncate">{s.full_name}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...s, links: s.links ?? [], highlights: s.highlights ?? [] })}>
                <Edit className="size-3" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(s.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum setor cadastrado.</p>}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar setor" : "Novo setor"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sigla (ex.: SCOPE)</Label>
                  <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                </div>
                <div>
                  <Label>Nome exibido</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Nome completo</Label>
                <Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Resumo curto</Label>
                <Input value={editing.short_description ?? ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value })} />
              </div>
              <div>
                <Label>Descrição completa</Label>
                <Textarea rows={7} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Emoji</Label>
                  <Input value={editing.emoji ?? ""} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input type="color" value={editing.color ?? "#0a8f4a"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
                </div>
              </div>
              <ImageUpload label="Imagem" folder="ifmsa" value={editing.image_url ?? ""} onChange={(url) => setEditing({ ...editing, image_url: url })} />
              <div>
                <Label>Destaques (um por linha)</Label>
                <Textarea
                  rows={4}
                  value={(editing.highlights ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, highlights: e.target.value.split("\n") })}
                />
              </div>
              <div>
                <Label>Links (formato: Texto | https://...)</Label>
                <Textarea
                  rows={3}
                  value={(editing.links ?? []).map((l: any) => `${l.label ?? ""} | ${l.url ?? ""}`).join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      links: e.target.value
                        .split("\n")
                        .map((line) => {
                          const [label, url] = line.split("|");
                          return { label: (label ?? "").trim(), url: (url ?? "").trim() };
                        })
                        .filter((l) => l.url),
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!editing.is_exchange} onCheckedChange={(v) => setEditing({ ...editing, is_exchange: !!v })} />
                  É setor de intercâmbio (mostra depoimentos)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.published !== false} onCheckedChange={(v) => setEditing({ ...editing, published: !!v })} />
                  Publicado
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- DIRETORIA ---------------- */
function MembersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function reload() {
    const { data } = await (supabase as any).from("ifmsa_members").select("*").order("display_order");
    setRows(data ?? []);
  }
  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!editing.name?.trim() || !editing.role?.trim()) return toast.error("Nome e cargo são obrigatórios");
    const payload = {
      name: editing.name.trim(),
      role: editing.role.trim(),
      acronym: editing.acronym || null,
      description: editing.description || null,
      image_url: editing.image_url || null,
      sector_code: editing.sector_code || null,
      display_order: Number(editing.display_order) || 0,
    };
    const { error } = editing.id
      ? await (supabase as any).from("ifmsa_members").update(payload).eq("id", editing.id)
      : await (supabase as any).from("ifmsa_members").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Membro salvo");
    setEditing(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Remover membro?")) return;
    const { error } = await (supabase as any).from("ifmsa_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Diretoria</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: "", role: "", display_order: rows.length + 1 })}>
          <Plus className="size-4 mr-1" /> Novo membro
        </Button>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((m) => (
          <div key={m.id} className="rounded-xl border overflow-hidden">
            <div className="aspect-square bg-muted">
              {m.image_url ? (
                <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-4xl">🐱</div>
              )}
            </div>
            <div className="p-3">
              <div className="font-black text-sm leading-tight">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.role}</div>
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                  <Edit className="size-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(m.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum membro cadastrado.</p>}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar membro" : "Novo membro"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  placeholder="Presidente Local"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sigla do cargo</Label>
                  <Input value={editing.acronym ?? ""} onChange={(e) => setEditing({ ...editing, acronym: e.target.value })} placeholder="LP" />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <ImageUpload label="Foto" folder="ifmsa" value={editing.image_url ?? ""} onChange={(url) => setEditing({ ...editing, image_url: url })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- INTERCÂMBIO ---------------- */
function TestimonialsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function reload() {
    const { data } = await (supabase as any).from("ifmsa_testimonials").select("*").order("display_order");
    setRows(data ?? []);
  }
  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!editing.name?.trim() || !editing.quote?.trim()) return toast.error("Nome e depoimento são obrigatórios");
    const payload = {
      name: editing.name.trim(),
      quote: editing.quote.trim(),
      photo_url: editing.photo_url || null,
      location: editing.location || null,
      program: editing.program || null,
      published: editing.published !== false,
      display_order: Number(editing.display_order) || 0,
    };
    const { error } = editing.id
      ? await (supabase as any).from("ifmsa_testimonials").update(payload).eq("id", editing.id)
      : await (supabase as any).from("ifmsa_testimonials").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Depoimento salvo");
    setEditing(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Remover depoimento?")) return;
    const { error } = await (supabase as any).from("ifmsa_testimonials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Depoimentos de intercambistas</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: "", quote: "", display_order: rows.length + 1 })}>
          <Plus className="size-4 mr-1" /> Novo depoimento
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((t) => (
          <div key={t.id} className="p-3 rounded-lg border flex items-start gap-3">
            <div className="size-11 shrink-0 rounded-full overflow-hidden bg-muted grid place-items-center">
              {t.photo_url ? <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" /> : <span>🐱</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-black text-sm">
                {t.name} {!t.published && <Badge variant="outline" className="text-[10px]">oculto</Badge>}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">{t.quote}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                <Edit className="size-3" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(t.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum depoimento cadastrado.</p>}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar depoimento" : "Novo depoimento"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Programa</Label>
                  <Input value={editing.program ?? ""} onChange={(e) => setEditing({ ...editing, program: e.target.value })} placeholder="SCOPE 2026" />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Portugal" />
                </div>
              </div>
              <div>
                <Label>Depoimento</Label>
                <Textarea rows={5} value={editing.quote} onChange={(e) => setEditing({ ...editing, quote: e.target.value })} />
              </div>
              <ImageUpload label="Foto" folder="ifmsa" value={editing.photo_url ?? ""} onChange={(url) => setEditing({ ...editing, photo_url: url })} />
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm p-2">
                  <Checkbox checked={editing.published !== false} onCheckedChange={(v) => setEditing({ ...editing, published: !!v })} />
                  Publicado
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
