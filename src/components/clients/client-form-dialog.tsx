"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { clientSchema } from "@/lib/validation/crm";
import { saveClient } from "@/lib/actions/clients";
import { crmStageOptions } from "@/lib/labels";
import type { Client } from "@/types/database";

function toDefaults(client?: Partial<Client>) {
  return {
    name: client?.name ?? "",
    contact_name: client?.contact_name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    legal_name: client?.legal_name ?? "",
    tax_id: client?.tax_id ?? "",
    address: client?.address ?? "",
    website: client?.website ?? "",
    sector: client?.sector ?? "",
    stage: client?.stage ?? "nuevo",
    source: client?.source ?? "",
    owner_id: client?.owner_id ?? null,
    notes: client?.notes ?? "",
    next_action: client?.next_action ?? "",
    next_action_date: client?.next_action_date ?? "",
    estimated_value: client?.estimated_value != null ? String(client.estimated_value) : "",
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { team } = useApp();
  const { form, onSubmit, pending } = useActionForm({
    schema: clientSchema,
    defaultValues: toDefaults(client),
    action: (values) => saveClient(client?.id ?? null, values),
    onSuccess: (data) => {
      onOpenChange(false);
      if (onSaved) onSaved(data.id);
      else router.refresh();
    },
  });

  useResetOnOpen(open, form, () => toDefaults(client));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={client ? "Editar cliente" : "Nuevo cliente"}
      onSubmit={onSubmit}
      pending={pending}
      size="lg"
      submitLabel={client ? "Guardar cambios" : "Crear cliente"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="name" label="Cliente o empresa" required autoFocus className="sm:col-span-2" />
        <TextField form={form} name="contact_name" label="Persona de contacto" />
        <TextField form={form} name="email" label="Correo electrónico" type="email" />
        <TextField form={form} name="phone" label="Teléfono" type="tel" />
        <TextField form={form} name="website" label="Web" placeholder="https://" />
        <SelectField
          form={form}
          name="stage"
          label="Estado comercial"
          options={crmStageOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <SelectField
          form={form}
          name="owner_id"
          label="Responsable"
          allowEmpty
          options={team.map((m) => ({ value: m.id, label: m.full_name || m.email }))}
        />
        <TextField form={form} name="source" label="Origen del contacto" placeholder="Recomendación, web, LinkedIn…" />
        <TextField form={form} name="estimated_value" label="Valor estimado (€)" inputMode="decimal" placeholder="0,00" />
        <TextField form={form} name="next_action" label="Próxima acción" placeholder="Enviar propuesta" />
        <TextField form={form} name="next_action_date" label="Fecha de seguimiento" type="date" />
      </div>
      <details className="group rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:mb-3">
          Datos comerciales y fiscales
        </summary>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField form={form} name="legal_name" label="Razón social" />
          <TextField form={form} name="tax_id" label="NIF / CIF" />
          <TextField form={form} name="sector" label="Sector" />
          <TextField form={form} name="address" label="Dirección" />
        </div>
      </details>
      <TextareaField form={form} name="notes" label="Notas internas" rows={3} />
    </FormDialog>
  );
}
