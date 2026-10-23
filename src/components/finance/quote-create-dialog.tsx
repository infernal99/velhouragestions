"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField, TextField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { quoteCreateSchema } from "@/lib/validation/finance";
import { createQuote } from "@/lib/actions/finance";

export function QuoteCreateDialog({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string | null;
}) {
  const router = useRouter();
  const lookups = useLookups(open);
  const defaults = () => ({ title: "", client_id: clientId ?? null });
  const { form, onSubmit, pending } = useActionForm({
    schema: quoteCreateSchema,
    defaultValues: defaults(),
    action: createQuote,
    onSuccess: (data) => {
      onOpenChange(false);
      router.push(`/finanzas/presupuestos/${data.id}`);
    },
  });
  useResetOnOpen(open, form, defaults);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo presupuesto"
      description="Después podrás añadir los conceptos y líneas de servicio."
      onSubmit={onSubmit}
      pending={pending}
      size="sm"
      submitLabel="Crear y editar"
    >
      <TextField form={form} name="title" label="Título" placeholder="Web corporativa para…" required autoFocus />
      <SelectField
        form={form}
        name="client_id"
        label="Cliente"
        allowEmpty
        emptyLabel="Sin cliente"
        options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))}
      />
    </FormDialog>
  );
}
