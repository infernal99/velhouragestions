"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowUp,
  Check,
  Copy,
  FileDown,
  FolderPlus,
  HandCoins,
  Loader2,
  Lock,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/shared/info-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { runAction, useActionForm } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { useLookups } from "@/components/create/use-lookups";
import {
  convertQuoteToProject,
  createReceivableFromQuote,
  deleteQuote,
  duplicateQuote,
  saveQuote,
  setQuoteStatus,
} from "@/lib/actions/finance";
import { computeQuoteTotals, quoteSchema } from "@/lib/validation/finance";
import { parseDecimal } from "@/lib/validation/common";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote, QuoteLine } from "@/types/database";

const num = (v: unknown) => {
  const n = parseDecimal(v);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};
const str = (n: number) => String(n).replace(".", ",");

export function QuoteEditor({
  quote,
  lines,
  hasReceivable,
  defaultTax,
}: {
  quote: Quote & { client: { id: string; name: string } | null; project: { id: string; name: string } | null };
  lines: QuoteLine[];
  hasReceivable: boolean;
  defaultTax: number;
}) {
  const router = useRouter();
  const { company, permissions } = useApp();
  const lookups = useLookups(true);
  const [busy, start] = useTransition();
  const editable = quote.status === "borrador" || quote.status === "enviado";

  const { form, onSubmit, pending } = useActionForm({
    schema: quoteSchema,
    defaultValues: {
      title: quote.title,
      client_id: quote.client_id,
      issue_date: quote.issue_date,
      valid_until: quote.valid_until ?? "",
      notes: quote.notes ?? "",
      terms: quote.terms ?? "",
      lines: lines.length
        ? lines.map((l) => ({
            description: l.description,
            quantity: str(Number(l.quantity)),
            unit_price: str(Number(l.unit_price)),
            discount_pct: str(Number(l.discount_pct)),
            tax_pct: str(Number(l.tax_pct)),
          }))
        : [{ description: "", quantity: "1", unit_price: "", discount_pct: "0", tax_pct: str(defaultTax) }],
    },
    action: (v) => saveQuote(quote.id, v),
    onSuccess: () => router.refresh(),
  });

  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "lines" });
  const watched = useWatch({ control: form.control, name: "lines" }) as { quantity: unknown; unit_price: unknown; discount_pct: unknown; tax_pct: unknown }[];
  const totals = computeQuoteTotals(
    (watched ?? []).map((l) => ({ quantity: num(l.quantity), unit_price: num(l.unit_price), discount_pct: num(l.discount_pct), tax_pct: num(l.tax_pct) })),
  );
  const c = company.currency;
  const lineErrors = form.formState.errors.lines as unknown as ({ [k: string]: { message?: string } } | undefined)[] | { message?: string } | undefined;

  const act = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const changeStatus = (status: string) =>
    act(async () => {
      if (editable && form.formState.isDirty) {
        toast.warning("Guarda los cambios antes de cambiar el estado.");
        return;
      }
      const res = await runAction(setQuoteStatus(quote.id, status));
      if (res.ok) router.refresh();
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5" noValidate>
        {!editable ? (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-4" /> Este presupuesto está {quote.status} y ya no se puede modificar. Duplícalo para crear una nueva versión.
          </p>
        ) : null}
        <Panel title="Datos">
          <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="title" label="Título" required className="sm:col-span-2" />
            <SelectField
              form={form}
              name="client_id"
              label="Cliente"
              allowEmpty
              emptyLabel="Sin cliente"
              options={
                lookups.clients.length
                  ? lookups.clients.map((x) => ({ value: x.id, label: x.name }))
                  : quote.client
                    ? [{ value: quote.client.id, label: quote.client.name }]
                    : []
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField form={form} name="issue_date" label="Emisión" type="date" required />
              <TextField form={form} name="valid_until" label="Válido hasta" type="date" />
            </div>
          </fieldset>
        </Panel>

        <Panel title="Conceptos y líneas de servicio" bodyClassName="p-0">
          <fieldset disabled={!editable}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="w-6" />
                    <th className="px-2 py-2 font-medium">Descripción</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Cant.</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Precio (€)</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Dto. %</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">IVA %</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Importe</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => {
                    const l = watched?.[i];
                    const lineNet = l ? num(l.quantity) * num(l.unit_price) * (1 - num(l.discount_pct) / 100) : 0;
                    const err = Array.isArray(lineErrors) ? lineErrors[i] : undefined;
                    return (
                      <tr key={field.id} className="border-b align-top last:border-0">
                        <td className="pt-3 pl-2">
                          <div className="flex flex-col text-muted-foreground">
                            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)} className="disabled:opacity-20">
                              <ArrowUp className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Textarea
                            rows={1}
                            {...form.register(`lines.${i}.description`)}
                            placeholder="Diseño y desarrollo de…"
                            aria-invalid={Boolean(err?.description)}
                            className="min-h-8 resize-y"
                          />
                          {err?.description ? <p className="mt-1 text-xs text-destructive">{err.description.message}</p> : null}
                        </td>
                        {(["quantity", "unit_price", "discount_pct", "tax_pct"] as const).map((k) => (
                          <td key={k} className="px-2 py-2">
                            <Input {...form.register(`lines.${i}.${k}`)} inputMode="decimal" aria-invalid={Boolean(err?.[k])} className="text-right tabular" />
                            {err?.[k] ? <p className="mt-1 text-right text-[11px] text-destructive">{err[k].message}</p> : null}
                          </td>
                        ))}
                        <td className="px-2 py-3.5 text-right font-medium tabular">{formatMoney(lineNet, c)}</td>
                        <td className="py-2 pr-2">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar línea" disabled={fields.length === 1} onClick={() => remove(i)}>
                            <X />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lineErrors && !Array.isArray(lineErrors) && "message" in lineErrors && lineErrors.message ? (
              <p className="px-4 pt-2 text-sm text-destructive">{lineErrors.message}</p>
            ) : null}
            {editable ? (
              <div className="border-t px-4 py-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => append({ description: "", quantity: "1", unit_price: "", discount_pct: "0", tax_pct: str(defaultTax) })}
                >
                  <Plus /> Añadir línea
                </Button>
              </div>
            ) : null}
          </fieldset>
        </Panel>

        <Panel title="Notas y condiciones">
          <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
            <TextareaField form={form} name="notes" label="Notas para el cliente" rows={4} placeholder="Alcance, plazos, entregables…" />
            <TextareaField form={form} name="terms" label="Condiciones" rows={4} placeholder="Forma de pago: 50% al inicio y 50% a la entrega…" />
          </fieldset>
        </Panel>

        {editable ? (
          <div className="sticky bottom-3 z-10 flex justify-end">
            <Button type="submit" size="lg" disabled={pending} className="shadow-md">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Guardar presupuesto
            </Button>
          </div>
        ) : null}
      </form>

      <div className="flex flex-col gap-5">
        <Panel title="Totales">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{formatMoney(totals.subtotal, c)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuentos</dt>
              <dd className="tabular">−{formatMoney(totals.discount, c)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Base imponible</dt>
              <dd className="tabular">{formatMoney(totals.net, c)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Impuestos</dt>
              <dd className="tabular">{formatMoney(totals.tax, c)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(totals.total, c)}</dd>
            </div>
          </dl>
          {form.formState.isDirty && editable ? <p className="mt-2 text-xs text-amber-600">Cambios sin guardar</p> : null}
        </Panel>

        <Panel title="Estado y acciones">
          <div className="flex flex-col gap-2">
            {quote.status === "borrador" ? (
              <Button variant="outline" disabled={busy} onClick={() => changeStatus("enviado")}>
                <Send /> Marcar como enviado
              </Button>
            ) : null}
            {quote.status === "borrador" || quote.status === "enviado" ? (
              <>
                <Button disabled={busy} onClick={() => changeStatus("aceptado")}>
                  <Check /> Marcar como aceptado
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => changeStatus("rechazado")}>
                    Rechazado
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => changeStatus("caducado")}>
                    Caducado
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" disabled={busy || Boolean(quote.project_id) || hasReceivable} onClick={() => changeStatus("borrador")}>
                <Undo2 /> Volver a borrador
              </Button>
            )}
            {quote.status === "aceptado" ? (
              <>
                {quote.project ? (
                  <Button variant="outline" render={<Link href={`/proyectos/${quote.project.id}`} />} nativeButton={false}>
                    <FolderPlus /> Ver proyecto: {quote.project.name}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const res = await runAction(convertQuoteToProject(quote.id));
                        if (res.ok) router.push(`/proyectos/${res.data.projectId}`);
                      })
                    }
                  >
                    <FolderPlus /> Convertir en proyecto
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy || hasReceivable}
                  onClick={() =>
                    act(async () => {
                      const res = await runAction(createReceivableFromQuote(quote.id));
                      if (res.ok) router.refresh();
                    })
                  }
                >
                  <HandCoins /> {hasReceivable ? "Cobro ya registrado" : "Registrar cobro pendiente"}
                </Button>
              </>
            ) : null}
            <div className="my-1 border-t" />
            <Button variant="outline" render={<a href={`/imprimir/presupuesto/${quote.id}`} target="_blank" rel="noopener" />} nativeButton={false}>
              <FileDown /> Ver / descargar PDF
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const res = await runAction(duplicateQuote(quote.id));
                  if (res.ok) router.push(`/finanzas/presupuestos/${res.data.id}`);
                })
              }
            >
              <Copy /> Duplicar
            </Button>
            {permissions.isAdmin ? (
              <ConfirmDialog
                title="¿Eliminar este presupuesto?"
                description="Se eliminará con todas sus líneas. El proyecto o cobro creados a partir de él se conservan."
                onConfirm={async () => {
                  const res = await runAction(deleteQuote(quote.id));
                  if (res.ok) router.push("/finanzas/presupuestos");
                }}
                trigger={(o) => (
                  <Button variant="ghost" className={cn("text-destructive")} onClick={o}>
                    <Trash2 /> Eliminar
                  </Button>
                )}
              />
            ) : null}
          </div>
        </Panel>
        <p className="px-1 text-xs text-muted-foreground">El PDF es un presupuesto informativo: no es una factura ni tiene validez fiscal.</p>
      </div>
    </div>
  );
}

