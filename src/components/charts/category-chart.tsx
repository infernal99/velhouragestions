"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format";

export function CategoryChart({ data, currency }: { data: { name: string; color: string; value: number }[]; currency: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sin gastos en este periodo.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="text-xs text-muted-foreground tabular">{((d.value / total) * 100).toFixed(0)} %</span>
            <span className="w-24 text-right tabular">{formatMoney(d.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
