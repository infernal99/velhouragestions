"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { recurringSchema } from "@/lib/validation/finance";
import { todayISO } from "@/lib/format";

function revalidateRecurring() {
  revalidatePath("/finanzas", "layout");
}

export async function saveRecurring(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = recurringSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const { error } = id
      ? await ctx.supabase.from("recurring_payments").update(parsed.data).eq("id", id).eq("company_id", ctx.company.id)
      : await ctx.supabase.from("recurring_payments").insert({ ...parsed.data, company_id: ctx.company.id, created_by: ctx.userId });
    if (error) return fromDbError(error);
    revalidateRecurring();
    return ok(undefined, id ? "Pago mensual actualizado" : "Pago mensual añadido");
  });
}

export async function setRecurringStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(["activo", "pendiente", "pausado", "cancelado"]).safeParse(status);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext("finances");
    const { error, count } = await ctx.supabase
      .from("recurring_payments")
      .update({ status: parsed.data }, { count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se encontró el pago mensual.");
    revalidateRecurring();
    return ok(undefined, "Estado actualizado");
  });
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase
      .from("recurring_payments")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar.");
    revalidateRecurring();
    return ok(undefined, "Pago mensual eliminado (los cobros ya generados se conservan)");
  });
}

/** Creates this month's receivable for every active agreement, once per month. */
export async function generateMonthlyReceivables(): Promise<ActionResult<{ created: number }>> {
  return run(async () => {
    const ctx = await actionContext("finances");
    const { data, error } = await ctx.supabase.rpc("generate_monthly_receivables", {
      p_company: ctx.company.id,
      p_period: `${todayISO().slice(0, 7)}-01`,
    });
    if (error) return fromDbError(error);
    const created = Number(data ?? 0);
    revalidateRecurring();
    return ok(
      { created },
      created ? `${created} cobro${created === 1 ? "" : "s"} del mes generado${created === 1 ? "" : "s"}` : "Los cobros de este mes ya estaban generados",
    );
  });
}
