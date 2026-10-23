"use server";

import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions/result";
import type { CalendarEvent } from "@/types/database";

export interface CalendarData {
  events: (CalendarEvent & { attendee_ids: string[] })[];
  tasks: { id: string; title: string; due_date: string; status: string; assignee_id: string | null; project_id: string | null }[];
  deadlines: { id: string; name: string; due_date: string; status: string }[];
}

const rangeSchema = z.object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) });

/**
 * Everything the calendar shows for a range. Tasks and project deadlines
 * come from their own tables (single source of truth), never copied into
 * events, so no view can show the same thing twice.
 */
export async function getCalendarData(from: string, to: string): Promise<ActionResult<CalendarData>> {
  return run(async () => {
    const parsed = rangeSchema.safeParse({ from, to });
    if (!parsed.success) return fail("Rango no válido.");
    const ctx = await actionContext();
    const fromDay = parsed.data.from.slice(0, 10);
    const toDay = parsed.data.to.slice(0, 10);

    const [events, tasks, projects] = await Promise.all([
      ctx.supabase
        .from("events")
        .select("*, event_attendees(user_id)")
        .eq("company_id", ctx.company.id)
        .lt("starts_at", parsed.data.to)
        .gt("ends_at", parsed.data.from)
        .order("starts_at")
        .limit(1000),
      ctx.supabase
        .from("tasks")
        .select("id, title, due_date, status, assignee_id, project_id")
        .eq("company_id", ctx.company.id)
        .gte("due_date", fromDay)
        .lte("due_date", toDay)
        .limit(1000),
      ctx.supabase
        .from("projects")
        .select("id, name, due_date, status")
        .eq("company_id", ctx.company.id)
        .is("archived_at", null)
        .gte("due_date", fromDay)
        .lte("due_date", toDay),
    ]);
    if (events.error) return fromDbError(events.error);

    return ok({
      events: (events.data ?? []).map(({ event_attendees, ...e }) => ({
        ...(e as CalendarEvent),
        attendee_ids: ((event_attendees ?? []) as { user_id: string }[]).map((a) => a.user_id),
      })),
      tasks: (tasks.data ?? []) as CalendarData["tasks"],
      deadlines: (projects.data ?? []) as CalendarData["deadlines"],
    });
  });
}
