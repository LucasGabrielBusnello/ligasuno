import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getCourseDocDownloadUrl } from "@/lib/camed-course-docs.functions";
import { FileText, Download, BookOpen } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  file_name: string | null;
  size_bytes: number | null;
};

function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function CamedCourseDocsSection() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [visible, setVisible] = useState(3);
  const signDownload = useServerFn(getCourseDocDownloadUrl);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("camed_course_documents")
        .select("id,title,description,image_url,file_name,size_bytes")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      setDocs(((data ?? []) as Doc[]) || []);
    })();
  }, []);

  async function download(d: Doc) {
    setBusy(d.id);
    const w = window.open("", "_blank");
    try {
      const { url } = await signDownload({ data: { id: d.id } });
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      w?.close();
      toast.error(err?.message ?? "Falha ao baixar");
    } finally {
      setBusy(null);
    }
  }

  if (docs.length === 0) return null;

  const shown = docs.slice(0, visible);
  const canExpand = visible < docs.length;
  const canCollapse = visible > 3;

  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
        <BookOpen className="size-6 text-emerald-600" /> Documentos do curso
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Materiais e documentos pertinentes ao curso, disponibilizados pelo CAMED.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-border/70 bg-card overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
          >
            {d.image_url ? (
              <img src={d.image_url} alt={d.title} loading="lazy" className="h-36 w-full object-cover" />
            ) : (
              <div className="h-36 w-full bg-gradient-to-br from-emerald-900 to-teal-800 flex items-center justify-center">
                <FileText className="size-10 text-white/80" />
              </div>
            )}
            <div className="p-4 flex flex-col gap-2 flex-1">
              <h3 className="font-bold leading-tight">{d.title}</h3>
              {d.description && <p className="text-sm text-muted-foreground line-clamp-3">{d.description}</p>}
              <div className="mt-auto pt-2">
                <p className="text-[11px] text-muted-foreground mb-2">
                  {d.file_name} {fmtSize(d.size_bytes)}
                </p>
                <Button className="w-full" disabled={busy === d.id} onClick={() => download(d)}>
                  <Download className="size-4 mr-1.5" /> {busy === d.id ? "Abrindo..." : "Baixar"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
