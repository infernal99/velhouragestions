"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { ExpensesTable, type ExpenseRow } from "@/components/finance/expenses-table";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { useApp } from "@/components/app-provider";
import { formatMoney } from "@/lib/format";

export function ExpensesView({ rows, categories }: { rows: ExpenseRow[]; categories: { id: string; name: string }[] }) {
  const { company } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ category: null, year: null });

  const years = useMemo(() => [...new Set(rows.map((r) => r.expense_date.slice(0, 4)))].sort().reverse(), [rows]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return rows.filter(
      (r) =>
        (!filters.category || r.category_id === filters.category) &&
        (!filters.year || r.expense_date.startsWith(filters.year)) &&
        (!q || [r.concept, r.supplier, r.project?.name].some((v) => normalize(v).includes(q))),
    );
  }, [rows, search, filters]);

  const base = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const tax = filtered.reduce((s, r) => s + Number(r.tax_amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar concepto, proveedor…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[
            { key: "category", label: "Todas las categorías", options: categories.map((c) => ({ value: c.id, label: c.name })) },
            { key: "year", label: "Todos los años", options: years.map((y) => ({ value: y, label: y })) },
          ]}
        />
        <div className="flex gap-2">
          <ExportButton tipo="gastos" />
          <Button onClick={() => setOpen(true)}>
            <Plus /> Registrar gasto
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          Base: <strong className="text-foreground tabular">{formatMoney(base, company.currency)}</strong>
        </span>
        <span>
          Impuestos: <strong className="text-foreground tabular">{formatMoney(tax, company.currency)}</strong>
        </span>
        <span>
          Total: <strong className="text-foreground tabular">{formatMoney(base + tax, company.currency)}</strong>
        </span>
      </div>
      <ExpensesTable rows={filtered} />
      <ExpenseFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
