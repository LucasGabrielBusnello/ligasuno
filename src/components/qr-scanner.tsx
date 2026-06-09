import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const id = "qr-reader-" + Math.random().toString(36).slice(2);
    ref.current.id = id;
    const sc = new Html5Qrcode(id, { verbose: false });
    scannerRef.current = sc;
    let stopped = false;
    sc.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => {
        const now = Date.now();
        if (lastRef.current && lastRef.current.text === decoded && now - lastRef.current.at < 2000) return;
        lastRef.current = { text: decoded, at: now };
        onScan(decoded);
      },
      () => {},
    ).catch((e) => console.error("QR start error", e));
    return () => {
      stopped = true;
      sc.stop().then(() => sc.clear()).catch(() => {});
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!scannerRef.current) return;
    if (paused) scannerRef.current.pause(true);
    else scannerRef.current.resume();
  }, [paused]);

  return <div ref={ref} className="w-full max-w-[360px] mx-auto rounded overflow-hidden border" />;
}
