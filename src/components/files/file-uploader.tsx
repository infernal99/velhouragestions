"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/forms/fields";
import { createClient } from "@/lib/supabase/client";
import { registerFile } from "@/lib/actions/files";
import { buildStoragePath, MAX_UPLOAD_BYTES } from "@/lib/files";
import { fileCategoryOptions } from "@/lib/labels";
import { useApp } from "@/components/app-provider";
import { cn } from "@/lib/utils";
import type { FileCategory } from "@/types/database";

export interface UploadTarget {
  project_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  is_finance?: boolean;
}

/** Uploads straight to Supabase Storage, then registers the files row. */
export async function uploadFile(companyId: string, file: File, category: FileCategory, target: UploadTarget) {
  if (file.size > MAX_UPLOAD_BYTES) {
    toast.error(`«${file.name}» supera el límite de 50 MB.`);
    return null;
  }
  const supabase = createClient();
  const path = buildStoragePath(companyId, file.name);
  const { error } = await supabase.storage.from("company-files").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    toast.error(`No se pudo subir «${file.name}».`);
    return null;
  }
  const res = await registerFile({
    storage_path: path,
    name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    category,
    project_id: target.project_id ?? null,
    client_id: target.client_id ?? null,
    task_id: target.task_id ?? null,
    is_finance: target.is_finance ?? category === "factura",
  });
  if (!res.ok) {
    toast.error(res.error);
    return null;
  }
  return res.data.id;
}

export function FileUploader({
  target,
  defaultCategory = "otro",
  compact,
  onUploaded,
}: {
  target: UploadTarget;
  defaultCategory?: FileCategory;
  compact?: boolean;
  onUploaded?: () => void;
}) {
  const { company, permissions } = useApp();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FileCategory>(defaultCategory);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      if (await uploadFile(company.id, file, category, target)) okCount++;
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (okCount) {
      toast.success(okCount === 1 ? "Archivo subido" : `${okCount} archivos subidos`);
      if (onUploaded) onUploaded();
      else router.refresh();
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 transition-colors",
        dragging && "border-brand bg-brand/5",
        compact && "p-2",
      )}
    >
      <input ref={input} type="file" multiple hidden onChange={(e) => void handle(e.target.files)} />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        Subir archivos
      </Button>
      {!target.is_finance ? (
        <SimpleSelect
          value={category}
          onChange={(v) => setCategory((v as FileCategory) ?? "otro")}
          options={fileCategoryOptions.filter((o) => o.value !== "justificante" && (o.value !== "factura" || permissions.canViewFinances)).map((o) => ({ value: o.value, label: o.label }))}
          className="h-7 w-auto min-w-40"
        />
      ) : null}
      {!compact ? <span className="text-xs text-muted-foreground">o arrastra aquí · máx. 50 MB</span> : null}
    </div>
  );
}
