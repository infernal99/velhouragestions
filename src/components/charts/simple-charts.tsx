"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactMoney, formatMoney } from "@/lib/format";

export interface Slice {
  name: string;
  value: number;
  color: string;
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 16px rgb(0 0 0 / 0.12)",
};

function Empty({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="grid place-items-center text-center text-sm text-muted-foreground" style={{ height }}>
      {children}
    </div>
  );
}

/** Donut with a big total in the middle and a legend. */
export function DonutChart({ data, centerLabel, height = 200 }: { data: Slice[]; centerLabel: string; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty height={height}>Sin datos todavía.</Empty>;
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={shown.length > 1 ? 3 : 0}
              stroke="none"
              cornerRadius={4}
            >
              {shown.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [String(v), String(n)]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-3xl font-semibold tracking-tight tabular">{total}</p>
            <p className="text-xs text-muted-foreground">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-medium tabular">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars, one colour per row. `money` formats values as currency. */
export function HBarChart({
  data,
  height = 220,
  money,
  currency = "EUR",
  empty = "Sin datos todavía.",
}: {
  data: Slice[];
  height?: number;
  money?: boolean;
  currency?: string;
  empty?: string;
}) {
  if (data.every((d) => d.value === 0)) return <Empty height={height}>{empty}</Empty>;
  const fmt = (v: number) => (money ? formatCompactMoney(v, currency) : String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={tooltipStyle}
          formatter={(v) => (money ? formatMoney(Number(v), currency) : String(v))}
        />
        <Bar
          dataKey="value"
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
          label={{ position: "right", fontSize: 11, fill: "var(--muted-foreground)", formatter: (v: unknown) => fmt(Number(v)) }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical columns (e.g. hours per day). */
export function ColumnChart({
  data,
  color = "var(--brand)",
  height = 200,
  unit = "h",
  empty = "Sin horas en este periodo.",
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  unit?: string;
  empty?: string;
}) {
  if (data.every((d) => d.value === 0)) return <Empty height={height}>{empty}</Empty>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} contentStyle={tooltipStyle} formatter={(v) => [`${v} ${unit}`, "Horas"]} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two stacked horizontal bars per row (e.g. collected + pending per client). */
export function StackedHBar({
  data,
  aLabel,
  bLabel,
  aColor,
  bColor,
  currency = "EUR",
  height = 240,
}: {
  data: { name: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  aColor: string;
  bColor: string;
  currency?: string;
  height?: number;
}) {
  if (data.every((d) => d.a === 0 && d.b === 0)) return <Empty height={height}>Cuando haya cobros aparecerán aquí.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={10}>
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => formatCompactMoney(v, currency)} />
        <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v), currency)} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="a" name={aLabel} stackId="s" fill={aColor} maxBarSize={22} />
        <Bar dataKey="b" name={bLabel} stackId="s" fill={bColor} radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
