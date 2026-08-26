import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Loader2, Sparkles, Volume2, BookOpen } from "lucide-react";
import {
  adminListSimCases, adminSaveSimCase, adminDeleteSimCase, adminGenerateSimCases,
  adminListSimFeedback, adminResolveSimFeedback, adminListSimRules, adminSaveSimRule,
  adminDeleteSimRule, adminSaveSimSound, adminDeleteSimSound,
  adminListSimReferences, adminSaveSimReference, adminDeleteSimReference,
} from "@/lib/sim-admin.functions";

export function SimAdmin() {
  return (
    <Tabs defaultValue="casos">
      <div className="w-full overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
        <TabsList className="inline-flex w-max">
          <TabsTrigger value="casos">Casos clínicos</TabsTrigger>
          <TabsTrigger value="sons">Biblioteca de sons</TabsTrigger>
          <TabsTrigger value="feedback">Feedback dos alunos</TabsTrigger>
          <TabsTrigger value="regras">Regras da IA</TabsTrigger>
          <TabsTrigger value="refs"><BookOpen className="size-4 mr-1.5" />Referências (RAG)</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="casos" className="mt-4"><CasesAdmin /></TabsContent>
      <TabsContent value="sons" className="mt-4"><SoundsAdmin /></TabsContent>
      <TabsContent value="feedback" className="mt-4"><FeedbackAdmin /></TabsContent>
      <TabsContent value="regras" className="mt-4"><RulesAdmin /></TabsContent>
      <TabsContent value="refs" className="mt-4"><ReferencesAdmin /></TabsContent>
    </Tabs>
  );
}


const AREAS = ["Clínica Médica","Cardiologia","Pneumologia","Gastroenterologia","Nefrologia","Endocrinologia","Neurologia","Reumatologia","Infectologia","Hematologia","Dermatologia","Psiquiatria","Pediatria","Ginecologia e Obstetrícia","Cirurgia Geral","Ortopedia","Urologia","Oftalmologia","Otorrinolaringologia","Geriatria","Medicina de Família e Comunidade","Emergência e Medicina Intensiva","Oncologia"];

