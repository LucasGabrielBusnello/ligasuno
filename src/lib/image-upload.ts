import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const MAX_MB = 5;

export async function uploadImage(file: File, folder: string): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Imagem deve ter no máximo ${MAX_MB} MB.`);
  }

  const options = {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: "image/webp",
  };

  const compressed = await imageCompression(file, options);
  const ext = "webp";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("images").upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/webp",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Falha ao obter URL pública da imagem.");

  return data.publicUrl;
}
