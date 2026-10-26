import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Money promised but not yet invoiced: quotes that were sent or accepted and
 * have no receivable ("cobro") created from them. It is NOT income and never
 * counts as collected; it is shown next to what is already owed so the
 * "pending" figure reflects everything that is on the table.
 */
export async function getQuotePipeline(supabase: Supabase, companyId: string) {
  const [{ data: quotes }, { data: invoiced }] = await Promise.all([
    supabase.from("quotes").select("id, total").eq("company_id", companyId).in("status", ["enviado", "aceptado"]),
    supabase.from("receivables").select("quote_id").eq("company_id", companyId).not("quote_id", "is", null),
  ]);
  const alreadyInvoiced = new Set((invoiced ?? []).map((r) => r.quote_id as string));
  const open = (quotes ?? []).filter((q) => !alreadyInvoiced.has(q.id as string));
  return { count: open.length, total: open.reduce((sum, q) => sum + Number(q.total), 0) };
}
