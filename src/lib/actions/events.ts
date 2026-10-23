"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { eventRange, eventSchema } from "@/lib/validation/tasks";

function revalidateEvents(projectId?: string | null) {
  revalidatePath("/calendario");
  revalidatePath("/");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

export async function saveEvent(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { attendee_ids, date: _d, start_time: _s, duration_minutes: _m, tz_offset: _t, ...rest } = parsed.data;
    void _d;
    void _s;
    void _m;
    void _t;
    const teamIds = new Set(ctx.team.map((m) => m.id));
    if (attendee_ids.some((a) => !teamIds.has(a))) return fail("Algún participante no es del equipo.");
    const values = { ...rest, ...eventRange(parsed.data) };

    let eventId = id;
    if (id) {
      const { error, count } = await ctx.supabase
        .from("events")
        .update(values, { count: "exact" })
        .eq("id", id)
        .eq("company_id", ctx.company.id);
      if (error) return fromDbError(error);
      if (!count) return fail("No tienes acceso a este evento.");
    } else {
      const { data, error } = await ctx.supabase
        .from("events")
        .insert({ ...values, company_id: ctx.company.id, created_by: ctx.userId })
        .select("id")
        .single();
      if (error) return fromDbError(error);
      eventId = data.id as string;
    }

    await ctx.supabase.from("event_attendees").delete().eq("event_id", eventId!);
    if (attendee_ids.length) {
      await ctx.supabase.from("event_attendees").insert(attendee_ids.map((user_id) => ({ event_id: eventId, user_id })));
    }

    revalidateEvents(values.project_id);
    return ok({ id: eventId! }, id ? "Evento actualizado" : "Evento creado");
  });
}

const moveSchema = z.object({
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  all_day: z.boolean(),
});

/** Drag & drop / resize on the calendar. */
export async function moveEvent(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) return fail("Fechas no válidas.");
    if (parsed.data.ends_at < parsed.data.starts_at) return fail("El final no puede ser anterior al inicio.");
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase
      .from("events")
      .update(parsed.data, { count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No tienes acceso a este evento.");
    revalidateEvents();
    return ok(undefined, "Evento movido");
  });
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("project_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("Solo quien creó el evento o un administrador puede eliminarlo.");
    revalidateEvents(data[0].project_id as string | null);
    return ok(undefined, "Evento eliminado");
  });
}

export async function getEventAttendees(id: string): Promise<ActionResult<string[]>> {
  return run(async () => {
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase.from("event_attendees").select("user_id").eq("event_id", id);
    if (error) return fromDbError(error);
    return ok((data ?? []).map((r) => r.user_id as string));
  });
}
