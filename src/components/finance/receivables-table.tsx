"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTable } from "@/components/shared/sortable-table";
import { OptionBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useApp } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { ReceivableFormDialog } from "@/components/finance/receivable-form-dialog";
import { PaymentDialog } from "@/components/finance/payment-dialog";
import { deleteReceivable } from "@/lib/actions/finance";
import { receivableStatusMap } from "@/lib/labels";
import { formatDate, formatMoney } from "@/lib/format";
import type { ReceivableWithStatus } from "@/types/database";

export type ReceivableRow = ReceivableWithStatus & {
  client?: { name: string } | null;
  project?: { name: string } | null;
};

export function ReceivablesTable({ rows, hideProject }: { rows: ReceivableRow[]; hideProject?: boolean }) {
  const router = useRouter();
  const { company, permissions } = useApp();
  const [paying, setPaying] = useState<ReceivableRow | null>(null);
  const [editing, setEditing] = useState<ReceivableRow | null>(null);

  return (
    <>
      <SortableTable
        rows={rows}
        initialSort={{ key: "due", dir: "asc" }}
        empty={<EmptyState compact icon={HandCoins} title="No hay cobros registrados" description="Registra lo que te deben los clientes y después cada pago recibido." />}
        columns={[
          {
            key: "concept",
            header: "Concepto",
            sortValue: (r) => r.concept,
            cell: (r) => (
              <div className="min-w-0">
                <p className="font-medium">{r.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.client?.name, hideProject ? null : r.project?.name, r.reference].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            ),
          },
          { key: "status", header: "Estado", sortValue: (r) => r.status, cell: (r) => <OptionBadge value={r.status} map={receivableStatusMap} /> },
          { key: "issue", header: "Fecha", sortValue: (r) => r.issue_date, cell: (r) => formatDate(r.issue_date) },
          {
            key: "due",
            header: "Vencimiento",
            sortValue: (r) => (r.status === "pagado" ? null : r.due_date),
            cell: (r) => <span className={r.status === "vencido" ? "font-medium text-destructive" : undefined}>{formatDate(r.due_date)}</span>,
          },
          {
            key: "amount",
            header: "Importe",
            sortValue: (r) => Number(r.amount),
            cell: (r) => formatMoney(r.amount, company.currency),
            className: "text-right tabular",
            headerClassName: "text-right",
          },
          {
            key: "paid",
            header: "Cobrado",
            sortValue: (r) => Number(r.amount_paid),
            cell: (r) => formatMoney(r.amount_paid, company.currency),
            className: "text-right tabular text-muted-foreground",
            headerClassName: "text-right",
          },
          {
            key: "pending",
            header: "Pendiente",
            sortValue: (r) => Number(r.amount_pending),
            cell: (r) => <span className={Number(r.amount_pending) > 0 ? "font-medium" : "text-muted-foreground"}>{formatMoney(r.amount_pending, company.currency)}</span>,
            className: "text-right tabular",
            headerClassName: "text-right",
          },
          {
            key: "actions",
            header: "",
            cell: (r) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {r.status !== "pagado" ? (
                  <Button size="xs" variant="outline" onClick={() => setPaying(r)}>
                    <HandCoins /> Pago
                  </Button>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => setPaying(r)}>
                    Ver pagos
                  </Button>
                )}
                <ConfirmDialog
                  title="¿Eliminar este cobro?"
                  description="Solo es posible si no tiene pagos registrados."
                  onConfirm={async () => {
                    const res = await runAction(deleteReceivable(r.id));
                    if (res.ok) router.refresh();
                  }}
                  trigger={(openDelete) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="Más" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(r)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        {permissions.isAdmin ? (
                          <DropdownMenuItem variant="destructive" onClick={openDelete}>
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                />
              </div>
            ),
          },
        ]}
      />
      <PaymentDialog receivable={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <ReceivableFormDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} receivable={editing ?? undefined} />
    </>
  );
}
