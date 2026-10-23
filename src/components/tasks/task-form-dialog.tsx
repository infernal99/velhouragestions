"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/shared/form-dialog";
import { PeopleField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { useLookups } from "@/components/create/use-lookups";
import { taskSchema } from "@/lib/validation/tasks";
import { saveTask } from "@/lib/actions/tasks";
import { priorityOptions, taskStatusOptions } from "@/lib/labels";
import type { Task } from "@/types/database";

export type TaskFormValues = Partial<Task> & { collaborator_ids?: string[] };

function toDefaults(task: TaskFormValues | undefined, userId: string) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    project_id: task?.project_id ?? null,
    parent_id: task?.parent_id ?? null,
    status: task?.status ?? "pendiente",
    priority: task?.priority ?? "media",
    due_date: task?.due_date ?? "",
    assignee_id: task?.assignee_id ?? (task?.id ? null : userId),
    collaborator_ids: task?.collaborator_ids ?? [],
    labels: (task?.labels ?? []).join(", "),
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskFormValues;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { team, userId } = useApp();
  const lookups = useLookups(open);
  const isEdit = Boolean(task?.id);
  const isSubtask = Boolean(task?.parent_id);

  const { form, onSubmit, pending } = useActionForm({
    schema: taskSchema,
    defaultValues: toDefaults(task, userId),
    action: (values) => saveTask(task?.id ?? null, values),
    onSuccess: (data) => {
      onOpenChange(false);
      onSaved?.(data.id);
      router.refresh();
    },
  });

  useResetOnOpen(open, form, () => toDefaults(task, userId));

  const people = team.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email, avatar_url: m.avatar_url }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar tarea" : isSubtask ? "Nueva subtarea" : "Nueva tarea"}
      onSubmit={onSubmit}
      pending={pending}
      size="lg"
      submitLabel={isEdit ? "Guardar cambios" : "Crear tarea"}
    >
      <TextField form={form} name="title" label="Título" required autoFocus />
      <TextareaField form={form} name="description" label="Descripción" rows={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        {!isSubtask ? (
          <SelectField
            form={form}
            name="project_id"
            label="Proyecto"
            allowEmpty
            emptyLabel="Tarea independiente"
            options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        ) : null}
        <SelectField
          form={form}
          name="assignee_id"
          label="Responsable"
          allowEmpty
          options={team.map((m) => ({ value: m.id, label: m.full_name || m.email }))}
        />
        <SelectField
          form={form}
          name="status"
          label="Estado"
          options={taskStatusOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <SelectField
          form={form}
          name="priority"
          label="Prioridad"
          options={priorityOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <TextField form={form} name="due_date" label="Fecha límite" type="date" />
        <TextField form={form} name="labels" label="Etiquetas" placeholder="diseño, cliente, urgente" hint="Separadas por comas" />
      </div>
      <PeopleField form={form} name="collaborator_ids" label="Colaboradores" people={people} />
    </FormDialog>
  );
}
