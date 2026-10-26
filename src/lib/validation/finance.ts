import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, parseDecimal, requiredDate, requiredMoney, requiredText } from "./common";

export const quoteStatuses = ["borrador", "enviado", "aceptado", "rechazado", "caducado"] as const;
export const paymentMethods = [
  "transferencia",
  "tarjeta",
  "efectivo",
  "bizum",
  "paypal",
  "stripe",
  "domiciliacion",
  "otro",
] as const;

const pct = z.preprocess(parseDecimal, z.number({ error: "Porcentaje no válido" }).min(0, "Mínimo 0").max(100, "Máximo 100"));

export const quoteLineSchema = z.object({
  description: requiredText(1000, "La descripción"),
  quantity: z.preprocess(parseDecimal, z.number({ error: "Cantidad no válida" }).positive("Debe ser mayor que 0").max(1_000_000)),
  unit_price: z.preprocess(parseDecimal, z.number({ error: "Precio no válido" }).min(0, "No puede ser negativo").max(10_000_000)),
  discount_pct: pct.default(0),
  tax_pct: pct.default(21),
});

export const quoteSchema = z
  .object({
    title: requiredText(200, "El título"),
    client_id: optionalUuid,
    issue_date: requiredDate,
    valid_until: optionalDate,
    notes: optionalText(5000),
    terms: optionalText(5000),
    lines: z.array(quoteLineSchema).min(1, "Añade al menos una línea").max(200),
  })
  .refine((v) => !v.valid_until || v.valid_until >= v.issue_date, {
    message: "La fecha de validez no puede ser anterior a la emisión",
    path: ["valid_until"],
  });

export const quoteCreateSchema = z.object({
  title: requiredText(200, "El título"),
  client_id: optionalUuid,
});

export const receivableSchema = z
  .object({
    concept: requiredText(300, "El concepto"),
    client_id: optionalUuid,
    project_id: optionalUuid,
    amount: requiredMoney,
    issue_date: requiredDate,
    due_date: optionalDate,
    reference: optionalText(100),
    notes: optionalText(2000),
  })
  .refine((v) => !v.due_date || v.due_date >= v.issue_date, {
    message: "El vencimiento no puede ser anterior a la fecha",
    path: ["due_date"],
  });

export const paymentSchema = z.object({
  receivable_id: z.uuid(),
  amount: requiredMoney,
  paid_at: requiredDate,
  method: z.enum(paymentMethods),
  reference: optionalText(100),
  notes: optionalText(1000),
});

export const recurringSchema = z.object({
  concept: requiredText(200, "El concepto"),
  client_id: optionalUuid,
  project_id: optionalUuid,
  amount: requiredMoney,
  status: z.enum(["activo", "pendiente", "pausado", "cancelado"]),
  start_date: requiredDate,
  notes: optionalText(1000),
});

export const expenseSchema = z.object({
  concept: requiredText(300, "El concepto"),
  category_id: optionalUuid,
  amount: requiredMoney,
  tax_amount: z.preprocess(
    parseDecimal,
    z.number({ error: "Importe no válido" }).min(0, "No puede ser negativo").max(99_999_999).nullable(),
  ),
  expense_date: requiredDate,
  supplier: optionalText(200),
  project_id: optionalUuid,
  notes: optionalText(2000),
});

/** Line + quote totals, same rounding as private.recalc_quote_totals. */
export function computeQuoteTotals(lines: { quantity: number; unit_price: number; discount_pct: number; tax_pct: number }[]) {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  let gross = 0;
  let net = 0;
  let taxRaw = 0;
  for (const l of lines) {
    const lineGross = l.quantity * l.unit_price;
    const lineNet = round(lineGross * (1 - l.discount_pct / 100));
    gross += lineGross;
    net += lineNet;
    taxRaw += (lineNet * l.tax_pct) / 100;
  }
  const subtotal = round(gross);
  const tax = round(taxRaw);
  return { subtotal, discount: round(subtotal - net), net: round(net), tax, total: round(net + tax) };
}
