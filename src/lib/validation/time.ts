import { z } from "zod";
import { optionalText, optionalUuid } from "./common";

export const startTimerSchema = z.object({
  project_id: z.uuid("Elige un proyecto"),
  task_id: optionalUuid,
  note: optionalText(500),
});

export const timeEntrySchema = z
  .object({
    project_id: z.uuid("Elige un proyecto"),
    task_id: optionalUuid,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
    note: optionalText(500),
    /** Browser timezone offset in minutes (Date.getTimezoneOffset()). */
    tz_offset: z.number().int().min(-900).max(900).default(0),
  })
  .refine((v) => v.end_time > v.start_time, { message: "La hora de fin debe ser posterior al inicio", path: ["end_time"] });

/** Local date + HH:mm from the browser → UTC instants. */
export function entryRange(v: { date: string; start_time: string; end_time: string; tz_offset: number }) {
  const at = (time: string) => new Date(Date.parse(`${v.date}T${time}:00Z`) + v.tz_offset * 60_000).toISOString();
  return { started_at: at(v.start_time), ended_at: at(v.end_time) };
}

export type TimeEntryInput = z.input<typeof timeEntrySchema>;
