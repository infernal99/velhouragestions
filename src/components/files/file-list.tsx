"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, File as FileIcon, FileImage, FileText, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApp, useMemberName } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { deleteFile, getFileUrl, setFileDisabled } from "@/lib/actions/files";
import { formatBytes, formatDate } from "@/lib/format";
import { fileCategoryMap } from "@/lib/labels";
import { isPreviewable } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FileCategory } from "@/types/database";

export interface FileRow {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number;
  category: FileCategory;
  uploaded_by: string | null;
  created_at: string;
  disabled_at?: string | null;
  project_name?: string | null;
  client_name?: string | null;
}

function iconFor(mime: string | null) {
  if (mime?.startsWith("image/")) return FileImage;
  if (mime === "application/pdf" || mime?.startsWith("text/")) return FileText;
  return FileIcon;
}

export function FileList({ files, showContext, onChanged }: { files: FileRow[]; showContext?: boolean; onChanged?: () => void }) {
  const router = useRouter();
  const { userId, permissions } = useApp();
  const memberName = useMemberName();
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string | null } | null>(null);

  const open = async (f: FileRow, download: boolean) => {
    const res = await getFileUrl(f.id, download);
    if (!res.ok) return void (await runAction(Promise.resolve(res)));
    if (download) window.location.assign(res.data.url);
    else setPreview({ name: f.name, url: res.data.url, mime: f.mime_type });
  };

  if (files.length === 0) return <p className="text-sm text-muted-foreground">No hay archivos.</p>;

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {files.map((f) => {
          const Icon = iconFor(f.mime_type);
          const canDelete = f.uploaded_by === userId || permissions.isAdmin;
          return (
            <li key={f.id} className={cn("flex items-center gap-3 px-3 py-2.5", f.disabled_at && "bg-muted/40")}>
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className={cn("min-w-0 flex-1", f.disabled_at && "opacity-60")}>
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <span className={cn("truncate", f.disabled_at && "line-through")}>{f.name}</span>
                  {f.disabled_at ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground no-underline">
                      Desactivado
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {fileCategoryMap[f.category]?.label} · {formatBytes(f.size_bytes)} · {formatDate(f.created_at)}
                  {memberName(f.uploaded_by) ? ` · ${memberName(f.uploaded_by)}` : ""}
                  {showContext && (f.project_name || f.client_name) ? ` · ${f.project_name ?? f.client_name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {isPreviewable(f.mime_type) ? (
                  <Button variant="ghost" size="icon-sm" aria-label="Previsualizar" onClick={() => void open(f, false)}>
                    <Eye />
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon-sm" aria-label="Descargar" onClick={() => void open(f, true)}>
                  <Download />
                </Button>
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={f.disabled_at ? "Activar" : "Desactivar"}
                    title={f.disabled_at ? "Activar documento" : "Desactivar documento"}
                    onClick={async () => {
                      const res = await runAction(setFileDisabled(f.id, !f.disabled_at));
                      if (res.ok) (onChanged ?? router.refresh)();
                    }}
                  >
                    {f.disabled_at ? <Power /> : <PowerOff />}
                  </Button>
                ) : null}
                {canDelete ? (
                  <ConfirmDialog
                    title={`¿Eliminar «${f.name}»?`}
                    description="El archivo se borrará definitivamente del almacenamiento."
                    onConfirm={async () => {
                      const res = await runAction(deleteFile(f.id));
                      if (res.ok) (onChanged ?? router.refresh)();
                    }}
                    trigger={(o) => (
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={o} className="hover:text-destructive">
                        <Trash2 />
                      </Button>
                    )}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview ? (
            preview.mime?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL
              <img src={preview.url} alt={preview.name} className="max-h-[75svh] w-full rounded-md object-contain" />
            ) : preview.mime?.startsWith("video/") ? (
              <video src={preview.url} controls className="max-h-[75svh] w-full rounded-md" />
            ) : (
              <iframe src={preview.url} title={preview.name} className="h-[75svh] w-full rounded-md border" />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
