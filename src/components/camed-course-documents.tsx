import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  createCourseDocUploadUrl,
  deleteCourseDocFile,
  getCourseDocDownloadUrl,
} from "@/lib/camed-course-docs.functions";
import { Plus, Download, Trash2, Pencil, FileText, Upload } from "lucide-react";

export type CourseDoc = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  display_order: number;
};

const MAX_BYTES = 15 * 1024 * 1024;

export function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function CamedCourseDocumentsManager() {
  const [rows, setRows] = useState<CourseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CourseDoc> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const signUpload = useServerFn(createCourseDocUploadUrl);
  const removeFile = useServerFn(deleteCourseDocFile);
  const signDownload = useServerFn(getCourseDocDownloadUrl);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("camed_course_documents")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as CourseDoc[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing) return;
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 15 MB");
    setUploading(true);
    try {
      const { path, token } = await signUpload({ data: { filename: file.name, size: file.size } });
      const up = await supabase.storage.from("camed-course-docs").uploadToSignedUrl(path, token, file);
      if (up.error) throw new Error(up.error.message);
      setEditing({
        ...editing,
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        title: editing.title || file.name.replace(/\.[^.]+$/, ""),
      });
      toast.success("Arquivo enviado");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no envio");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editing) return;
    const title = (editing.title ?? "").trim();
    if (!title) return toast.error("Informe o nome do documento");
    if (!editing.storage_path && !editing.file_url) return toast.error("Envie um arquivo");
    const payload: any = {
      title,
      description: editing.description ?? null,
      image_url: editing.image_url ?? null,
      file_url: editing.file_url ?? null,
      file_name: editing.file_name ?? null,
      storage_path: editing.storage_path ?? null,
      size_bytes: editing.size_bytes ?? null,
      display_order: Number(editing.display_order ?? 0),
    };
    const q = editing.id
      ? (supabase as any).from("camed_course_documents").update(payload).eq("id", editing.id)
      : (supabase as any).from("camed_course_documents").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Documento salvo");
    setEditing(null);
    load();
  }

  async function remove(row: CourseDoc) {
    if (!confirm(`Excluir "${row.title}"?`)) return;
    const { error } = await (supabase as any).from("camed_course_documents").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    if (row.storage_path) {
      try {
        await removeFile({ data: { path: row.storage_path } });
      } catch {}
    }
    toast.success("Excluído");
    load();
  }

  async function download(row: CourseDoc) {
    const w = window.open("", "_blank");
    try {
      const { url } = await signDownload({ data: { id: row.id } });
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      w?.close();
      toast.error(err?.message ?? "Falha ao baixar");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Documentos do curso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Arquivos pertinentes ao curso que ficam disponíveis publicamente na página do CAMED.
          </p>
        </div>
        <Button onClick={() => setEditing({ title: "", description: "", display_order: rows.length })}>
          <Plus className="size-4 mr-1.5" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border border-dashed">
            Nenhum documento cadastrado.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            {r.image_url ? (
              <img src={r.image_url} alt="" className="size-14 rounded-md object-cover shrink-0" />
            ) : (
              <div className="size-14 rounded-md bg-muted flex items-center justify-center shrink-0">
                <FileText className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{r.title}</p>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
              <p className="text-[11px] text-muted-foreground">
                #{r.display_order} · {r.file_name ?? "arquivo"} {fmtSize(r.size_bytes)}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => download(r)}>
                <Download className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar documento" : "Novo documento"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Imagem (capa)</Label>
                <ImageUpload
                  value={editing.image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, image_url: url || null })}
                  folder="camed/documentos"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo</Label>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                  onChange={onPickFile}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4 mr-1.5" /> {uploading ? "Enviando..." : "Selecionar arquivo"}
                  </Button>
                  <span className="text-xs text-muted-foreground truncate">
                    {editing.file_name ? `${editing.file_name} ${fmtSize(editing.size_bytes)}` : "PDF, DOCX, PPTX, XLSX ou ZIP até 15 MB"}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={uploading}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
