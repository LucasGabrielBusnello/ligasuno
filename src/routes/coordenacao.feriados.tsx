import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { listHolidays, upsertHoliday, deleteHoliday } from "@/lib/schedule.functions";

export const Route = createFileRoute("/coordenacao/feriados")({
  head: () => ({
    meta: [
      { title: "Coordenação · Feriados — MEDUNO" },
      { name: "description", content: "Gestão de feriados do semestre letivo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeriadosPage,
});

function FeriadosPage() {
  const { user, isCoordination, loading } = useAuth();
  const list = useServerFn(listHolidays);
  const save = useServerFn(upsertHoliday);
  const del = useServerFn(deleteHoliday);
  const [items, setItems] = useState<any[]>([]);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");

  const reload = async () => setItems(((await list()) as any[]) ?? []);
  useEffect(() => { if (user && isCoordination) reload(); }, [user, isCoordination]);

  if (loading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!user) return <div className="p-10 text-center">Faça login. <Link to="/auth" className="underline">Entrar</Link></div>;
  if (!isCoordination) return <div className="p-10 text-center">Acesso restrito à coordenação.</div>;

  const add = async () => {
    if (!date || !label.trim()) { toast.error("Data e rótulo obrigatórios"); return; }
    try { await save({ data: { date, label } }); toast.success("Feriado adicionado"); setDate(""); setLabel(""); reload(); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir feriado?")) return;
    try { await del({ data: { id } }); toast.success("Excluído"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Feriados</h1>
        <Button asChild variant="outline" size="sm"><Link to="/coordenacao/cronograma">← Cronograma</Link></Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Rótulo</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Corpus Christi" /></div>
          <Button onClick={add}><Plus className="size-4" /> Adicionar</Button>
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <ul className="divide-y divide-border">
          {items.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhum feriado cadastrado.</li>}
          {items.map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-bold">{new Date(h.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
                <div className="text-sm text-muted-foreground">{h.label}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(h.id)}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      </CardContent></Card>
    </div>
  );
}
