"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { receivableSchema } from "@/lib/validation/finance";
import { saveReceivable } from "@/lib/actions/finance";
import { todayISO } from "@/lib/format";
import type { Receivable } from "@/types/database";

export function ReceivableFormDialog({
  open,
  onOpenChange,
  receivable,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  receivable?: Receivable;
  defaults?: { project_id?: string | null; client_id?: string | null };
}) {
  const router = useRouter();
  const lookups = useLookups(open);
  const getDefaults = () => ({
    concept: receivable?.concept ?? "",
    client_id: receivable?.client_id ?? defaults?.client_id ?? null,
    project_id: receivable?.project_id ?? defaults?.project_id ?? null,
    amount: receivable ? String(receivable.amount) : "",
    issue_date: receivable?.issue_date ?? todayISO(),
    due_date: receivable?.due_date ?? "",
    reference: receivable?.reference ?? "",
    notes: receivable?.notes ?? "",
  });
  const { form, onSubmit, pending } = useActionForm({
    schema: receivableSchema,
    defaultValues: getDefaults(),
    action: (v) => saveReceivable(receivable?.id ?? null, v),
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, getDefaults);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={receivable ? "Editar cobro" : "Registrar cobro pendiente"}
      description="Importe que el cliente debe pagar. Los pagos recibidos se registran aparte, y pueden ser parciales."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={receivable ? "Guardar" : "Registrar"}
    >
      <TextField form={form} name="concept" label="Concepto" placeholder="50% inicial web corporativa" required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField form={form} name="client_id" label="Cliente" allowEmpty emptyLabel="Sin cliente" options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField form={form} name="project_id" label="Proyecto" allowEmpty emptyLabel="Sin proyecto" options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))} />
        <TextField form={form} name="amount" label="Importe total (€)" inputMode="decimal" placeholder="0,00" required />
        <TextField form={form} name="reference" label="Referencia" placeholder="Nº de factura o pedido" />
        <TextField form={form} name="issue_date" label="Fecha" type="date" required />
        <TextField form={form} name="due_date" label="Vencimiento" type="date" />
      </div>
      <TextareaField form={form} name="notes" label="Notas" rows={2} />
    </FormDialog>
  );
}
