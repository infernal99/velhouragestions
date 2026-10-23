"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { OptionBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CheckboxField, SelectField, SimpleSelect, TextField, TextareaField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp, useMemberName } from "@/components/app-provider";
import { deleteWebRequest, saveWebRequest, updateWebRequestStatus } from "@/lib/actions/projects";
import { webRequestSchema } from "@/lib/validation/projects";
import { priorityMap, priorityOptions, webRequestKindOptions, webRequestStatusOptions } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WebRequest } from "@/types/database";

export function WebRequests({ projectId, requests }: { projectId: string; requests: WebRequest[] }) {
  const router = useRouter();
  const { team } = useApp();
  const memberName = useMemberName();
  const [editing, setEditing] = useState<WebRequest | "new-cambio" | "new-problema" | null>(null);
  const [filter, setFilter] = useState<"abiertos" | "todos">("abiertos");

  const current = typeof editing === "object" ? editing : null;
  const defaults = () => ({
    project_id: projectId,
    kind: current?.kind ?? (editing === "new-problema" ? ("problema" as const) : ("cambio" as const)),
    title: current?.title ?? "",
    description: current?.description ?? "",
    priority: current?.priority ?? ("media" as const),
    status: current?.status ?? ("abierto" as const),
    assignee_id: current?.assignee_id ?? null,
    requested_by_client: current?.requested_by_client ?? editing !== "new-problema",
  });
  const { form, onSubmit, pending } = useActionForm({
    schema: webRequestSchema,
    defaultValues: defaults(),
    action: (v) => saveWebRequest(current?.id ?? null, v),
    onSuccess: () => {
      setEditing(null);
      router.refresh();
    },
  });
  useResetOnOpen(Boolean(editing), form, defaults);

  const visible = requests.filter((r) => filter === "todos" || r.status === "abierto" || r.status === "en_curso");
  const openCount = requests.filter((r) => r.status === "abierto" || r.status === "en_curso").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(["abiertos", "todos"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn("rounded px-2 py-0.5 font-medium", filter === f ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              {f === "abiertos" ? `Pendientes (${openCount})` : `Todos (${requests.length})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing("new-problema")}>
            <Bug /> Problema
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing("new-cambio")}>
            <Plus /> Cambio solicitado
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{filter === "abiertos" ? "No hay cambios ni problemas pendientes." : "Sin registros."}</p>
      ) : (
        <ul className="divide-y">
          {visible.map((r) => {
            const Icon = r.kind === "problema" ? Bug : Wand2;
            return (
              <li key={r.id} className="group flex items-start gap-3 px-4 py-3">
                <Icon className={cn("mt-0.5 size-4 shrink-0", r.kind === "problema" ? "text-red-500" : "text-brand")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", (r.status === "resuelto" || r.status === "descartado") && "text-muted-foreground line-through")}>
                    {r.title}
                  </p>
                  {r.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <OptionBadge value={r.priority} map={priorityMap} />
                    {r.requested_by_client ? <span>Pedido por el cliente</span> : <span>Interno</span>}
                    <span>· {formatDate(r.created_at)}</span>
                    {r.assignee_id ? (
                      <span className="inline-flex items-center gap-1">
                        · <UserAvatar name={memberName(r.assignee_id)} size="xs" /> {memberName(r.assignee_id)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <SimpleSelect
                  value={r.status}
                  onChange={async (v) => {
                    if (!v) return;
                    const res = await runAction(updateWebRequestStatus(r.id, projectId, v));
                    if (res.ok) router.refresh();
                  }}
                  options={webRequestStatusOptions.map((o) => ({ value: o.value, label: o.label }))}
                  className="h-7 w-32 shrink-0"
                />
                <div className="flex shrink-0 opacity-60 group-hover:opacity-100">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(r)}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    title="¿Eliminar esta solicitud?"
                    onConfirm={async () => {
                      const res = await runAction(deleteWebRequest(r.id, projectId));
                      if (res.ok) router.refresh();
                    }}
                    trigger={(o) => (
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={o} className="hover:text-destructive">
                        <Trash2 />
                      </Button>
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "Editar solicitud" : editing === "new-problema" ? "Registrar problema" : "Registrar cambio solicitado"}
        onSubmit={onSubmit}
        pending={pending}
      >
        <TextField form={form} name="title" label="Título" required autoFocus />
        <TextareaField form={form} name="description" label="Descripción" rows={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField form={form} name="kind" label="Tipo" options={webRequestKindOptions.map((o) => ({ value: o.value, label: o.label }))} />
          <SelectField form={form} name="priority" label="Prioridad" options={priorityOptions.map((o) => ({ value: o.value, label: o.label }))} />
          <SelectField form={form} name="status" label="Estado" options={webRequestStatusOptions.map((o) => ({ value: o.value, label: o.label }))} />
          <SelectField
            form={form}
            name="assignee_id"
            label="Responsable"
            allowEmpty
            options={team.map((m) => ({ value: m.id, label: m.full_name || m.email }))}
          />
        </div>
        <CheckboxField form={form} name="requested_by_client" label="Lo ha pedido el cliente" />
      </FormDialog>
    </div>
  );
}
