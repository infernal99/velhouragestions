"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { optionalUuid } from "@/lib/validation/common";

const BUCKET = "company-files";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const registerSchema = z.object({
  storage_path: z.string().min(10).max(500),
  name: z.string().trim().min(1).max(255),
  mime_type: z.string().max(200).nullable(),
  size_bytes: z.number().int().min(0).max(MAX_FILE_BYTES),
  category: z.enum(["briefing", "diseno", "contrato", "presupuesto", "tecnico", "imagen", "recurso_cliente", "justificante", "otro"]),
  project_id: optionalUuid,
  client_id: optionalUuid,
  task_id: optionalUuid,
  is_finance: z.boolean().default(false),
});

/** Called after the browser uploaded the object; creates the files row. */
export async function registerFile(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext(parsed.data.is_finance ? "finances" : undefined);
    if (!parsed.data.storage_path.startsWith(`${ctx.company.id}/`) || parsed.data.storage_path.includes("..")) {
      return fail("Ruta de archivo no válida.");
    }
    const { data, error } = await ctx.supabase
      .from("files")
      .insert({ ...parsed.data, company_id: ctx.company.id, uploaded_by: ctx.userId })
      .select("id")
      .single();
    if (error) {
      // don't leave an orphaned object behind
      await ctx.supabase.storage.from(BUCKET).remove([parsed.data.storage_path]);
      return fromDbError(error, "No se pudo guardar el archivo.");
    }
    revalidatePath("/documentos");
    if (parsed.data.project_id) revalidatePath(`/proyectos/${parsed.data.project_id}`);
    if (parsed.data.client_id) revalidatePath(`/clientes/${parsed.data.client_id}`);
    return ok({ id: data.id as string });
  });
}

/** Short-lived signed URL; storage RLS only signs it if the files row is readable. */
export async function getFileUrl(id: string, download = false): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    if (!z.uuid().safeParse(id).success) return fail("Archivo no válido.");
    const ctx = await actionContext();
    const { data: file } = await ctx.supabase.from("files").select("storage_path, name").eq("id", id).single();
    if (!file) return fail("Archivo no encontrado o sin acceso.");
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.storage_path as string, 120, download ? { download: file.name as string } : undefined);
    if (error || !data) return fail("No se pudo generar el enlace de descarga.");
    return ok({ url: data.signedUrl });
  });
}

export async function deleteFile(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { data: file } = await ctx.supabase
      .from("files")
      .select("storage_path, uploaded_by, project_id, client_id")
      .eq("id", id)
      .single();
    if (!file) return fail("Archivo no encontrado.");
    if (file.uploaded_by !== ctx.userId && !ctx.permissions.isAdmin) {
      return fail("Solo quien subió el archivo o un administrador puede eliminarlo.");
    }
    // object first: its delete policy checks the files row still exists
    const { error: storageError } = await ctx.supabase.storage.from(BUCKET).remove([file.storage_path as string]);
    if (storageError) return fail("No se pudo eliminar el archivo del almacenamiento.");
    const { error } = await ctx.supabase.from("files").delete().eq("id", id);
    if (error) return fromDbError(error);
    revalidatePath("/documentos");
    if (file.project_id) revalidatePath(`/proyectos/${file.project_id}`);
    if (file.client_id) revalidatePath(`/clientes/${file.client_id}`);
    return ok(undefined, "Archivo eliminado");
  });
}
