import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Users as UsersIcon, Settings as SettingsIcon, Building2 } from "lucide-react";

export const Route = createFileRoute("/camed")({ component: CamedPage });

function CamedPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [isPresident, setIsPresident] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!profile?.email) return;
    supabase.from("camed_presidents").select("id").ilike("email", profile.email).maybeSingle()
      .then(({ data }) => setIsPresident(!!data));
  }, [loading, user, profile]);

  if (loading || isPresident === null) return <div className="p-12 text-center">Carregando...</div>;
  if (!isPresident) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-2xl font-black">Acesso negado</h1>
      <p className="text-muted-foreground mt-2">Apenas presidentes do CAMED têm acesso a esta área.</p>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Início</Link>
          <Badge className="bg-gradient-to-r from-primary to-accent"><Building2 className="size-3 mr-1" /> CAMED</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do CAMED</h1>
        <p className="text-muted-foreground mb-6">Gerencie informações, membros e configurações de ligas.</p>
        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="info"><SettingsIcon className="size-4 mr-1.5" />Informações</TabsTrigger>
            <TabsTrigger value="membros"><UsersIcon className="size-4 mr-1.5" />Membros</TabsTrigger>
            <TabsTrigger value="ligas"><Building2 className="size-4 mr-1.5" />Ligas</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-6"><InfoTab /></TabsContent>
          <TabsContent value="membros" className="mt-6"><MembersTab /></TabsContent>
          <TabsContent value="ligas" className="mt-6"><LeaguesSettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function InfoTab() {
  const [info, setInfo] = useState<any>({ title: "", subtitle: "", description: "" });
  useEffect(() => { supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => data && setInfo(data)); }, []);
  async function save() {
    const { error } = await supabase.from("camed_info").update({ title: info.title, subtitle: info.subtitle, description: info.description }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Informações atualizadas");
  }
  return (
    <Card><CardHeader><CardTitle>Informações do CAMED</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Título</Label><Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></div>
        <div><Label>Subtítulo</Label><Input value={info.subtitle} onChange={(e) => setInfo({ ...info, subtitle: e.target.value })} /></div>
        <div><Label>Descrição</Label><Textarea rows={6} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
        <Button onClick={save}>Salvar</Button>
      </CardContent>
    </Card>
  );
}

function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = { name: "", role: "", description: "", image_url: "", display_order: 0 };
  const [f, setF] = useState<any>(blank);
  async function reload() {
    const { data } = await supabase.from("camed_members").select("*").order("display_order");
    setMembers(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(m: any) { setEditing(m); setF({ ...m, image_url: m.image_url ?? "", description: m.description ?? "" }); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, image_url: f.image_url || null };
    const { error } = editing
      ? await supabase.from("camed_members").update(payload).eq("id", editing.id)
      : await supabase.from("camed_members").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir membro?")) return;
    const { error } = await supabase.from("camed_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Membros</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">
                  {m.image_url && <img src={m.image_url} className="w-full h-full object-cover" />}
                </div>
                <Badge variant="secondary">{m.role}</Badge>
                <h4 className="font-black mt-2">{m.name}</h4>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}><Edit className="size-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(m.id)}><Trash2 className="size-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar membro" : "Novo membro"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
            <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LeaguesSettingsTab() {
  const [s, setS] = useState({ league_registration_fee: 0, semestrality_fee: 0 });
  useEffect(() => {
    supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS({ league_registration_fee: Number((data as any).league_registration_fee) || 0, semestrality_fee: Number((data as any).semestrality_fee) || 0 });
    });
  }, []);
  async function save() {
    const { error } = await supabase.from("camed_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  }
  return (
    <Card>
      <CardHeader><CardTitle>Valores padrão das ligas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Taxa de inscrição na prova de seleção (R$)</Label>
          <Input type="number" step="0.01" min="0" value={s.league_registration_fee} onChange={(e) => setS({ ...s, league_registration_fee: +e.target.value })} />
          <p className="text-xs text-muted-foreground mt-1">Valor cobrado de todo candidato que se inscreve na prova de uma liga. Aplica-se a todas as ligas e atualiza automaticamente.</p>
        </div>
        <div>
          <Label>Semestralidade padrão (R$)</Label>
          <Input type="number" step="0.01" min="0" value={s.semestrality_fee} onChange={(e) => setS({ ...s, semestrality_fee: +e.target.value })} />
          <p className="text-xs text-muted-foreground mt-1">Valor de referência da semestralidade do ligante. (Sem cobrança automática por enquanto.)</p>
        </div>
        <Button onClick={save}>Salvar</Button>
      </CardContent>
    </Card>
  );
}
