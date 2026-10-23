"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { ReceivablesTable, type ReceivableRow } from "@/components/finance/receivables-table";
import { ReceivableFormDialog } from "@/components/finance/receivable-form-dialog";
import { useApp } from "@/components/app-provider";
import { receivableStatusOptions } from "@/lib/labels";
import { formatMoney } from "@/lib/format";

export function ReceivablesView({ rows }: { rows: ReceivableRow[] }) {
  const { company } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ status: null });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return rows.filter(
      (r) =>
        (!filters.status || r.status === filters.status) &&
        (!q || [r.concept, r.client?.name, r.project?.name, r.reference].some((v) => normalize(v).includes(q))),
    );
  }, [rows, search, filters]);

  const totals = filtered.reduce(
    (acc, r) => ({ amount: acc.amount + Number(r.amount), paid: acc.paid + Number(r.amount_paid), pending: acc.pending + Number(r.amount_pending) }),
    { amount: 0, paid: 0, pending: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar concepto, cliente, referencia…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[{ key: "status", label: "Todos los estados", options: receivableStatusOptions.map((o) => ({ value: o.value, label: o.label })) }]}
        />
        <div className="flex gap-2">
          <ExportButton tipo="cobros" />
          <Button onClick={() => setOpen(true)}>
            <Plus /> Registrar cobro
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          Facturado: <strong className="text-foreground tabular">{formatMoney(totals.amount, company.currency)}</strong>
        </span>
        <span>
          Cobrado: <strong className="text-foreground tabular">{formatMoney(totals.paid, company.currency)}</strong>
        </span>
        <span>
          Pendiente: <strong className="text-foreground tabular">{formatMoney(totals.pending, company.currency)}</strong>
        </span>
      </div>
      <ReceivablesTable rows={filtered} />
      <ReceivableFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
