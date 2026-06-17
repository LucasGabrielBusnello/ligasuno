import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { getCertificateTemplate, saveCertificateTemplate } from "@/lib/certificates.functions";

type Box = { x: number; y: number; width: number; height: number };

const defaultNameBox: Box = { x: 0.28, y: 0.42, width: 0.44, height: 0.09 };
const defaultSignatureBox: Box = { x: 0.58, y: 0.68, width: 0.24, height: 0.1 };
const fonts = [
  { value: "TimesRoman", label: "Clássica" },
  { value: "TimesRomanBold", label: "Clássica forte" },
  { value: "Helvetica", label: "Moderna" },
  { value: "HelveticaBold", label: "Moderna forte" },
  { value: "Courier", label: "Monoespaçada" },
  { value: "CourierBold", label: "Monoespaçada forte" },
] as const;

function cssFont(value: string) {
  if (value.startsWith("Helvetica")) return "Arial, sans-serif";
  if (value.startsWith("Courier")) return "Courier New, monospace";
  return "Times New Roman, serif";
}

function normalizeBox(a: Box, b: Box): Box {
  const x = Math.max(0, Math.min(a.x, b.x));
  const y = Math.max(0, Math.min(a.y, b.y));
  const right = Math.min(1, Math.max(a.x, b.x));
  const bottom = Math.min(1, Math.max(a.y, b.y));
  return { x, y, width: Math.max(0.02, right - x), height: Math.max(0.02, bottom - y) };
}

export function CertificateTemplateEditor({ leagueId }: { leagueId: string }) {
  const getTemplate = useServerFn(getCertificateTemplate);
  const saveTemplate = useServerFn(saveCertificateTemplate);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [nameBox, setNameBox] = useState<Box>(defaultNameBox);
  const [signatureBox, setSignatureBox] = useState<Box>(defaultSignatureBox);
  const [fontFamily, setFontFamily] = useState<(typeof fonts)[number]["value"]>("TimesRomanBold");
  const [active, setActive] = useState<"name" | "signature">("name");
  const [dragStart, setDragStart] = useState<Box | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTemplate({ data: { league_id: leagueId } } as any)
      .then((res: any) => {
        if (cancelled) return;
        const t = res?.template;
        setImageBase64(t?.image_base64 ?? null);
        setNameBox(t?.name_box ?? defaultNameBox);
        setSignatureBox(t?.signature_box ?? defaultSignatureBox);
        setFontFamily(t?.font_family ?? "TimesRomanBold");
        setNewImageBase64(null);
      })
      .catch((e: any) => toast.error(e?.message ?? "Falha ao carregar modelo"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [leagueId]);

  function point(e: PointerEvent<HTMLDivElement>): Box | null {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      width: 0,
      height: 0,
    };
  }

  function setActiveBox(box: Box) {
    if (active === "name") setNameBox(box);
    else setSignatureBox(box);
  }

  function onFile(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return toast.error("Envie PNG ou JPG.");
    if (file.size > 4_000_000) return toast.error("Imagem muito grande (máx 4MB).");
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setImageBase64(value);
      setNewImageBase64(value);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    try {
      setSaving(true);
      await saveTemplate({ data: { league_id: leagueId, image_base64: newImageBase64 ?? undefined, name_box: nameBox, signature_box: signatureBox, font_family: fontFamily } } as any);
      setNewImageBase64(null);
      toast.success("Modelo de certificado salvo");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar modelo"); }
    finally { setSaving(false); }
  }

  const areaClass = "absolute border-2 border-primary bg-primary/10 shadow-sm";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold">Modelo visual do certificado</h3>
          <p className="text-xs text-muted-foreground">Envie a imagem do certificado e arraste no preview para marcar a área do nome e da assinatura.</p>
        </div>
        {loading && <Badge variant="outline"><Loader2 className="size-3 mr-1 animate-spin" />Carregando</Badge>}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Imagem do modelo</Label>
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0])} className="mt-1 block w-full text-xs" />
          </div>
          <div>
            <Label className="text-xs">Fonte do nome</Label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as any)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
              {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={active === "name" ? "default" : "outline"} onClick={() => setActive("name")}>Área do nome</Button>
            <Button type="button" size="sm" variant={active === "signature" ? "default" : "outline"} onClick={() => setActive("signature")}>Assinatura</Button>
          </div>
          <Button type="button" className="w-full" onClick={save} disabled={saving || !imageBase64}>{saving ? "Salvando..." : "Salvar modelo"}</Button>
        </div>

        <div
          ref={previewRef}
          className="relative aspect-[842/595] overflow-hidden rounded border bg-muted select-none"
          onPointerDown={(e) => { const p = point(e); if (p) setDragStart(p); }}
          onPointerMove={(e) => { const p = point(e); if (p && dragStart) setActiveBox(normalizeBox(dragStart, p)); }}
          onPointerUp={(e) => { const p = point(e); if (p && dragStart) setActiveBox(normalizeBox(dragStart, p)); setDragStart(null); }}
        >
          {imageBase64 ? <img src={imageBase64} alt="Modelo do certificado" className="absolute inset-0 size-full object-fill" /> : (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"><ImageIcon className="size-5" /> Envie uma imagem para pré-visualizar</div>
          )}
          <div className={areaClass} style={{ left: `${nameBox.x * 100}%`, top: `${nameBox.y * 100}%`, width: `${nameBox.width * 100}%`, height: `${nameBox.height * 100}%` }}>
            <div className="flex size-full items-center justify-center px-2 text-center font-semibold text-primary" style={{ fontFamily: cssFont(fontFamily), fontSize: "clamp(10px, 2.4vw, 28px)" }}>Nome Aparecerá Aqui</div>
          </div>
          <div className="absolute border-2 border-dashed border-primary bg-background/50" style={{ left: `${signatureBox.x * 100}%`, top: `${signatureBox.y * 100}%`, width: `${signatureBox.width * 100}%`, height: `${signatureBox.height * 100}%` }}>
            <div className="grid size-full place-items-center text-xs font-medium text-primary">Assinatura</div>
          </div>
        </div>
      </div>
    </div>
  );
}