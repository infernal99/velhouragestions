"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { commentSchema, taskSchema, taskStatuses } from "@/lib/validation/tasks";
import { requiredText } from "@/lib/validation/common";
import type { FileCategory } from "@/types/database";

function revalidateTasks(projectId?: string | null) {
  revalidatePath("/tareas");
  revalidatePath("/");
  revalidatePath("/calendario");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

export async function saveTask(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { collaborator_ids, ...values } = parsed.data;
    const teamIds = new Set(ctx.team.map((m) => m.id));
    if (values.assignee_id && !teamIds.has(values.assignee_id)) return fail("El responsable no es del equipo.");
    if (collaborator_ids.some((c) => !teamIds.has(c))) return fail("Algún colaborador no es del equipo.");

    let taskId = id;
    if (id) {
      const { parent_id: _ignored, ...updatable } = values;
      void _ignored;
      const { error, count } = await ctx.supabase
        .from("tasks")
        .update(updatable, { count: "exact" })
        .eq("id", id)
        .eq("company_id", ctx.company.id);
      if (error) return fromDbError(error);
      if (!count) return fail("No tienes acceso a esta tarea.");
    } else {
      const { data, error } = await ctx.supabase
        .from("tasks")
        .insert({ ...values, company_id: ctx.company.id, created_by: ctx.userId, position: Date.now() / 1000 })
        .select("id")
        .single();
      if (error) return fromDbError(error);
      taskId = data.id as string;
    }

    const { data: current } = await ctx.supabase.from("task_collaborators").select("user_id").eq("task_id", taskId!);
    const currentIds = new Set((current ?? []).map((r) => r.user_id as string));
    const toAdd = collaborator_ids.filter((u) => !currentIds.has(u));
    const toRemove = [...currentIds].filter((u) => !collaborator_ids.includes(u));
    if (toAdd.length) await ctx.supabase.from("task_collaborators").insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
    if (toRemove.length) await ctx.supabase.from("task_collaborators").delete().eq("task_id", taskId!).in("user_id", toRemove);

    revalidateTasks(values.project_id);
    return ok({ id: taskId! }, id ? "Tarea actualizada" : "Tarea creada");
  });
}

export async function updateTaskStatus(id: string, status: string, position?: number): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(taskStatuses).safeParse(status);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext();
    const patch: Record<string, unknown> = { status: parsed.data };
    if (typeof position === "number" && Number.isFinite(position)) patch.position = position;
    const { data, error } = await ctx.supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("project_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("No tienes acceso a esta tarea.");
    revalidateTasks(data[0].project_id as string | null);
    return ok(undefined);
  });
}

export async function updateTaskDueDate(id: string, dueDate: string | null): Promise<ActionResult> {
  return run(async () => {
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fail("Fecha no válida.");
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase
      .from("tasks")
      .update({ due_date: dueDate })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("project_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("No tienes acceso a esta tarea.");
    revalidateTasks(data[0].project_id as string | null);
    return ok(undefined, "Fecha actualizada");
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("project_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("Solo quien creó la tarea, el responsable del proyecto o un administrador puede eliminarla.");
    revalidateTasks(data[0].project_id as string | null);
    return ok(undefined, "Tarea eliminada");
  });
}

export async function addTaskChecklistItem(taskId: string, label: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = requiredText(300, "El texto").safeParse(label);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("task_checklist_items")
      .insert({ task_id: taskId, label: parsed.data, position: Math.floor(Date.now() / 1000) });
    if (error) return fromDbError(error);
    revalidatePath("/tareas");
    return ok(undefined);
  });
}

export async function toggleTaskChecklistItem(id: string, done: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("task_checklist_items").update({ done }).eq("id", id);
    if (error) return fromDbError(error);
    revalidatePath("/tareas");
    return ok(undefined);
  });
}

export async function deleteTaskChecklistItem(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("task_checklist_items").delete().eq("id", id);
    if (error) return fromDbError(error);
    revalidatePath("/tareas");
    return ok(undefined);
  });
}

// ---------------------------------------------------------------------------
// Comments (projects, tasks and clients share one table)
// ---------------------------------------------------------------------------
export async function addComment(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("comments")
      .insert({ ...parsed.data, company_id: ctx.company.id, author_id: ctx.userId });
    if (error) return fromDbError(error);
    if (parsed.data.project_id) revalidatePath(`/proyectos/${parsed.data.project_id}`);
    if (parsed.data.client_id) revalidatePath(`/clientes/${parsed.data.client_id}`);
    revalidatePath("/tareas");
    return ok(undefined);
  });
}

export async function deleteComment(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { data, error } = await ctx.supabase.from("comments").delete().eq("id", id).select("project_id, client_id");
    if (error) return fromDbError(error);
    if (!data?.length) return fail("Solo el autor o un administrador puede eliminar el comentario.");
    if (data[0].project_id) revalidatePath(`/proyectos/${data[0].project_id}`);
    if (data[0].client_id) revalidatePath(`/clientes/${data[0].client_id}`);
    revalidatePath("/tareas");
    return ok(undefined, "Comentario eliminado");
  });
}

export interface TaskDetail {
  checklist: { id: string; label: string; done: boolean }[];
  subtasks: { id: string; title: string; status: string; assignee_id: string | null }[];
  collaborator_ids: string[];
  comments: { id: string; body: string; author_id: string | null; created_at: string }[];
  files: { id: string; name: string; mime_type: string | null; size_bytes: number; category: FileCategory; uploaded_by: string | null; created_at: string }[];
}

/** Loads the side panel content for one task (RLS-scoped). */
export async function getTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>> {
  return run(async () => {
    if (!z.uuid().safeParse(taskId).success) return fail("Tarea no válida.");
    const ctx = await actionContext();
    const [checklist, subtasks, collaborators, comments, files] = await Promise.all([
      ctx.supabase.from("task_checklist_items").select("id, label, done").eq("task_id", taskId).order("position"),
      ctx.supabase.from("tasks").select("id, title, status, assignee_id").eq("parent_id", taskId).order("created_at"),
      ctx.supabase.from("task_collaborators").select("user_id").eq("task_id", taskId),
      ctx.supabase.from("comments").select("id, body, author_id, created_at").eq("task_id", taskId).order("created_at"),
      ctx.supabase.from("files").select("id, name, mime_type, size_bytes, category, uploaded_by, created_at").eq("task_id", taskId).order("created_at"),
    ]);
    return ok({
      checklist: (checklist.data ?? []) as TaskDetail["checklist"],
      subtasks: (subtasks.data ?? []) as TaskDetail["subtasks"],
      collaborator_ids: (collaborators.data ?? []).map((c) => c.user_id as string),
      comments: (comments.data ?? []) as TaskDetail["comments"],
      files: (files.data ?? []) as TaskDetail["files"],
    });
  });
}
