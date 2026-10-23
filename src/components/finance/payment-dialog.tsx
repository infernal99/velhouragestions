"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { FormDialog } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField, TextField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { paymentSchema } from "@/lib/validation/finance";
import { addPayment, deletePayment, listPayments } from "@/lib/actions/finance";
import { paymentMethodMap, paymentMethodOptions } from "@/lib/labels";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import type { PaymentMethod, ReceivableWithStatus } from "@/types/database";

type PaymentItem = { id: string; amount: number; paid_at: string; method: string; reference: string | null };

/** Register a (possibly partial) payment against one receivable. */
export function PaymentDialog({
  receivable,
  onOpenChange,
}: {
  receivable: ReceivableWithStatus | null;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { company, permissions } = useApp();
  const [history, setHistory] = useState<PaymentItem[] | null>(null);
  const open = Boolean(receivable);
  const pending = receivable ? Number(receivable.amount_pending) : 0;

  useEffect(() => {
    if (!receivable) return;
    let cancelled = false;
    void listPayments(receivable.id).then((r) => {
      if (!cancelled && r.ok) setHistory(r.data);
    });
    return () => {
      cancelled = true;
      setHistory(null);
    };
  }, [receivable]);

  const defaults = () => ({
    receivable_id: receivable?.id ?? "",
    amount: pending > 0 ? pending.toFixed(2).replace(".", ",") : "",
    paid_at: todayISO(),
    method: "transferencia" as const,
    reference: "",
    notes: "",
  });
  const { form, onSubmit, pending: saving } = useActionForm({
    schema: paymentSchema,
    defaultValues: defaults(),
    action: addPayment,
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, defaults);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago recibido"
      description={receivable ? `${receivable.concept} · pendiente ${formatMoney(pending, company.currency)} de ${formatMoney(receivable.amount, company.currency)}` : undefined}
      onSubmit={onSubmit}
      pending={saving}
      submitLabel="Registrar pago"
    >
      {pending <= 0 ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">Este cobro ya está pagado por completo.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField form={form} name="amount" label="Importe recibido (€)" inputMode="decimal" required autoFocus hint="Puede ser un pago parcial." />
          <TextField form={form} name="paid_at" label="Fecha de cobro" type="date" required />
          <SelectField form={form} name="method" label="Método" options={paymentMethodOptions.map((o) => ({ value: o.value, label: o.label }))} />
          <TextField form={form} name="reference" label="Referencia del pago" placeholder="Nº de transferencia" hint="Evita registrar dos veces el mismo pago." />
        </div>
      )}
      {history && history.length ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pagos ya registrados</p>
          <ul className="divide-y rounded-lg border text-sm">
            {history.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-20 text-xs text-muted-foreground">{formatDate(p.paid_at)}</span>
                <span className="flex-1 text-xs text-muted-foreground">
                  {paymentMethodMap[p.method as PaymentMethod]?.label}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="font-medium tabular">{formatMoney(p.amount, company.currency)}</span>
                {permissions.isAdmin ? (
                  <ConfirmDialog
                    title="¿Eliminar este pago?"
                    description="El importe volverá a contar como pendiente de cobro."
                    onConfirm={async () => {
                      const res = await runAction(deletePayment(p.id));
                      if (res.ok) {
                        onOpenChange(false);
                        router.refresh();
                      }
                    }}
                    trigger={(o) => (
                      <button type="button" onClick={o} aria-label="Eliminar pago" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FormDialog>
  );
}
