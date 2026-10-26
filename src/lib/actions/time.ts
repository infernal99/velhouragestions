"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { entryRange, startTimerSchema, timeEntrySchema } from "@/lib/validation/time";

function revalidateTime(projectId?: string | null) {
  revalidatePath("/horas");
  revalidatePath("/", "layout");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

const DAY_MS = 24 * 3600_000;

export async function startTimer(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = startTimerSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { data: running } = await ctx.supabase
      .from("time_entries")
      .select("id")
      .eq("user_id", ctx.userId)
      .is("ended_at", null)
      .maybeSingle();
    if (running) return fail("Ya tienes un cronómetro en marcha. Páralo antes de empezar otro.");
    const { error } = await ctx.supabase.from("time_entries").insert({
      ...parsed.data,
      company_id: ctx.company.id,
      user_id: ctx.userId,
      started_at: new Date().toISOString(),
    });
    if (error) return fromDbError(error);
    revalidateTime(parsed.data.project_id);
    return ok(undefined, "Cronómetro en marcha");
  });
}

export async function stopTimer(note?: string): Promise<ActionResult<{ clamped: boolean }>> {
  return run(async () => {
    const ctx = await actionContext();
    const { data: running } = await ctx.supabase
      .from("time_entries")
      .select("id, project_id, started_at, note")
      .eq("user_id", ctx.userId)
      .is("ended_at", null)
      .maybeSingle();
    if (!running) return fail("No tienes ningún cronómetro en marcha.");
    const start = Date.parse(running.started_at as string);
    const now = Date.now();
    // a forgotten timer is capped at 24 h; the person can then correct it
    const clamped = now - start > DAY_MS;
    const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : (running.note as string | null);
    const { error } = await ctx.supabase
      .from("time_entries")
      .update({ ended_at: new Date(clamped ? start + DAY_MS : now).toISOString(), note: cleanNote })
      .eq("id", running.id);
    if (error) return fromDbError(error);
    revalidateTime(running.project_id as string);
    return ok({ clamped }, clamped ? "Fichaje cerrado (máximo 24 h): corrige la hora de fin si hace falta" : "Horas registradas");
  });
}

export async function saveTimeEntry(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = timeEntrySchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { date: _d, start_time: _s, end_time: _e, tz_offset: _t, ...rest } = parsed.data;
    void _d;
    void _s;
    void _e;
    void _t;
    const range = entryRange(parsed.data);
    if (Date.parse(range.ended_at) > Date.now() + 5 * 60_000) return fail("No puedes registrar horas en el futuro.", { end_time: "En el futuro" });
    if (id) {
      const { data, error } = await ctx.supabase
        .from("time_entries")
        .update({ ...rest, ...range })
        .eq("id", id)
        .eq("company_id", ctx.company.id)
        .select("id");
      if (error) return fromDbError(error);
      if (!data?.length) return fail("Solo puedes editar tus propios fichajes (o ser administrador).");
    } else {
      const { error } = await ctx.supabase
        .from("time_entries")
        .insert({ ...rest, ...range, company_id: ctx.company.id, user_id: ctx.userId });
      if (error) return fromDbError(error);
    }
    revalidateTime(parsed.data.project_id);
    return ok(undefined, id ? "Fichaje actualizado" : "Horas registradas");
  });
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
  return run(async () => {
    if (!z.uuid().safeParse(id).success) return fail("Fichaje no válido.");
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase
      .from("time_entries")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("project_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("Solo puedes borrar tus propios fichajes (o ser administrador).");
    revalidateTime(data[0].project_id as string);
    return ok(undefined, "Fichaje eliminado");
  });
}

/** Open tasks of a project, for the optional "task" selector. */
export async function listProjectTasks(projectId: string): Promise<ActionResult<{ id: string; title: string }[]>> {
  return run(async () => {
    if (!z.uuid().safeParse(projectId).success) return fail("Proyecto no válido.");
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase
      .from("tasks")
      .select("id, title")
      .eq("project_id", projectId)
      .is("parent_id", null)
      .neq("status", "completada")
      .order("position")
      .limit(100);
    if (error) return fromDbError(error);
    return ok((data ?? []) as { id: string; title: string }[]);
  });
}
