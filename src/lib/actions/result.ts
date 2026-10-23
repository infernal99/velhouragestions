import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZod(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Revisa los campos marcados.", fieldErrors);
}

/**
 * Turn a database error into a message that's safe to show: our own
 * trigger messages (raised in Spanish, P0001/23514/42501) pass through;
 * everything else becomes a generic message and is logged server-side.
 */
export function fromDbError(error: PostgrestError | null | undefined, fallback = "No se pudo completar la operación."): ActionResult<never> {
  if (!error) return fail(fallback);
  const code = error.code;
  if (code === "P0001" || code === "P0002" || code === "23514" || code === "22023") {
    return fail(error.message);
  }
  if (code === "42501") {
    return fail(error.message.startsWith("new row violates") ? "No tienes permiso para realizar esta acción." : error.message);
  }
  if (code === "23505") return fail("Ya existe un registro con esos datos.");
  if (code === "23503") return fail("Este elemento está vinculado a otros datos y no se puede eliminar.");
  if (code === "PGRST116") return fail("No se ha encontrado el elemento o no tienes acceso.");
  console.error("[db]", error.code, error.message, error.details);
  return fail(fallback);
}
