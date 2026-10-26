"use client";

import { useRouter } from "next/navigation";
import { useWatch } from "react-hook-form";
import { format } from "date-fns";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField, TextField } from "@/components/forms/fields";
import { useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { useProjectTasks } from "@/components/time/timer-card";
import { saveTimeEntry } from "@/lib/actions/time";
import { timeEntrySchema } from "@/lib/validation/time";
import type { TimeEntry } from "@/types/database";

function toDefaults(entry: TimeEntry | undefined, projectId?: string) {
  const start = entry ? new Date(entry.started_at) : null;
  const end = entry?.ended_at ? new Date(entry.ended_at) : null;
  return {
    project_id: entry?.project_id ?? projectId ?? "",
    task_id: entry?.task_id ?? null,
    date: format(start ?? new Date(), "yyyy-MM-dd"),
    start_time: start ? format(start, "HH:mm") : "09:00",
    end_time: end ? format(end, "HH:mm") : "10:00",
    note: entry?.note ?? "",
    tz_offset: 0,
  };
}

/** Manual entry (forgot to clock in) or edit of an existing one. */
export function TimeEntryDialog({
  open,
  onOpenChange,
  entry,
  projectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: TimeEntry;
  projectId?: string;
}) {
  const router = useRouter();
  const lookups = useLookups(open);
  const { form, onSubmit, pending } = useActionForm({
    schema: timeEntrySchema,
    defaultValues: toDefaults(entry, projectId),
    action: (v) => saveTimeEntry(entry?.id ?? null, { ...v, tz_offset: new Date(`${v.date}T12:00:00`).getTimezoneOffset() }),
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, () => toDefaults(entry, projectId));
  const selected = useWatch({ control: form.control, name: "project_id" }) as string;
  const tasks = useProjectTasks(open && selected ? selected : null);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "Editar fichaje" : "Registrar horas"}
      description={entry ? undefined : "Para horas que no has fichado con el cronómetro."}
      onSubmit={onSubmit}
      pending={pending}
      size="sm"
      submitLabel={entry ? "Guardar" : "Registrar"}
    >
      <SelectField
        form={form}
        name="project_id"
        label="Proyecto"
        required
        options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))}
        placeholder={lookups.loading ? "Cargando…" : "Elige un proyecto"}
      />
      <SelectField
        form={form}
        name="task_id"
        label="Tarea (opcional)"
        allowEmpty
        emptyLabel="Sin tarea concreta"
        options={tasks.map((t) => ({ value: t.id, label: t.title }))}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField form={form} name="date" label="Día" type="date" required />
        <TextField form={form} name="start_time" label="Desde" type="time" required />
        <TextField form={form} name="end_time" label="Hasta" type="time" required />
      </div>
      <TextField form={form} name="note" label="Nota (opcional)" placeholder="Qué se hizo" />
    </FormDialog>
  );
}
