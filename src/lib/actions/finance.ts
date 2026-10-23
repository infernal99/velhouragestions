"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import {
  expenseSchema,
  paymentSchema,
  quoteCreateSchema,
  quoteSchema,
  quoteStatuses,
  receivableSchema,
} from "@/lib/validation/finance";
import { todayISO } from "@/lib/format";

// Every finance action requires the "finances" capability up front; RLS
// enforces the same rule again in the database.

function revalidateFinance() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------
export async function createQuote(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = quoteCreateSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const { data, error } = await ctx.supabase
      .from("quotes")
      .insert({
        ...parsed.data,
        company_id: ctx.company.id,
        created_by: ctx.userId,
        issue_date: todayISO(),
        valid_until: validUntil.toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    revalidateFinance();
    return ok({ id: data.id as string }, "Presupuesto creado");
  });
}

/** Saves header + replaces all lines (only while editable). */
export async function saveQuote(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = quoteSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const { lines, ...header } = parsed.data;

    const { data: quote } = await ctx.supabase.from("quotes").select("status").eq("id", id).single();
    if (!quote) return fail("Presupuesto no encontrado.");
    if (!["borrador", "enviado"].includes(quote.status as string)) {
      return fail("Este presupuesto ya no se puede editar. Duplícalo para crear una nueva versión.");
    }

    const { error } = await ctx.supabase.from("quotes").update(header).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);

    const { error: linesError } = await ctx.supabase.rpc("replace_quote_lines", { p_quote: id, p_lines: lines });
    if (linesError) return fromDbError(linesError);

    revalidateFinance();
    revalidatePath(`/finanzas/presupuestos/${id}`);
    return ok(undefined, "Presupuesto guardado");
  });
}

export async function setQuoteStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(quoteStatuses).safeParse(status);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext("finances");
    const { data: lines } = await ctx.supabase.from("quote_lines").select("id").eq("quote_id", id).limit(1);
    if (parsed.data !== "borrador" && !lines?.length) return fail("Añade al menos una línea antes de cambiar el estado.");
    const { error } = await ctx.supabase.from("quotes").update({ status: parsed.data }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    revalidateFinance();
    revalidatePath(`/finanzas/presupuestos/${id}`);
    return ok(undefined, "Estado actualizado");
  });
}

export async function convertQuoteToProject(id: string): Promise<ActionResult<{ projectId: string }>> {
  return run(async () => {
    const ctx = await actionContext("finances");
    const { data, error } = await ctx.supabase.rpc("convert_quote_to_project", { p_quote: id });
    if (error) return fromDbError(error);
    revalidateFinance();
    revalidatePath("/proyectos");
    return ok({ projectId: data as string }, "Proyecto creado a partir del presupuesto");
  });
}

export async function duplicateQuote(id: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await actionContext("finances");
    const { data: q } = await ctx.supabase.from("quotes").select("*").eq("id", id).single();
    if (!q) return fail("Presupuesto no encontrado.");
    const { data: lines } = await ctx.supabase.from("quote_lines").select("*").eq("quote_id", id).order("position");
    const { data: copy, error } = await ctx.supabase
      .from("quotes")
      .insert({
        company_id: ctx.company.id,
        created_by: ctx.userId,
        title: `${q.title} (copia)`,
        client_id: q.client_id,
        notes: q.notes,
        terms: q.terms,
        issue_date: todayISO(),
      })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    if (lines?.length) {
      await ctx.supabase.from("quote_lines").insert(
        lines.map((l) => ({
          quote_id: copy.id,
          position: l.position,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          tax_pct: l.tax_pct,
        })),
      );
    }
    revalidateFinance();
    return ok({ id: copy.id as string }, "Presupuesto duplicado");
  });
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase.from("quotes").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar el presupuesto.");
    revalidateFinance();
    return ok(undefined, "Presupuesto eliminado");
  });
}

