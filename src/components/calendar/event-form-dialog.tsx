"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { FormDialog } from "@/components/shared/form-dialog";
import { CheckboxField, PeopleField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { useLookups } from "@/components/create/use-lookups";
import { eventSchema } from "@/lib/validation/tasks";
import { deleteEvent, saveEvent } from "@/lib/actions/events";
import { eventCategoryOptions } from "@/lib/labels";
import type { CalendarEvent } from "@/types/database";

export type EventFormValues = Partial<CalendarEvent> & { attendee_ids?: string[]; defaultDate?: string };

function toDefaults(event: EventFormValues | undefined) {
  const start = event?.starts_at ? new Date(event.starts_at) : null;
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  const duration = start && end ? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)) : 60;
  const allDay = event?.all_day ?? false;
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "reunion",
    // all-day events are stored at UTC midnight; read them back in UTC
    date: start
      ? allDay
        ? start.toISOString().slice(0, 10)
        : format(start, "yyyy-MM-dd")
      : (event?.defaultDate ?? format(new Date(), "yyyy-MM-dd")),
    start_time: start && !allDay ? format(start, "HH:mm") : "10:00",
    duration_minutes: String(allDay && start && end ? Math.round(duration) : duration),
    all_day: allDay,
    location: event?.location ?? "",
    project_id: event?.project_id ?? null,
    client_id: event?.client_id ?? null,
    attendee_ids: event?.attendee_ids ?? [],
    color: event?.color ?? "",
    tz_offset: 0,
  };
}

const durations = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1 h 30 min" },
  { value: "120", label: "2 horas" },
  { value: "180", label: "3 horas" },
  { value: "240", label: "4 horas" },
  { value: "480", label: "Jornada (8 h)" },
];

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventFormValues;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { team } = useApp();
  const lookups = useLookups(open);
  const isEdit = Boolean(event?.id);

  const { form, onSubmit, pending } = useActionForm({
    schema: eventSchema,
    defaultValues: toDefaults(event),
    action: (values) => saveEvent(event?.id ?? null, { ...values, tz_offset: new Date(`${values.date}T12:00:00`).getTimezoneOffset() }),
    onSuccess: () => {
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    },
  });

  useResetOnOpen(open, form, () => toDefaults(event));
  const allDay = form.watch("all_day") as boolean;
  const people = team.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email, avatar_url: m.avatar_url }));
  const durationValue = String(form.watch("duration_minutes") ?? "60");
  const durationOptions = durations.some((d) => d.value === durationValue)
    ? durations
    : [...durations, { value: durationValue, label: `${durationValue} min` }];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar evento" : "Nuevo evento"}
      onSubmit={onSubmit}
      pending={pending}
      size="lg"
      submitLabel={isEdit ? "Guardar cambios" : "Crear evento"}
      footerExtra={
        isEdit ? (
          <ConfirmDialog
            title="¿Eliminar este evento?"
            description="Se eliminará del calendario de todo el equipo."
            onConfirm={async () => {
              const res = await runAction(deleteEvent(event!.id!));
              if (res.ok) {
                onOpenChange(false);
                router.refresh();
              }
            }}
            trigger={(openConfirm) => (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={openConfirm}>
                <Trash2 /> Eliminar
              </Button>
            )}
          />
        ) : null
      }
    >
      <TextField form={form} name="title" label="Título" required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          form={form}
          name="category"
          label="Categoría"
          options={eventCategoryOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        <TextField form={form} name="date" label="Fecha" type="date" required />
        {!allDay ? (
          <>
            <TextField form={form} name="start_time" label="Hora de inicio" type="time" required />
            <SelectField form={form} name="duration_minutes" label="Duración" options={durationOptions} />
          </>
        ) : null}
      </div>
      <CheckboxField form={form} name="all_day" label="Todo el día" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          form={form}
          name="project_id"
          label="Proyecto relacionado"
          allowEmpty
          emptyLabel="Ninguno"
          options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <SelectField
          form={form}
          name="client_id"
          label="Cliente"
          allowEmpty
          emptyLabel="Ninguno"
          options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextField form={form} name="location" label="Lugar o enlace" placeholder="Oficina, Google Meet…" className="sm:col-span-2" />
      </div>
      <PeopleField form={form} name="attendee_ids" label="Participantes" people={people} />
      <TextareaField form={form} name="description" label="Descripción" rows={3} />
    </FormDialog>
  );
}
