import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  initialPng?: string | null;
  onChange: (pngBase64: string | null) => void;
};

export function SignaturePad({ initialPng, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(!!initialPng);
  const [mode, setMode] = useState<"draw" | "upload">("draw");

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    if (initialPng) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, c.clientWidth, c.clientHeight); };
      img.src = initialPng;
    }
  }, []);

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent) {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
    setDrawing(true); (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing) return;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke();
    setHasInk(true);
  }
  function end() {
    if (!drawing) return;
    setDrawing(false);
    const c = canvasRef.current!;
    const png = c.toDataURL("image/png");
    onChange(png);
  }
  function clear() {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false); onChange(null);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 1_000_000) { alert("Imagem muito grande (máx 1MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      onChange(dataUrl);
      setHasInk(true);
      // preview no canvas também
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.clientWidth, c.clientHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={mode === "draw" ? "default" : "outline"} onClick={() => setMode("draw")}>Desenhar</Button>
        <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}>Enviar PNG</Button>
      </div>
      <div className="rounded-md border bg-white">
        <canvas
          ref={canvasRef}
          className="block w-full h-40 touch-none cursor-crosshair"
          onPointerDown={mode === "draw" ? start : undefined}
          onPointerMove={mode === "draw" ? move : undefined}
          onPointerUp={mode === "draw" ? end : undefined}
          onPointerLeave={mode === "draw" ? end : undefined}
        />
      </div>
      {mode === "upload" && (
        <div>
          <Label className="text-xs">Imagem PNG (preferencialmente com fundo transparente, máx 1MB)</Label>
          <input type="file" accept="image/png" onChange={onUpload} className="block w-full text-xs mt-1" />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!hasInk}>Limpar</Button>
      </div>
    </div>
  );
}