function CasesAdmin() {
  const list = useServerFn(adminListSimCases);
  const save = useServerFn(adminSaveSimCase);
  const del = useServerFn(adminDeleteSimCase);
  const gen = useServerFn(adminGenerateSimCases);

  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [genArea, setGenArea] = useState(AREAS[0]);
  const [genLevel, setGenLevel] = useState(1);
  const [genCount, setGenCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const reload = () => list().then((r: any) => setRows(r ?? [])).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const r: any = await gen({ data: { area: genArea, level: genLevel, count: genCount } });
      toast.success(`${r.inserted} caso(s) gerado(s).`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar casos."); }
    finally { setBusy(false); }
  };

  const filtered = rows.filter((r) => `${r.title} ${r.area} ${r.diagnosis}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Área</Label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={genArea} onChange={(e) => setGenArea(e.target.value)}>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Nível</Label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={genLevel} onChange={(e) => setGenLevel(Number(e.target.value))}>
              {[1,2,3,4,5,6].map((l) => <option key={l} value={l}>{l}º ano</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Quantos</Label>
            <Input type="number" min={1} max={3} className="w-20" value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} />
          </div>
          <Button onClick={generate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />} Gerar com IA
          </Button>
          <Button variant="outline" onClick={() => setEditing({ level: 1, area: AREAS[0], published: true, patient: {}, triage: {}, findings: [], exams: [] })}>
            <Plus className="size-4 mr-2" /> Novo caso manual
          </Button>
        </CardContent>
      </Card>

      <Input placeholder="Buscar caso..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground truncate">{r.area} · {r.level}º ano · {r.diagnosis}</div>
              </div>
              {!r.published && <Badge variant="secondary">Rascunho</Badge>}
              <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Edit className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={async () => {
                if (!confirm("Excluir este caso?")) return;
                await del({ data: { id: r.id } }); toast.success("Caso excluído."); reload();
              }}><Trash2 className="size-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum caso cadastrado.</p>}
      </div>

      <CaseDialog caso={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} save={save} />
    </div>
  );
}

function CaseDialog({ caso, onClose, onSaved, save }: any) {
  const [f, setF] = useState<any>(caso ?? {});
  useEffect(() => { setF(caso ?? {}); }, [caso]);
  const [saving, setSaving] = useState(false);
  if (!caso) return null;

  const jsonField = (key: string, label: string, rows = 6) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={rows}
        value={typeof f[key] === "string" ? f[key] : JSON.stringify(f[key] ?? (key === "findings" || key === "exams" ? [] : {}), null, 2)}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="font-mono text-xs"
      />
    </div>
  );

  const submit = async () => {
    setSaving(true);
    try {
      const parse = (v: any, fb: any) => {
        if (typeof v !== "string") return v ?? fb;
        try { return JSON.parse(v); } catch { throw new Error("JSON inválido em um dos campos estruturados."); }
      };
      await save({
        data: {
          id: caso.id ?? null,
          title: f.title ?? "",
          area: f.area ?? "",
          level: Number(f.level ?? 1),
          summary: f.summary ?? null,
          diagnosis: f.diagnosis ?? "",
          expected_conduct: f.expected_conduct ?? null,
          hidden_history: f.hidden_history ?? null,
          patient_image_url: f.patient_image_url ?? null,
          published: f.published !== false,
          patient: parse(f.patient, {}),
          triage: parse(f.triage, {}),
          findings: parse(f.findings, []),
          exams: parse(f.exams, []),
        },
      });
      toast.success("Caso salvo.");
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!caso} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{caso.id ? "Editar caso" : "Novo caso"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2"><Label className="text-xs">Título</Label><Input value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Nível</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.level ?? 1} onChange={(e) => setF({ ...f, level: Number(e.target.value) })}>
                {[1,2,3,4,5,6].map((l) => <option key={l} value={l}>{l}º ano</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Área</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.area ?? AREAS[0]} onChange={(e) => setF({ ...f, area: e.target.value })}>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Resumo</Label><Textarea rows={2} value={f.summary ?? ""} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
          <div><Label className="text-xs">História secreta (roteiro do paciente)</Label><Textarea rows={6} value={f.hidden_history ?? ""} onChange={(e) => setF({ ...f, hidden_history: e.target.value })} /></div>
          <div><Label className="text-xs">Diagnóstico correto</Label><Input value={f.diagnosis ?? ""} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></div>
          <div><Label className="text-xs">Conduta esperada</Label><Textarea rows={3} value={f.expected_conduct ?? ""} onChange={(e) => setF({ ...f, expected_conduct: e.target.value })} /></div>
          <div><Label className="text-xs">Foto do paciente (URL)</Label><Input value={f.patient_image_url ?? ""} onChange={(e) => setF({ ...f, patient_image_url: e.target.value })} /></div>
          {jsonField("patient", "Paciente (JSON: name, age, gender, occupation, personality, lay_level 0-10, speech_style)")}
          {jsonField("triage", "Triagem (JSON: chief_complaint, pa, fc, fr, temp, spo2, dor, ...)")}
          {jsonField("findings", "Achados de exame físico (JSON array: key, label, text, sound_category, sound_finding)", 8)}
          {jsonField("exams", "Exames complementares (JSON array: name, category, justified, result_text, report, is_image)", 8)}
          <div className="flex items-center gap-2"><Switch checked={f.published !== false} onCheckedChange={(v) => setF({ ...f, published: v })} /><span className="text-sm">Publicado</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SoundsAdmin() {
  const save = useServerFn(adminSaveSimSound);
  const del = useServerFn(adminDeleteSimSound);
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ category: "cardiaca", region: "foco mitral", finding_key: "normal", label: "" });

  const reload = () => supabase.from("sim_auscultation_sounds").select("*").order("category").then(({ data }) => setRows(data ?? []));
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">Categoria</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {["cardiaca","pulmonar","abdominal","carotida","percussao"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Região</Label><Input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div>
          <div><Label className="text-xs">Achado (chave)</Label><Input value={f.finding_key} onChange={(e) => setF({ ...f, finding_key: e.target.value })} placeholder="sopro_sistolico" /></div>
          <div><Label className="text-xs">Rótulo</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div><Label className="text-xs">URL do áudio</Label><Input value={f.audio_url ?? ""} onChange={(e) => setF({ ...f, audio_url: e.target.value })} /></div>
          <div className="md:col-span-4"><Label className="text-xs">Descrição (usada quando não há áudio)</Label><Input value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
            try {
              await save({ data: { id: f.id ?? null, category: f.category, region: f.region, finding_key: f.finding_key, label: f.label, description: f.description ?? null, audio_url: f.audio_url ?? null, license: f.license ?? null } });
              toast.success("Som salvo."); setF({ category: "cardiaca", region: "foco mitral", finding_key: "normal", label: "" }); reload();
            } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
          }}><Plus className="size-4 mr-2" /> Salvar</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Volume2 className="size-4 text-emerald-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{r.label} <span className="text-xs text-muted-foreground">({r.category} · {r.finding_key})</span></div>
                {r.audio_url ? <audio controls src={r.audio_url} className="h-8 mt-1 w-full max-w-sm" /> : <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setF(r)}><Edit className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={async () => { await del({ data: { id: r.id } }); reload(); }}><Trash2 className="size-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum som cadastrado. Sem áudio, o aluno recebe a descrição textual do achado.</p>}
      </div>
    </div>
  );
}

function FeedbackAdmin() {
  const list = useServerFn(adminListSimFeedback);
  const resolve = useServerFn(adminResolveSimFeedback);
  const [rows, setRows] = useState<any[]>([]);
  const [rule, setRule] = useState<Record<string, string>>({});
  const reload = () => list().then((r: any) => setRows(r ?? [])).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum feedback recebido.</p>}
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={r.rating === "up" ? "default" : "destructive"}>{r.rating === "up" ? "Fez sentido" : "Discordou"}</Badge>
              <Badge variant="outline">{r.status}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-sm"><b>Caso:</b> {r.sim_sessions?.sim_cases?.title ?? "—"} · nota {r.sim_sessions?.score ?? "—"}</div>
            {r.comment && <p className="text-sm bg-muted/40 rounded-lg p-2">{r.comment}</p>}
            {r.status === "pending" && (
              <div className="space-y-2">
                <Input
                  placeholder="Regra a ensinar para a IA (opcional, ao aprovar)"
                  value={rule[r.id] ?? ""}
                  onChange={(e) => setRule({ ...rule, [r.id]: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
                    await resolve({ data: { id: r.id, status: "approved", rule: rule[r.id] ?? null } });
                    toast.success("Feedback aprovado."); reload();
                  }}>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    await resolve({ data: { id: r.id, status: "rejected", rule: null } });
                    reload();
                  }}>Rejeitar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RulesAdmin() {
  const list = useServerFn(adminListSimRules);
  const save = useServerFn(adminSaveSimRule);
  const del = useServerFn(adminDeleteSimRule);
  const [rows, setRows] = useState<any[]>([]);
  const [text, setText] = useState("");
  const reload = () => list().then((r: any) => setRows(r ?? [])).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nova regra de correção para a IA..." />
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
            if (text.trim().length < 4) return;
            await save({ data: { id: null, rule: text.trim(), active: true } });
            setText(""); reload();
          }}><Plus className="size-4" /></Button>
        </CardContent>
      </Card>
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <Switch checked={r.active} onCheckedChange={async (v) => { await save({ data: { id: r.id, rule: r.rule, active: v } }); reload(); }} />
            <div className="flex-1 text-sm">{r.rule}</div>
            <Button variant="ghost" size="icon" onClick={async () => { await del({ data: { id: r.id } }); reload(); }}><Trash2 className="size-4 text-destructive" /></Button>
          </CardContent>
        </Card>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra. Aprove feedbacks de alunos para treinar a correção.</p>}
    </div>
  );
}
