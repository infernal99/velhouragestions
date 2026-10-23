"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Paperclip, Pencil, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTable } from "@/components/shared/sortable-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useApp } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { deleteExpense } from "@/lib/actions/finance";
import { getFileUrl } from "@/lib/actions/files";
import { formatDate, formatMoney } from "@/lib/format";
import type { Expense } from "@/types/database";

export type ExpenseRow = Expense & {
  category?: { name: string; color: string } | null;
  project?: { name: string } | null;
};

export function ExpensesTable({ rows, hideProject }: { rows: ExpenseRow[]; hideProject?: boolean }) {
  const router = useRouter();
  const { company, permissions } = useApp();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  return (
    <>
      <SortableTable
        rows={rows}
        initialSort={{ key: "date", dir: "desc" }}
        empty={<EmptyState compact icon={Receipt} title="No hay gastos registrados" />}
        columns={[
          {
            key: "concept",
            header: "Concepto",
            sortValue: (e) => e.concept,
            cell: (e) => (
              <div>
                <p className="font-medium">{e.concept}</p>
                <p className="text-xs text-muted-foreground">{[e.supplier, hideProject ? null : e.project?.name].filter(Boolean).join(" · ") || "—"}</p>
              </div>
            ),
          },
          {
            key: "category",
            header: "Categoría",
            sortValue: (e) => e.category?.name,
            cell: (e) =>
              e.category ? (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="size-2 rounded-full" style={{ backgroundColor: e.category.color }} />
                  {e.category.name}
                </span>
              ) : (
                "—"
              ),
          },
          { key: "date", header: "Fecha", sortValue: (e) => e.expense_date, cell: (e) => formatDate(e.expense_date) },
          {
            key: "amount",
            header: "Base",
            sortValue: (e) => Number(e.amount),
            cell: (e) => formatMoney(e.amount, company.currency),
            className: "text-right tabular",
            headerClassName: "text-right",
          },
          {
            key: "tax",
            header: "Impuestos",
            sortValue: (e) => Number(e.tax_amount),
            cell: (e) => formatMoney(e.tax_amount, company.currency),
            className: "text-right tabular text-muted-foreground",
            headerClassName: "text-right",
          },
          {
            key: "total",
            header: "Total",
            sortValue: (e) => Number(e.amount) + Number(e.tax_amount),
            cell: (e) => <span className="font-medium">{formatMoney(Number(e.amount) + Number(e.tax_amount), company.currency)}</span>,
            className: "text-right tabular",
            headerClassName: "text-right",
          },
          {
            key: "actions",
            header: "",
            cell: (e) => (
              <div className="flex justify-end gap-1">
                {e.receipt_file_id ? (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Ver justificante"
                    onClick={async () => {
                      const res = await getFileUrl(e.receipt_file_id!);
                      if (res.ok) window.open(res.data.url, "_blank", "noopener");
                      else await runAction(Promise.resolve(res));
                    }}
                  >
                    <Paperclip />
                  </Button>
                ) : null}
                <ConfirmDialog
                  title="¿Eliminar este gasto?"
                  onConfirm={async () => {
                    const res = await runAction(deleteExpense(e.id));
                    if (res.ok) router.refresh();
                  }}
                  trigger={(openDelete) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="Más" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(e)}>
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
      <ExpenseFormDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} expense={editing ?? undefined} />
    </>
  );
}
