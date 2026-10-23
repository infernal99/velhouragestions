"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Handshake, Mail, MessageCircle, Phone, Plus, StickyNote, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp, useMemberName } from "@/components/app-provider";
import { addInteraction, deleteInteraction } from "@/lib/actions/clients";
import { interactionSchema } from "@/lib/validation/crm";
import { interactionKindMap, interactionKindOptions } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import type { ClientInteraction, InteractionKind } from "@/types/database";

const icons: Record<InteractionKind, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  mensaje: MessageCircle,
  email: Mail,
  acuerdo: Handshake,
  nota: StickyNote,
};

export function Interactions({ clientId, items }: { clientId: string; items: ClientInteraction[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const memberName = useMemberName();
  const { userId, permissions } = useApp();

  const defaults = () => ({ client_id: clientId, kind: "llamada" as const, summary: "", occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  const { form, onSubmit, pending } = useActionForm({
    schema: interactionSchema,
    defaultValues: defaults(),
    // datetime-local is local time: convert in the browser, where the timezone is known
    action: (v) => addInteraction({ ...v, occurred_at: new Date(v.occurred_at).toISOString() }),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, defaults);

  return (
    <div>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs text-muted-foreground">Llamadas, reuniones, mensajes y acuerdos registrados por el equipo.</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Registrar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Todavía no hay comunicaciones registradas.</p>
      ) : (
        <ol className="relative px-4 py-3">
          {items.map((it) => {
            const Icon = icons[it.kind];
            const canDelete = it.created_by === userId || permissions.canManageClients;
            return (
              <li key={it.id} className="group relative flex gap-3 pb-4 last:pb-0">
                <div className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-card">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{interactionKindMap[it.kind].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(it.occurred_at)} · {memberName(it.created_by) ?? "—"}
                    </span>
                    {canDelete ? (
                      <ConfirmDialog
                        title="¿Eliminar este registro?"
                        onConfirm={async () => {
                          const res = await runAction(deleteInteraction(it.id, clientId));
                          if (res.ok) router.refresh();
                        }}
                        trigger={(o) => (
                          <button
                            type="button"
                            onClick={o}
                            aria-label="Eliminar"
                            className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">{it.summary}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title="Registrar comunicación" onSubmit={onSubmit} pending={pending} submitLabel="Registrar">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField form={form} name="kind" label="Tipo" options={interactionKindOptions.map((o) => ({ value: o.value, label: o.label }))} />
          <TextField form={form} name="occurred_at" label="Fecha y hora" type="datetime-local" />
        </div>
        <TextareaField form={form} name="summary" label="Resumen" rows={4} required placeholder="Qué se habló, qué se acordó…" />
        <p className="text-xs text-muted-foreground">Esto solo registra la comunicación; no envía nada al cliente.</p>
      </FormDialog>
    </div>
  );
}
