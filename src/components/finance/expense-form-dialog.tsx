"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { useApp } from "@/components/app-provider";
import { uploadFile } from "@/components/files/file-uploader";
import { expenseSchema } from "@/lib/validation/finance";
import { saveExpense } from "@/lib/actions/finance";
import { todayISO } from "@/lib/format";
import type { Expense } from "@/types/database";

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense?: Expense;
  defaults?: { project_id?: string | null };
}) {
  const router = useRouter();
  const lookups = useLookups(open);
  const { company } = useApp();
  const [receipt, setReceipt] = useState<File | null>(null);

  const getDefaults = () => ({
    concept: expense?.concept ?? "",
    category_id: expense?.category_id ?? null,
    amount: expense ? String(expense.amount) : "",
    tax_amount: expense ? String(expense.tax_amount) : "",
    expense_date: expense?.expense_date ?? todayISO(),
    supplier: expense?.supplier ?? "",
    project_id: expense?.project_id ?? defaults?.project_id ?? null,
    notes: expense?.notes ?? "",
  });

  const { form, onSubmit, pending } = useActionForm({
    schema: expenseSchema,
    defaultValues: getDefaults(),
    action: async (v) => {
      let receiptId: string | null | undefined;
      if (receipt) {
        receiptId = await uploadFile(company.id, receipt, "justificante", { project_id: v.project_id, is_finance: true });
        if (!receiptId) return { ok: false as const, error: "No se pudo subir el justificante." };
      }
      return saveExpense(expense?.id ?? null, v, receiptId);
    },
    onSuccess: () => {
      onOpenChange(false);
      setReceipt(null);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, getDefaults);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReceipt(null);
        onOpenChange(o);
      }}
      title={expense ? "Editar gasto" : "Registrar gasto"}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={expense ? "Guardar" : "Registrar"}
    >
      <TextField form={form} name="concept" label="Concepto" required autoFocus placeholder="Licencia Figma" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          form={form}
          name="category_id"
          label="Categoría"
          allowEmpty
          emptyLabel="Sin categoría"
          options={lookups.expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextField form={form} name="supplier" label="Proveedor" />
        <TextField form={form} name="amount" label="Base imponible (€)" inputMode="decimal" required placeholder="0,00" />
        <TextField form={form} name="tax_amount" label="Impuestos (€)" inputMode="decimal" placeholder="0,00" hint="IVA soportado, si lo hay" />
        <TextField form={form} name="expense_date" label="Fecha" type="date" required />
        <SelectField
          form={form}
          name="project_id"
          label="Proyecto asociado"
          allowEmpty
          emptyLabel="Gasto general"
          options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      <FormField label="Justificante" hint={expense?.receipt_file_id && !receipt ? "Ya tiene un justificante. Sube otro para reemplazarlo." : "PDF o imagen, máx. 50 MB"}>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
          <Paperclip className="size-4" />
          <span className="truncate">{receipt ? receipt.name : "Adjuntar archivo"}</span>
          <input
            type="file"
            hidden
            accept="application/pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 50 * 1024 * 1024) {
                toast.error("El archivo supera 50 MB.");
                return;
              }
              setReceipt(f);
            }}
          />
        </label>
      </FormField>
      <TextareaField form={form} name="notes" label="Notas" rows={2} />
    </FormDialog>
  );
}
