import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Upload, MousePointer2 } from "lucide-react";
import { getCertificateTemplate, saveCertificateTemplate } from "@/lib/certificates.functions";

type Box = { x: number; y: number; width: number; height: number };
type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const defaultNameBox: Box = { x: 0.25, y: 0.4, width: 0.5, height: 0.12 };
const defaultSignatureBox: Box = { x: 0.55, y: 0.68, width: 0.3, height: 0.1 };
const MIN = 0.04;

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

function clamp(n: number, min = 0, max = 1) { return Math.max(min, Math.min(max, n)); }

function applyHandle(box: Box, h: Handle, dx: number, dy: number): Box {
  let { x, y, width: w, height: ht } = box;
  if (h === "move") {
    x = clamp(x + dx, 0, 1 - w);
    y = clamp(y + dy, 0, 1 - ht);
    return { x, y, width: w, height: ht };
  }
  if (h.includes("w")) { const nx = clamp(x + dx, 0, x + w - MIN); w = w - (nx - x); x = nx; }
  if (h.includes("e")) { w = clamp(w + dx, MIN, 1 - x); }
  if (h.includes("n")) { const ny = clamp(y + dy, 0, y + ht - MIN); ht = ht - (ny - y); y = ny; }
  if (h.includes("s")) { ht = clamp(ht + dy, MIN, 1 - y); }
  return { x, y, width: w, height: ht };
}

export function CertificateTemplateEditor({ leagueId }: { leagueId: string }) {
  const getTemplate = useServerFn(getCertificateTemplate);
  const saveTemplate = useServerFn(saveCertificateTemplate);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [nameBox, setNameBox] = useState<Box>(defaultNameBox);
  const [signatureBox, setSignatureBox] = useState<Box>(defaultSignatureBox);
  const [fontFamily, setFontFamily] = useState<(typeof fonts)[number]["value"]>("TimesRomanBold");
  const [active, setActive] = useState<"name" | "signature">("name");
  const drag = useRef<{ which: "name" | "signature"; handle: Handle; startBox: Box; startX: number; startY: number } | null>(null);

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

  function startDrag(which: "name" | "signature", handle: Handle) {
    return (e: PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect) return;
      setActive(which);
      drag.current = {
        which, handle,
        startBox: which === "name" ? nameBox : signatureBox,
        startX: e.clientX, startY: e.clientY,
      };
    };
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (e.clientX - drag.current.startX) / rect.width;
    const dy = (e.clientY - drag.current.startY) / rect.height;
    const next = applyHandle(drag.current.startBox, drag.current.handle, dx, dy);
    if (drag.current.which === "name") setNameBox(next); else setSignatureBox(next);
  }
  function endDrag() { drag.current = null; }

  async function save() {
    try {
      setSaving(true);
      await saveTemplate({ data: { league_id: leagueId, image_base64: newImageBase64 ?? undefined, name_box: nameBox, signature_box: signatureBox, font_family: fontFamily } } as any);
      setNewImageBase64(null);
      toast.success("Modelo de certificado salvo");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar modelo"); }
    finally { setSaving(false); }
  }

  function ResizableBox({ which, box, color, label }: { which: "name" | "signature"; box: Box; color: string; label: string }) {
    const isActive = active === which;
    const ring = isActive ? "ring-2 ring-offset-1 ring-primary" : "";
    const handles: { h: Handle; style: React.CSSProperties; cursor: string }[] = [
      { h: "nw", style: { left: -6, top: -6 }, cursor: "nwse-resize" },
      { h: "ne", style: { right: -6, top: -6 }, cursor: "nesw-resize" },
      { h: "sw", style: { left: -6, bottom: -6 }, cursor: "nesw-resize" },
      { h: "se", style: { right: -6, bottom: -6 }, cursor: "nwse-resize" },
      { h: "n", style: { left: "50%", top: -6, transform: "translateX(-50%)" }, cursor: "ns-resize" },
      { h: "s", style: { left: "50%", bottom: -6, transform: "translateX(-50%)" }, cursor: "ns-resize" },
      { h: "w", style: { left: -6, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize" },
      { h: "e", style: { right: -6, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize" },
    ];
    return (
      <div
        className={`absolute select-none ${ring}`}
        style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%`, cursor: "move", border: `2px solid ${color}`, background: `${color}1a` }}
        onPointerDown={startDrag(which, "move")}
        onClick={() => setActive(which)}
      >
        <div className="absolute -top-6 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: color, color: "#fff" }}>{label}</div>
        {which === "name" ? (
          <div className="flex size-full items-center justify-center px-2 text-center font-semibold pointer-events-none" style={{ color, fontFamily: cssFont(fontFamily), fontSize: "clamp(10px, 2.4vw, 28px)" }}>
            Nome Aparecerá Aqui
          </div>
        ) : (
          <div className="grid size-full place-items-center text-xs font-medium pointer-events-none" style={{ color }}>Assinatura</div>
        )}
        {handles.map((hd) => (
          <div key={hd.h} onPointerDown={startDrag(which, hd.h)} className="absolute size-3 rounded-sm bg-background shadow" style={{ ...hd.style, border: `2px solid ${color}`, cursor: hd.cursor }} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold">Modelo visual do certificado</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MousePointer2 className="size-3" /> Arraste as bordas para redimensionar as áreas, ou o centro para mover.</p>
        </div>
        {loading && <Badge variant="outline"><Loader2 className="size-3 mr-1 animate-spin" />Carregando</Badge>}
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-3">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0])} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition p-4 text-center cursor-pointer">
            <Upload className="size-6 mx-auto text-primary" />
            <div className="font-bold text-sm mt-2">{imageBase64 ? "Trocar imagem do modelo" : "Enviar imagem do certificado"}</div>
            <div className="text-[11px] text-muted-foreground mt-1">PNG ou JPG, até 4MB</div>
          </button>

          <div>
            <Label className="text-xs">Fonte do nome</Label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as any)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
              {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={active === "name" ? "default" : "outline"} onClick={() => setActive("name")}>Nome</Button>
            <Button type="button" size="sm" variant={active === "signature" ? "default" : "outline"} onClick={() => setActive("signature")}>Assinatura</Button>
          </div>
          <Button type="button" className="w-full" onClick={save} disabled={saving || !imageBase64}>{saving ? "Salvando..." : "Salvar modelo"}</Button>
        </div>

        <div
          ref={previewRef}
          className="relative aspect-[842/595] overflow-hidden rounded border bg-muted touch-none"
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          {imageBase64 ? <img src={imageBase64} alt="Modelo do certificado" className="absolute inset-0 size-full object-fill pointer-events-none" /> : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="size-8" />
              Envie uma imagem para começar
            </div>
          )}
          <ResizableBox which="name" box={nameBox} color="hsl(var(--primary))" label="Nome" />
          <ResizableBox which="signature" box={signatureBox} color="#16a34a" label="Assinatura" />
        </div>
      </div>
    </div>
  );
}
