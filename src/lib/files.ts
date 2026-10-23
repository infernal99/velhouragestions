// Client-safe helpers for file handling.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** "<company>/<uuid>-<safe-name>" — the company prefix is what storage RLS checks. */
export function buildStoragePath(companyId: string, fileName: string) {
  const safe =
    fileName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "archivo";
  return `${companyId}/${crypto.randomUUID()}-${safe}`;
}

export function isPreviewable(mime: string | null | undefined) {
  if (!mime) return false;
  return mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/") || mime.startsWith("video/");
}
