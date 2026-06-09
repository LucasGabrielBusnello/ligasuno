import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: size })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(""); });
    return () => { cancelled = true; };
  }, [value, size]);
  if (!src) return <div className="bg-muted rounded animate-pulse" style={{ width: size, height: size }} />;
  return <img src={src} alt="QR Code" className={className} width={size} height={size} />;
}

export async function downloadQrPng(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 600 });
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
}
