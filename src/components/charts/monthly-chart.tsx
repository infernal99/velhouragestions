"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactMoney, formatDate, formatMoney } from "@/lib/format";

export interface MonthlyPoint {
  month: string;
  invoiced: number;
  collected: number;
  expenses: number;
  profit: number;
}

function TooltipBox({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium capitalize">{formatDate(label ?? "", "MMMM yyyy")}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular">{formatMoney(p.value, currency)}</span>
        </p>
      ))}
    </div>
  );
}

/** Collected vs expenses (bars) with estimated profit (line). */
export function MonthlyChart({ data, currency, showInvoiced = false, height = 260 }: { data: MonthlyPoint[]; currency: string; showInvoiced?: boolean; height?: number }) {
  const empty = data.every((d) => !d.invoiced && !d.collected && !d.expenses);
  if (empty) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>
        Aún no hay cobros ni gastos registrados en este periodo.
      </div>
    );
  }
  const Chart = showInvoiced ? ComposedChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => formatDate(v, "MMM")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: number) => formatCompactMoney(v, currency)}
        />
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<TooltipBox currency={currency} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {showInvoiced ? <Bar dataKey="invoiced" name="Facturado" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={22} /> : null}
        <Bar dataKey="collected" name="Cobrado" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expenses" name="Gastos" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        {showInvoiced ? <Line dataKey="profit" name="Beneficio" stroke="var(--chart-2)" strokeWidth={2} dot={false} type="monotone" /> : null}
      </Chart>
    </ResponsiveContainer>
  );
}
