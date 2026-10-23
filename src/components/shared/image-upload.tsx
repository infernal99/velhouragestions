"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Uploads an image to the public-assets bucket under `folder` and returns its public URL. */
export function ImageUpload({
  folder,
  onUploaded,
  label = "Subir imagen",
  maxBytes = 2 * 1024 * 1024,
}: {
  folder: string;
  onUploaded: (url: string) => Promise<void> | void;
  label?: string;
  maxBytes?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Formato no admitido. Usa PNG, JPG, WebP o SVG.");
      return;
    }
    if (file.size > maxBytes) {
      toast.error("La imagen supera 2 MB.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("public-assets").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error("No se pudo subir la imagen.");
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
    await onUploaded(data.publicUrl);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => void handle(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {label}
      </Button>
    </>
  );
}
