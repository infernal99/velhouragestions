import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import type { ExpenseRow } from "@/components/finance/expenses-table";
import { ExpensesView } from "./expenses-view";

export const metadata: Metadata = { title: "Gastos" };

export default async function ExpensesPage() {
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const [{ data }, { data: categories }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, category:expense_categories(name, color), project:projects(name)")
      .eq("company_id", ctx.company.id)
      .order("expense_date", { ascending: false })
      .limit(2000)
      .returns<ExpenseRow[]>(),
    supabase.from("expense_categories").select("id, name").eq("company_id", ctx.company.id).order("name"),
  ]);

  return (
    <>
      <PageHeader title="Gastos" description="Gastos de la empresa, con categoría, proveedor, proyecto y justificante." />
      <ExpensesView rows={data ?? []} categories={(categories ?? []) as { id: string; name: string }[]} />
    </>
  );
}
