import { useEffect, useRef, useState } from "react";

export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;
    let cancelled = false;
    let sc: any = null;

    async function startScanner() {
      try {
        setError(null);
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !ref.current) return;

        const id = "qr-reader-" + Math.random().toString(36).slice(2);
        ref.current.id = id;
        sc = new Html5Qrcode(id, { verbose: false });
        scannerRef.current = sc;

        await sc.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            const now = Date.now();
            if (lastRef.current && lastRef.current.text === decoded && now - lastRef.current.at < 2000) return;
            lastRef.current = { text: decoded, at: now };
            onScan(decoded);
          },
          () => {},
        );
      } catch (e) {
        console.error("QR start error", e);
        if (!cancelled) setError("Não foi possível abrir a câmera neste dispositivo.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (!sc) return;
      sc.stop().then(() => sc.clear()).catch(() => {});
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!scannerRef.current) return;
    if (paused) scannerRef.current.pause(true);
    else scannerRef.current.resume();
  }, [paused]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="w-full max-w-[360px] mx-auto rounded overflow-hidden border min-h-[280px]" />
      {error && <p className="text-xs text-center text-muted-foreground">{error}</p>}
    </div>
  );
}
