"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/shared/form-dialog";
import { PeopleField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp, useProjectStatus } from "@/components/app-provider";
import { useLookups } from "@/components/create/use-lookups";
import { projectSchema } from "@/lib/validation/projects";
import { saveProject } from "@/lib/actions/projects";
import { priorityOptions, projectTypeLabel } from "@/lib/labels";
import type { Project } from "@/types/database";

export type ProjectFormValues = Partial<Project> & { member_ids?: string[] };

function toDefaults(project: ProjectFormValues | undefined, fallbackType: string, userId: string) {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    client_id: project?.client_id ?? null,
    type: project?.type ?? fallbackType,
    status: project?.status ?? "pendiente",
    priority: project?.priority ?? "media",
    start_date: project?.start_date ?? "",
    due_date: project?.due_date ?? "",
    budget: project?.budget != null ? String(project.budget) : "",
    owner_id: project?.owner_id ?? (project?.id ? null : userId),
    member_ids: project?.member_ids ?? [],
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** With an id: edit. Without: create, using these values as defaults. */
  project?: ProjectFormValues;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { team, company, userId } = useApp();
  const lookups = useLookups(open);
  const { options: projectStatusOptions } = useProjectStatus();
  const isEdit = Boolean(project?.id);
  const fallbackType = company.projectTypes[0] ?? "web";

  const { form, onSubmit, pending } = useActionForm({
    schema: projectSchema,
    defaultValues: toDefaults(project, fallbackType, userId),
    action: (values) => saveProject(project?.id ?? null, values),
    onSuccess: (data) => {
      onOpenChange(false);
      if (onSaved) onSaved(data.id);
      else if (!isEdit) router.push(`/proyectos/${data.id}`);
      else router.refresh();
    },
  });

  useResetOnOpen(open, form, () => toDefaults(project, fallbackType, userId));

  const people = team.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email, avatar_url: m.avatar_url }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar proyecto" : "Nuevo proyecto"}
      onSubmit={onSubmit}
      pending={pending}
      size="lg"
      submitLabel={isEdit ? "Guardar cambios" : "Crear proyecto"}
    >
      <TextField form={form} name="name" label="Nombre" required autoFocus />
      <TextareaField form={form} name="description" label="Descripción" rows={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          form={form}
          name="client_id"
          label="Cliente"
          allowEmpty
          emptyLabel="Sin cliente"
          options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))}
          hint={lookups.loading ? "Cargando clientes…" : undefined}
        />
        <SelectField
          form={form}
          name="type"
          label="Tipo"
          options={company.projectTypes.map((t) => ({ value: t, label: projectTypeLabel(t) }))}
        />
        <SelectField
          form={form}
          name="status"
          label="Estado"
          options={projectStatusOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <SelectField
          form={form}
          name="priority"
          label="Prioridad"
          options={priorityOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <TextField form={form} name="start_date" label="Fecha de inicio" type="date" />
        <TextField form={form} name="due_date" label="Fecha límite" type="date" />
        <TextField form={form} name="budget" label="Presupuesto acordado (€)" inputMode="decimal" placeholder="0,00" />
        <SelectField
          form={form}
          name="owner_id"
          label="Responsable principal"
          allowEmpty
          options={team.map((m) => ({ value: m.id, label: m.full_name || m.email }))}
        />
      </div>
      <PeopleField form={form} name="member_ids" label="Colaboradores" people={people} />
    </FormDialog>
  );
}
