"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { uploadFile } from "@/components/files/file-uploader";
import { useApp } from "@/components/app-provider";
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
  const { company } = useApp();
  const [invoice, setInvoice] = useState<File | null>(null);
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
    action: async (v) => {
      let invoiceId: string | null | undefined;
      if (invoice) {
        invoiceId = await uploadFile(company.id, invoice, "factura", { project_id: v.project_id, client_id: v.client_id, is_finance: true });
        if (!invoiceId) return { ok: false as const, error: "No se pudo subir la factura." };
      }
      return saveReceivable(receivable?.id ?? null, v, invoiceId);
    },
    onSuccess: () => {
      setInvoice(null);
      onOpenChange(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, getDefaults);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setInvoice(null);
        onOpenChange(o);
      }}
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
      <FormField
        label="Factura en PDF"
        hint={receivable?.invoice_file_id && !invoice ? "Ya tiene una factura adjunta. Sube otra para reemplazarla." : "Adjunta la factura que has emitido a este cliente (PDF o imagen, máx. 50 MB)."}
      >
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
          {invoice ? <FileText className="size-4 text-brand" /> : <Paperclip className="size-4" />}
          <span className="truncate">{invoice ? invoice.name : "Adjuntar factura"}</span>
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
              setInvoice(f);
            }}
          />
        </label>
      </FormField>
      <TextareaField form={form} name="notes" label="Notas" rows={2} />
    </FormDialog>
  );
}