/** Register what the client owes for an accepted quote (no money counted yet). */
export async function createReceivableFromQuote(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("finances");
    const { data: q } = await ctx.supabase.from("quotes").select("*").eq("id", id).single();
    if (!q) return fail("Presupuesto no encontrado.");
    if (q.status !== "aceptado") return fail("Solo se registra la facturación de presupuestos aceptados.");
    const { data: existing } = await ctx.supabase.from("receivables").select("id").eq("quote_id", id).limit(1);
    if (existing?.length) return fail("Este presupuesto ya tiene un cobro registrado.");
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const { error } = await ctx.supabase.from("receivables").insert({
      company_id: ctx.company.id,
      created_by: ctx.userId,
      quote_id: id,
      client_id: q.client_id,
      project_id: q.project_id,
      concept: `${q.number} · ${q.title}`,
      amount: q.total,
      issue_date: todayISO(),
      due_date: due.toISOString().slice(0, 10),
    });
    if (error) return fromDbError(error);
    revalidateFinance();
    return ok(undefined, "Cobro pendiente registrado");
  });
}

// ---------------------------------------------------------------------------
// Receivables + payments
// ---------------------------------------------------------------------------
export async function saveReceivable(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = receivableSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const { error } = id
      ? await ctx.supabase.from("receivables").update(parsed.data).eq("id", id).eq("company_id", ctx.company.id)
      : await ctx.supabase.from("receivables").insert({ ...parsed.data, company_id: ctx.company.id, created_by: ctx.userId });
    if (error) {
      if (error.message.includes("receivables_paid_range")) {
        return fail("El importe no puede ser menor que lo ya cobrado.", { amount: "Menor que lo ya cobrado" });
      }
      return fromDbError(error);
    }
    revalidateFinance();
    return ok(undefined, id ? "Cobro actualizado" : "Cobro registrado");
  });
}

export async function deleteReceivable(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase.from("receivables").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) {
      if (error.code === "23503") return fail("Tiene pagos registrados. Elimina primero los pagos.");
      return fromDbError(error);
    }
    if (!count) return fail("No se pudo eliminar.");
    revalidateFinance();
    return ok(undefined, "Cobro eliminado");
  });
}

export async function addPayment(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const { error } = await ctx.supabase
      .from("payments")
      .insert({ ...parsed.data, company_id: ctx.company.id, created_by: ctx.userId });
    if (error) {
      if (error.code === "23505") return fail("Ya existe un pago con esa referencia.", { reference: "Referencia duplicada" });
      return fromDbError(error);
    }
    revalidateFinance();
    return ok(undefined, "Pago registrado");
  });
}

export async function deletePayment(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase.from("payments").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar el pago.");
    revalidateFinance();
    return ok(undefined, "Pago eliminado");
  });
}

export async function listPayments(receivableId: string): Promise<ActionResult<{ id: string; amount: number; paid_at: string; method: string; reference: string | null }[]>> {
  return run(async () => {
    const ctx = await actionContext("finances");
    const { data, error } = await ctx.supabase
      .from("payments")
      .select("id, amount, paid_at, method, reference")
      .eq("receivable_id", receivableId)
      .order("paid_at");
    if (error) return fromDbError(error);
    return ok((data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as never);
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export async function saveExpense(id: string | null, input: unknown, receiptFileId?: string | null): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("finances");
    const values = {
      ...parsed.data,
      tax_amount: parsed.data.tax_amount ?? 0,
      ...(receiptFileId !== undefined ? { receipt_file_id: receiptFileId } : {}),
    };
    if (id) {
      const { error } = await ctx.supabase.from("expenses").update(values).eq("id", id).eq("company_id", ctx.company.id);
      if (error) return fromDbError(error);
      revalidateFinance();
      return ok({ id }, "Gasto actualizado");
    }
    const { data, error } = await ctx.supabase
      .from("expenses")
      .insert({ ...values, company_id: ctx.company.id, created_by: ctx.userId })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    revalidateFinance();
    return ok({ id: data.id as string }, "Gasto registrado");
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase.from("expenses").delete({ count: "exact" }).eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar el gasto.");
    revalidateFinance();
    return ok(undefined, "Gasto eliminado");
  });
}
