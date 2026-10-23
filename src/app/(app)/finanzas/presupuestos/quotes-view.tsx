"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { SortableTable } from "@/components/shared/sortable-table";
import { OptionBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useApp } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { quoteStatusMap, quoteStatusOptions } from "@/lib/labels";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import type { QuoteStatus } from "@/types/database";

export interface QuoteRow {
  id: string;
  number: string;
  title: string;
  status: QuoteStatus;
  total: number;
  issue_date: string;
  valid_until: string | null;
  project_id: string | null;
  client: { name: string } | null;
}

export function QuotesView({ rows }: { rows: QuoteRow[] }) {
  const router = useRouter();
  const create = useCreate();
  const { company } = useApp();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ status: null });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return rows.filter(
      (r) => (!filters.status || r.status === filters.status) && (!q || [r.number, r.title, r.client?.name].some((v) => normalize(v).includes(q))),
    );
  }, [rows, search, filters]);

  const accepted = rows.filter((r) => r.status === "aceptado").reduce((s, r) => s + Number(r.total), 0);
  const open = rows.filter((r) => r.status === "enviado").reduce((s, r) => s + Number(r.total), 0);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aún no hay presupuestos"
        description="Crea un presupuesto con sus conceptos, descuentos e impuestos, y conviértelo en proyecto cuando el cliente lo acepte."
        action={<Button onClick={() => create({ kind: "quote" })}>Crear presupuesto</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar número, título o cliente…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[{ key: "status", label: "Todos los estados", options: quoteStatusOptions.map((o) => ({ value: o.value, label: o.label })) }]}
        />
        <Button onClick={() => create({ kind: "quote" })}>
          <Plus /> Nuevo presupuesto
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          Enviados (en espera): <strong className="text-foreground tabular">{formatMoney(open, company.currency)}</strong>
        </span>
        <span>
          Aceptados: <strong className="text-foreground tabular">{formatMoney(accepted, company.currency)}</strong>
        </span>
      </div>
      <SortableTable
        rows={filtered}
        onRowClick={(r) => router.push(`/finanzas/presupuestos/${r.id}`)}
        initialSort={{ key: "issue", dir: "desc" }}
        empty={<EmptyState compact title="Ningún presupuesto coincide con los filtros" />}
        columns={[
          { key: "number", header: "Número", sortValue: (r) => r.number, cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
          {
            key: "title",
            header: "Presupuesto",
            sortValue: (r) => r.title,
            cell: (r) => (
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.client?.name ?? "Sin cliente"}</p>
              </div>
            ),
          },
          { key: "status", header: "Estado", sortValue: (r) => r.status, cell: (r) => <OptionBadge value={r.status} map={quoteStatusMap} /> },
          { key: "issue", header: "Emisión", sortValue: (r) => r.issue_date, cell: (r) => formatDate(r.issue_date) },
          {
            key: "valid",
            header: "Válido hasta",
            sortValue: (r) => r.valid_until,
            cell: (r) => (
              <span className={r.status === "enviado" && isOverdue(r.valid_until) ? "font-medium text-destructive" : undefined}>{formatDate(r.valid_until)}</span>
            ),
          },
          {
            key: "total",
            header: "Total",
            sortValue: (r) => Number(r.total),
            cell: (r) => <span className="font-medium">{formatMoney(r.total, company.currency)}</span>,
            className: "text-right tabular",
            headerClassName: "text-right",
          },
        ]}
      />
    </div>
  );
}
