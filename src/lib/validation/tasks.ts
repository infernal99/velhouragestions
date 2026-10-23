import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, requiredText } from "./common";
import { priorities } from "./projects";

export const taskStatuses = ["pendiente", "en_progreso", "revision", "bloqueada", "completada"] as const;

export const taskSchema = z.object({
  title: requiredText(300, "El título"),
  description: optionalText(20000),
  project_id: optionalUuid,
  parent_id: optionalUuid,
  status: z.enum(taskStatuses),
  priority: z.enum(priorities),
  due_date: optionalDate,
  assignee_id: optionalUuid,
  collaborator_ids: z.array(z.uuid()).max(50).default([]),
  labels: z
    .preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : v,
      z.array(z.string().max(30, "Etiqueta demasiado larga")).max(20, "Máximo 20 etiquetas"),
    )
    .default([]),
});

export const eventCategories = [
  "reunion",
  "entrega",
  "tarea",
  "llamada",
  "revision",
  "renovacion",
  "recordatorio",
  "otro",
] as const;

export const eventSchema = z
  .object({
    title: requiredText(200, "El título"),
    description: optionalText(5000),
    category: z.enum(eventCategories),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    start_time: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida").nullable()),
    duration_minutes: z.preprocess(
      (v) => (v === "" || v == null ? 60 : Number(v)),
      z.number().int().min(5, "Mínimo 5 minutos").max(60 * 24 * 14, "Duración demasiado larga"),
    ),
    all_day: z.boolean().default(false),
    location: optionalText(300),
    project_id: optionalUuid,
    client_id: optionalUuid,
    attendee_ids: z.array(z.uuid()).max(50).default([]),
    color: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable()),
    /** Browser timezone offset in minutes (Date.getTimezoneOffset()). */
    tz_offset: z.number().int().min(-900).max(900).default(0),
  })
  .refine((v) => v.all_day || v.start_time, { message: "Indica la hora de inicio", path: ["start_time"] });

/** Combine local date + time from the browser into a UTC instant. */
export function eventRange(v: z.output<typeof eventSchema>) {
  if (v.all_day) {
    const start = new Date(`${v.date}T00:00:00Z`);
    const days = Math.max(1, Math.ceil(v.duration_minutes / (60 * 24)));
    const end = new Date(start.getTime() + days * 86_400_000);
    return { starts_at: start.toISOString(), ends_at: end.toISOString() };
  }
  const localMs = Date.parse(`${v.date}T${v.start_time}:00Z`);
  const start = new Date(localMs + v.tz_offset * 60_000);
  const end = new Date(start.getTime() + v.duration_minutes * 60_000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export const commentSchema = z
  .object({
    body: requiredText(10000, "El comentario"),
    project_id: optionalUuid,
    task_id: optionalUuid,
    client_id: optionalUuid,
  })
  .refine((v) => [v.project_id, v.task_id, v.client_id].filter(Boolean).length === 1, {
    message: "Comentario sin destino",
  });

export type TaskInput = z.input<typeof taskSchema>;
