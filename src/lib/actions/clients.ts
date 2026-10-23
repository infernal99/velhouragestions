"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { clientSchema, crmStages, interactionSchema } from "@/lib/validation/crm";
import { optionalText } from "@/lib/validation/common";

export async function saveClient(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const values = parsed.data;

    if (id) {
      const { error } = await ctx.supabase.from("clients").update(values).eq("id", id).eq("company_id", ctx.company.id);
      if (error) return fromDbError(error);
      revalidatePath("/clientes");
      revalidatePath(`/clientes/${id}`);
      return ok({ id }, "Cliente actualizado");
    }

    const { data, error } = await ctx.supabase
      .from("clients")
      .insert({ ...values, company_id: ctx.company.id, created_by: ctx.userId, owner_id: values.owner_id ?? ctx.userId })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    revalidatePath("/clientes");
    revalidatePath("/");
    return ok({ id: data.id as string }, "Cliente creado");
  });
}

export async function updateClientStage(id: string, stage: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(crmStages).safeParse(stage);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase
      .from("clients")
      .update({ stage: parsed.data }, { count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No tienes acceso a este cliente.");
    revalidatePath("/clientes");
    return ok(undefined);
  });
}

export async function setClientArchived(id: string, archived: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("clients")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return ok(undefined, archived ? "Cliente archivado" : "Cliente restaurado");
  });
}

export async function deleteClient(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("clients:manage");
    const { error, count } = await ctx.supabase
      .from("clients")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar el cliente.");
    revalidatePath("/clientes");
    return ok(undefined, "Cliente eliminado");
  });
}

export async function addInteraction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = interactionSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const occurred = new Date(parsed.data.occurred_at);
    if (Number.isNaN(occurred.getTime())) return fail("Fecha no válida.", { occurred_at: "Fecha no válida" });
    const { error } = await ctx.supabase.from("client_interactions").insert({
      ...parsed.data,
      occurred_at: occurred.toISOString(),
      company_id: ctx.company.id,
      created_by: ctx.userId,
    });
    if (error) return fromDbError(error);
    revalidatePath(`/clientes/${parsed.data.client_id}`);
    return ok(undefined, "Registro añadido al historial");
  });
}

export async function deleteInteraction(id: string, clientId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase.from("client_interactions").delete({ count: "exact" }).eq("id", id);
    if (error) return fromDbError(error);
    if (!count) return fail("Solo el autor o un responsable de clientes puede eliminarlo.");
    revalidatePath(`/clientes/${clientId}`);
    return ok(undefined, "Registro eliminado");
  });
}

export async function updateClientNotes(id: string, notes: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = optionalText(10000).safeParse(notes);
    if (!parsed.success) return fail("Las notas son demasiado largas.");
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("clients").update({ notes: parsed.data }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    revalidatePath(`/clientes/${id}`);
    return ok(undefined, "Notas guardadas");
  });
}
