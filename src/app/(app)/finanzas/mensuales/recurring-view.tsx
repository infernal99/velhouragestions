"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { useApp } from "@/components/app-provider";
import { deleteRecurring, generateMonthlyReceivables, saveRecurring, setRecurringStatus } from "@/lib/actions/recurring";
import { recurringSchema } from "@/lib/validation/finance";
import { recurringStatusMap, recurringStatusOptions } from "@/lib/labels";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import type { RecurringPayment } from "@/types/database";

export type RecurringRow = RecurringPayment & { client: { name: string } | null; project: { name: string } | null };

function RecurringDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: RecurringRow }) {
  const router = useRouter();
  const lookups = useLookups(open);
  const defaults = () => ({
    concept: item?.concept ?? "",
    client_id: item?.client_id ?? null,
    project_id: item?.project_id ?? null,
    amount: item ? String(item.amount) : "",
    status: item?.status ?? ("activo" as const),
    start_date: item?.start_date ?? todayISO(),
    notes: item?.notes ?? "",
  });
  const { form, onSubmit, pending } = useActionForm({
    schema: recurringSchema,
    defaultValues: defaults(),
    action: (v) => saveRecurring(item?.id ?? null, v),
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
      title={item ? "Editar pago mensual" : "Añadir pago mensual"}
      description="Un servicio que se cobra cada mes. Si todavía no está contratado, déjalo como «Pendiente de contratar» y no sumará."
      onSubmit={onSubmit}
      pending={pending}
      size="sm"
      submitLabel={item ? "Guardar" : "Añadir"}
    >
      <TextField form={form} name="concept" label="Concepto" placeholder="Gestión de redes sociales" required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="amount" label="Importe al mes (€)" inputMode="decimal" placeholder="30,00" required />
        <SelectField form={form} name="status" label="Estado" options={recurringStatusOptions.map((o) => ({ value: o.value, label: o.label }))} />
        <SelectField form={form} name="client_id" label="Cliente" allowEmpty emptyLabel="Sin cliente" options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField form={form} name="project_id" label="Proyecto" allowEmpty emptyLabel="Sin proyecto" options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))} />
        <TextField form={form} name="start_date" label="Se cobra desde" type="date" required />
      </div>
      <TextareaField form={form} name="notes" label="Notas" rows={2} />
    </FormDialog>
  );
}

export function RecurringView({ rows, generatedIds, monthLabel }: { rows: RecurringRow[]; generatedIds: string[]; monthLabel: string }) {
  const router = useRouter();
  const { company, permissions } = useApp();
  const [dialog, setDialog] = useState<RecurringRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const c = company.currency;

  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((s, r) => s + Number(r.amount), 0);
  const active = rows.filter((r) => r.status === "activo");
  const pendingToGenerate = active.filter((r) => !generatedIds.includes(r.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total mensual" value={`${formatMoney(sum("activo"), c)}/mes`} icon={Repeat} accent="teal" hint={`${active.length} servicio${active.length === 1 ? "" : "s"} activo${active.length === 1 ? "" : "s"}`} />
        <StatCard label="Al año" value={formatMoney(sum("activo") * 12, c)} accent="emerald" hint="Si todo sigue activo" />
        <StatCard
          label="Pendiente de contratar"
          value={`${formatMoney(sum("pendiente"), c)}/mes`}
          accent="amber"
          hint="No suma en el total"
        />
        <StatCard label={`Cobros de ${monthLabel}`} value={`${generatedIds.length}/${active.length}`} accent="sky" hint={pendingToGenerate ? `${pendingToGenerate} por generar` : "Todos generados"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cada mes puedes crear los cobros de los servicios activos con un clic; aparecen en{" "}
          <Link href="/finanzas/cobros" className="font-medium text-foreground underline">
            Cobros
          </Link>
          , sin duplicarse.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pending || active.length === 0}
            onClick={() =>
              start(async () => {
                const res = await runAction(generateMonthlyReceivables());
                if (res.ok) router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
            Generar cobros de {monthLabel}
          </Button>
          <Button onClick={() => setDialog("new")}>
            <Plus /> Añadir pago mensual
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title="Aún no hay pagos mensuales" description="Añade los servicios que cobráis cada mes, como la gestión de redes o el mantenimiento web." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.concept}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.client?.name, r.project?.name].filter(Boolean).join(" · ") || "Sin cliente"} · desde {formatDate(r.start_date)}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
              <OptionBadge value={r.status} map={recurringStatusMap} />
              <span className={`w-28 shrink-0 text-right text-sm font-semibold tabular ${r.status === "activo" ? "" : "text-muted-foreground line-through decoration-1"}`}>
                {formatMoney(r.amount, c)}/mes
              </span>
              <ConfirmDialog
                title="¿Eliminar este pago mensual?"
                description="Los cobros que ya generaste se conservan en Cobros."
                onConfirm={async () => {
                  const res = await runAction(deleteRecurring(r.id));
                  if (res.ok) router.refresh();
                }}
                trigger={(openDelete) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Opciones" />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => setDialog(r)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      {r.status !== "activo" ? (
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await runAction(setRecurringStatus(r.id, "activo"));
                            if (res.ok) router.refresh();
                          }}
                        >
                          <Play /> Activar (empieza a sumar)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await runAction(setRecurringStatus(r.id, "pausado"));
                            if (res.ok) router.refresh();
                          }}
                        >
                          <Pause /> Pausar
                        </DropdownMenuItem>
                      )}
                      {permissions.isAdmin ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={openDelete}>
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              />
            </li>
          ))}
        </ul>
      )}

      <RecurringDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} item={dialog && dialog !== "new" ? dialog : undefined} />
    </div>
  );
}
