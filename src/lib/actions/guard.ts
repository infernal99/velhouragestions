import "server-only";
import { unstable_rethrow } from "next/navigation";
import { fail, type ActionResult } from "@/lib/actions/result";
import { getContext, type AppContext } from "@/lib/auth/context";
import { can, type Capability } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export class ActionError extends Error {}

/** Wraps an action body so expected failures become ActionResults. */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return fail(error.message);
    console.error("[action]", error);
    return fail("Ha ocurrido un error inesperado. Inténtalo de nuevo.");
  }
}

/**
 * Every mutating server action starts here: it resolves the caller's
 * company and permissions on the server (never trusting ids or roles sent
 * by the browser) and returns a Supabase client acting as that user.
 */
export async function actionContext(capability?: Capability): Promise<AppContext & { supabase: Awaited<ReturnType<typeof createClient>> }> {
  const ctx = await getContext();
  if (!ctx) throw new ActionError("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  if (capability && !can(ctx.permissions, capability)) {
    throw new ActionError("No tienes permiso para realizar esta acción.");
  }
  const supabase = await createClient();
  return { ...ctx, supabase };
}
