import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createDocUploadUrl, getDocDownloadUrl, deleteDocFiles } from "@/lib/camed-docs.functions";
import { ChevronRight, FolderPlus, Folder, FileText, Upload, Trash2, Pencil, ExternalLink, Home } from "lucide-react";

type DocRow = {
  id: string;
  parent_id: string | null;
  kind: "folder" | "file";
  name: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function CamedDocumentsTab() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<DocRow[]>([]);
  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState<DocRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const signUpload = useServerFn(createDocUploadUrl);
  const signDownload = useServerFn(getDocDownloadUrl);
  const removeFiles = useServerFn(deleteDocFiles);

  const currentId = path.length ? path[path.length - 1].id : null;

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("camed_documents")
      .select("*")
      .order("kind", { ascending: true })
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as DocRow[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const items = useMemo(
    () => rows.filter((r) => (r.parent_id ?? null) === currentId),
    [rows, currentId],
  );

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    const { error } = await (supabase as any)
      .from("camed_documents")
      .insert({ name, kind: "folder", parent_id: currentId });
    if (error) return toast.error(error.message);
    setNewFolder("");
    toast.success("Pasta criada");
    load();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) return toast.error("Envie apenas PDF ou DOCX");
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 5 MB — comprima o arquivo antes de enviar");
    setUploading(true);
    try {
      const { path: storagePath, token } = await signUpload({
        data: { filename: file.name, size: file.size, mime: file.type || "application/octet-stream" },
      });
      const up = await supabase.storage.from("camed-docs").uploadToSignedUrl(storagePath, token, file);
      if (up.error) throw new Error(up.error.message);
      const { error } = await (supabase as any).from("camed_documents").insert({
        name: file.name,
        kind: "file",
        parent_id: currentId,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw new Error(error.message);
      toast.success("Documento enviado");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no envio");
    } finally {
      setUploading(false);
    }
  }

  async function openFile(row: DocRow) {
    if (!row.storage_path) return;
    const w = window.open("", "_blank");
    try {
      const { url } = await signDownload({ data: { path: row.storage_path } });
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      w?.close();
      toast.error(err?.message ?? "Falha ao abrir");
    }
  }

  async function doRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    const { error } = await (supabase as any).from("camed_documents").update({ name }).eq("id", renaming.id);
    if (error) return toast.error(error.message);
    setRenaming(null);
    toast.success("Renomeado");
    load();
  }

  function descendants(id: string, acc: DocRow[] = []): DocRow[] {
    for (const r of rows.filter((x) => x.parent_id === id)) {
      acc.push(r);
      if (r.kind === "folder") descendants(r.id, acc);
    }
    return acc;
  }

  async function remove(row: DocRow) {
    const all = [row, ...(row.kind === "folder" ? descendants(row.id) : [])];
    const label = row.kind === "folder" ? "Excluir a pasta e todo o conteúdo?" : "Excluir este documento?";
    if (!confirm(label)) return;
    const paths = all.map((r) => r.storage_path).filter(Boolean) as string[];
    const { error } = await (supabase as any).from("camed_documents").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    if (paths.length) { try { await removeFiles({ data: { paths } }); } catch {} }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Atas e Documentos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Organize atas e arquivos em pastas e subpastas. Aceita PDF e DOCX de até 5 MB por arquivo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button className="inline-flex items-center gap-1 hover:text-primary" onClick={() => setPath([])}>
              <Home className="size-4" /> Início
            </button>
            {path.map((p, i) => (
              <span key={p.id} className="inline-flex items-center gap-1">
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <button className="hover:text-primary" onClick={() => setPath(path.slice(0, i + 1))}>{p.name}</button>
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Input placeholder="Nome da nova pasta" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
              <Button variant="secondary" onClick={createFolder}><FolderPlus className="size-4 mr-1.5" /> Pasta</Button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={onUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="size-4 mr-1.5" /> {uploading ? "Enviando..." : "Enviar documento"}
            </Button>
          </div>

          <div className="rounded-lg border border-border divide-y divide-border">
            {loading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
            {!loading && items.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Pasta vazia.</div>
            )}
            {items.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                {r.kind === "folder" ? <Folder className="size-5 text-primary shrink-0" /> : <FileText className="size-5 text-muted-foreground shrink-0" />}
                <button
                  className="flex-1 text-left truncate font-medium hover:text-primary"
                  onClick={() => (r.kind === "folder" ? setPath([...path, r]) : openFile(r))}
                >
                  {r.name}
                </button>
                <span className="text-xs text-muted-foreground hidden sm:block">{fmtSize(r.size_bytes)}</span>
                {r.kind === "file" && (
                  <Button size="icon" variant="ghost" onClick={() => openFile(r)}><ExternalLink className="size-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => { setRenaming(r); setRenameValue(r.name); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={doRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
