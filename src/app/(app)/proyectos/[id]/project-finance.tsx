import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/shared/info-list";
import { ReceivablesTable, type ReceivableRow } from "@/components/finance/receivables-table";
import { ExpensesTable, type ExpenseRow } from "@/components/finance/expenses-table";
import { formatMoney } from "@/lib/format";
import { FinanceButtons } from "./finance-buttons";

export async function ProjectFinance({ projectId, budget, clientId }: { projectId: string; budget: number | null; clientId: string | null }) {
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const [receivables, expenses] = await Promise.all([
    supabase
      .from("receivables_with_status")
      .select("*, client:clients(name)")
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false })
      .returns<ReceivableRow[]>(),
    supabase
      .from("expenses")
      .select("*, category:expense_categories(name, color)")
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false })
      .returns<ExpenseRow[]>(),
  ]);

  const invoiced = (receivables.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const collected = (receivables.data ?? []).reduce((s, r) => s + Number(r.amount_paid), 0);
  const spent = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount) + Number(e.tax_amount), 0);
  const c = ctx.company.currency;

  const stats = [
    { label: "Presupuesto acordado", value: budget != null ? formatMoney(budget, c) : "—", hint: "No es un ingreso" },
    { label: "Facturación registrada", value: formatMoney(invoiced, c) },
    { label: "Cobrado", value: formatMoney(collected, c) },
    { label: "Pendiente de cobro", value: formatMoney(invoiced - collected, c) },
    { label: "Gastos", value: formatMoney(spent, c) },
    { label: "Beneficio estimado", value: formatMoney(collected - spent, c), hint: "Cobrado − gastos", strong: true },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-0.5 font-semibold tabular ${s.strong ? "text-lg" : ""}`}>{s.value}</p>
            {s.hint ? <p className="text-[11px] text-muted-foreground">{s.hint}</p> : null}
          </div>
        ))}
      </div>
      <Panel title="Cobros" action={<FinanceButtons kind="receivable" projectId={projectId} clientId={clientId} />} bodyClassName="p-0 [&>div]:rounded-none [&>div]:border-0">
        <ReceivablesTable rows={receivables.data ?? []} hideProject />
      </Panel>
      <Panel title="Gastos vinculados" action={<FinanceButtons kind="expense" projectId={projectId} clientId={clientId} />} bodyClassName="p-0 [&>div]:rounded-none [&>div]:border-0">
        <ExpensesTable rows={expenses.data ?? []} hideProject />
      </Panel>
    </div>
  );
}
