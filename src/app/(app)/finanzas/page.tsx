import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { ExportButton } from "@/components/shared/export-button";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/periods";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Panel } from "@/components/shared/info-list";
import { MonthlyChart, type MonthlyPoint } from "@/components/charts/monthly-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PeriodSelect } from "../period-select";

export const metadata: Metadata = { title: "Finanzas" };

interface Summary {
  invoiced: number;
  collected: number;
  pending: number;
  overdue: number;
  expenses: number;
  profit: number;
}
interface Profitability {
  project_id: string;
  project_name: string;
  budget: number;
  invoiced: number;
  collected: number;
  expenses: number;
  profit: number;
}

export default async function FinancePage({ searchParams }: PageProps<"/finanzas">) {
  const ctx = await requireCapability("finances");
  const { periodo } = await searchParams;
  const period = resolvePeriod(typeof periodo === "string" ? periodo : undefined);
  const supabase = await createClient();
  const c = ctx.company.currency;

  const [summary, monthly, profitability, expensesByCat] = await Promise.all([
    supabase.rpc("finance_summary", { p_company: ctx.company.id, p_from: period.from, p_to: period.to }),
    supabase.rpc("finance_monthly", { p_company: ctx.company.id, p_months: 12 }),
    supabase.rpc("project_profitability", { p_company: ctx.company.id }),
    supabase
      .from("expenses")
      .select("amount, tax_amount, category:expense_categories(name, color)")
      .eq("company_id", ctx.company.id)
      .gte("expense_date", period.from)
      .lte("expense_date", period.to)
      .returns<{ amount: number; tax_amount: number; category: { name: string; color: string } | null }[]>(),
  ]);

  const s = (summary.data as Summary[] | null)?.[0] ?? { invoiced: 0, collected: 0, pending: 0, overdue: 0, expenses: 0, profit: 0 };
  const months = ((monthly.data as MonthlyPoint[] | null) ?? []).map((m) => ({
    month: m.month,
    invoiced: Number(m.invoiced),
    collected: Number(m.collected),
    expenses: Number(m.expenses),
    profit: Number(m.profit),
  }));
  const projects = ((profitability.data as Profitability[] | null) ?? []).filter(
    (p) => Number(p.invoiced) || Number(p.expenses) || Number(p.budget),
  );

  const byCategory = new Map<string, { name: string; color: string; value: number }>();
  for (const e of expensesByCat.data ?? []) {
    const key = e.category?.name ?? "Sin categoría";
    const entry = byCategory.get(key) ?? { name: key, color: e.category?.color ?? "#a1a1aa", value: 0 };
    entry.value += Number(e.amount) + Number(e.tax_amount);
    byCategory.set(key, entry);
  }

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Lo que genera la empresa y lo que queda pendiente de cobrar."
        actions={
          <>
            <PeriodSelect value={period.key} />
            <ExportButton tipo="cobros" label="Cobros CSV" from={period.from} to={period.to} />
            <ExportButton tipo="gastos" label="Gastos CSV" from={period.from} to={period.to} />
            <ExportButton tipo="presupuestos" label="Presupuestos CSV" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Facturación registrada" value={formatMoney(s.invoiced, c)} hint="Cobros emitidos en el periodo" />
        <StatCard label="Cobros recibidos" value={formatMoney(s.collected, c)} hint="Dinero que ha entrado" href="/finanzas/cobros" />
        <StatCard label="Pendiente de cobro" value={formatMoney(s.pending, c)} hint="Total abierto hoy" href="/finanzas/cobros" />
        <StatCard label="Vencido" value={formatMoney(s.overdue, c)} tone={Number(s.overdue) > 0 ? "danger" : undefined} hint="Pendiente fuera de plazo" />
        <StatCard label="Gastos" value={formatMoney(s.expenses, c)} hint="Base + impuestos" href="/finanzas/gastos" />
        <StatCard label="Beneficio estimado" value={formatMoney(s.profit, c)} tone={Number(s.profit) < 0 ? "danger" : "success"} hint="Cobrado − gastos" />
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        Los presupuestos nunca cuentan como ingreso. La facturación registrada es lo que se ha pedido cobrar; el beneficio
        estimado usa solo el dinero realmente cobrado menos los gastos (criterio de caja). No sustituye a la contabilidad oficial.
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title="Evolución mensual · últimos 12 meses">
          <MonthlyChart data={months} currency={c} showInvoiced height={300} />
        </Panel>
        <Panel title={`Gastos por categoría · ${period.label.toLowerCase()}`}>
          <CategoryChart data={[...byCategory.values()].sort((a, b) => b.value - a.value)} currency={c} />
        </Panel>
      </div>

      <Panel title="Rentabilidad por proyecto" className="mt-5" bodyClassName="p-0">
        {projects.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Cuando registres cobros o gastos vinculados a proyectos, aparecerán aquí.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Proyecto</th>
                  <th className="px-4 py-2 text-right font-medium">Presupuesto</th>
                  <th className="px-4 py-2 text-right font-medium">Facturado</th>
                  <th className="px-4 py-2 text-right font-medium">Cobrado</th>
                  <th className="px-4 py-2 text-right font-medium">Gastos</th>
                  <th className="px-4 py-2 text-right font-medium">Beneficio</th>
                  <th className="px-4 py-2 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const margin = Number(p.collected) > 0 ? (Number(p.profit) / Number(p.collected)) * 100 : null;
                  return (
                    <tr key={p.project_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <Link href={`/proyectos/${p.project_id}?tab=finanzas`} className="font-medium hover:underline">
                          {p.project_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{formatMoney(p.budget, c)}</td>
                      <td className="px-4 py-2.5 text-right tabular">{formatMoney(p.invoiced, c)}</td>
                      <td className="px-4 py-2.5 text-right tabular">{formatMoney(p.collected, c)}</td>
                      <td className="px-4 py-2.5 text-right tabular">{formatMoney(p.expenses, c)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-medium tabular", Number(p.profit) < 0 && "text-destructive")}>
                        {formatMoney(p.profit, c)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{margin === null ? "—" : `${margin.toFixed(0)} %`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
