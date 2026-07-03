import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/image-upload";
import { toast } from "sonner";

interface ImageUploadProps {
  label?: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  className?: string;
}

export function ImageUpload({ label = "Imagem", folder, value, onChange, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload da imagem");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      {value ? (
        <div className="relative rounded-lg border overflow-hidden bg-muted aspect-video max-w-sm">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 size-7"
            onClick={() => onChange("")}
            aria-label="Remover imagem"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full cursor-pointer rounded-lg border border-dashed border-border bg-muted hover:bg-muted/80 transition-colors p-6 flex flex-col items-center justify-center gap-2 aspect-video max-w-sm disabled:opacity-60"
        >
          {uploading ? (
            <Upload className="size-8 text-muted-foreground animate-bounce" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground text-center">
            {uploading ? "Compactando e enviando..." : "Clique para escolher uma imagem"}
          </p>
          <p className="text-xs text-muted-foreground">Máx. 5 MB · compactação automática</p>
        </button>
      )}
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
