"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import {
  looksLikeSecret,
  projectLinkSchema,
  projectSchema,
  projectStatuses,
  secretReferenceSchema,
  webDetailsSchema,
  webRequestSchema,
} from "@/lib/validation/projects";
import { requiredText } from "@/lib/validation/common";

function revalidateProject(id?: string) {
  revalidatePath("/proyectos");
  revalidatePath("/webs");
  revalidatePath("/");
  if (id) revalidatePath(`/proyectos/${id}`);
}

export async function saveProject(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { member_ids, ...values } = parsed.data;

    if (!ctx.company.project_types.includes(values.type)) {
      return fail("Tipo de proyecto no válido.", { type: "Tipo no válido" });
    }
    const teamIds = new Set(ctx.team.map((m) => m.id));
    if (values.owner_id && !teamIds.has(values.owner_id)) return fail("El responsable no es del equipo.");
    if (member_ids.some((m) => !teamIds.has(m))) return fail("Algún colaborador no es del equipo.");

    let projectId = id;
    if (id) {
      const { error, count } = await ctx.supabase
        .from("projects")
        .update(values, { count: "exact" })
        .eq("id", id)
        .eq("company_id", ctx.company.id);
      if (error) return fromDbError(error);
      if (!count) return fail("No tienes acceso a este proyecto.");
    } else {
      const { data, error } = await ctx.supabase
        .from("projects")
        .insert({ ...values, owner_id: values.owner_id ?? ctx.userId, company_id: ctx.company.id, created_by: ctx.userId })
        .select("id")
        .single();
      if (error) return fromDbError(error);
      projectId = data.id as string;
      if (values.type === "web") {
        await ctx.supabase.from("web_details").insert({ project_id: projectId });
      }
    }

    // Sync collaborators (only the project's manager can change them; RLS
    // silently ignores the rest for other users).
    const { data: current } = await ctx.supabase.from("project_members").select("user_id").eq("project_id", projectId!);
    const currentIds = new Set((current ?? []).map((r) => r.user_id as string));
    const wanted = new Set(member_ids);
    const toAdd = [...wanted].filter((u) => !currentIds.has(u));
    const toRemove = [...currentIds].filter((u) => !wanted.has(u));
    if (toAdd.length) {
      const { error } = await ctx.supabase.from("project_members").insert(toAdd.map((user_id) => ({ project_id: projectId, user_id })));
      if (error && id) return fromDbError(error, "Solo el responsable o un administrador puede cambiar los colaboradores.");
    }
    if (toRemove.length) {
      await ctx.supabase.from("project_members").delete().eq("project_id", projectId!).in("user_id", toRemove);
    }

    revalidateProject(projectId!);
    return ok({ id: projectId! }, id ? "Proyecto actualizado" : "Proyecto creado");
  });
}

export async function updateProjectStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(projectStatuses).safeParse(status);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase
      .from("projects")
      .update({ status: parsed.data }, { count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No tienes acceso a este proyecto.");
    revalidateProject(id);
    return ok(undefined);
  });
}

export async function setProjectArchived(id: string, archived: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase
      .from("projects")
      .update({ archived_at: archived ? new Date().toISOString() : null }, { count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No tienes acceso a este proyecto.");
    revalidateProject(id);
    return ok(undefined, archived ? "Proyecto archivado" : "Proyecto restaurado");
  });
}

export async function deleteProject(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error, count } = await ctx.supabase
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo eliminar el proyecto.");
    revalidateProject();
    return ok(undefined, "Proyecto eliminado");
  });
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------
export async function addProjectLink(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = projectLinkSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("project_links").insert(parsed.data);
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${parsed.data.project_id}`);
    return ok(undefined, "Enlace añadido");
  });
}

export async function deleteProjectLink(id: string, projectId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("project_links").delete().eq("id", id).eq("project_id", projectId);
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined, "Enlace eliminado");
  });
}

// ---------------------------------------------------------------------------
// Web specifics
// ---------------------------------------------------------------------------
export async function saveWebDetails(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = webDetailsSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("web_details").upsert(parsed.data, { onConflict: "project_id" });
    if (error) return fromDbError(error);
    revalidateProject(parsed.data.project_id);
    return ok(undefined, "Ficha de la web guardada");
  });
}

export async function setWebStage(projectId: string, stageId: string | null): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    if (stageId && !z.uuid().safeParse(stageId).success) return fail("Etapa no válida.");
    const { error } = await ctx.supabase
      .from("web_details")
      .upsert({ project_id: projectId, stage_id: stageId }, { onConflict: "project_id" });
    if (error) return fromDbError(error);
    revalidateProject(projectId);
    return ok(undefined);
  });
}

export async function saveWebRequest(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = webRequestSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const values = {
      ...parsed.data,
      resolved_at: parsed.data.status === "resuelto" ? new Date().toISOString() : null,
    };
    const { error } = id
      ? await ctx.supabase.from("web_requests").update(values).eq("id", id)
      : await ctx.supabase.from("web_requests").insert({ ...values, created_by: ctx.userId });
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${parsed.data.project_id}`);
    revalidatePath("/webs");
    return ok(undefined, id ? "Solicitud actualizada" : "Solicitud registrada");
  });
}

export async function updateWebRequestStatus(id: string, projectId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.enum(["abierto", "en_curso", "resuelto", "descartado"]).safeParse(status);
    if (!parsed.success) return fail("Estado no válido.");
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("web_requests")
      .update({ status: parsed.data, resolved_at: parsed.data === "resuelto" ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("project_id", projectId);
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/webs");
    return ok(undefined);
  });
}

export async function deleteWebRequest(id: string, projectId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase.from("web_requests").delete({ count: "exact" }).eq("id", id).eq("project_id", projectId);
    if (error) return fromDbError(error);
    if (!count) return fail("Solo el autor o el responsable del proyecto puede eliminarla.");
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined, "Solicitud eliminada");
  });
}

export async function addChecklistItem(projectId: string, label: string): Promise<ActionResult> {
  return run(async () => {
    const parsed = requiredText(200, "El texto").safeParse(label);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const ctx = await actionContext();
    const { count } = await ctx.supabase
      .from("web_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    const { error } = await ctx.supabase
      .from("web_checklist_items")
      .insert({ project_id: projectId, label: parsed.data, position: (count ?? 0) + 1 });
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined);
  });
}

const DEFAULT_CHECKLIST = [
  "Textos revisados y sin erratas",
  "Diseño responsive revisado en móvil, tablet y escritorio",
  "Formularios probados y entregando correctamente",
  "SEO básico: títulos, descripciones y Open Graph",
  "Favicon e imágenes optimizadas",
  "Aviso legal, privacidad y cookies",
  "Analítica configurada",
  "Dominio, DNS y HTTPS verificados",
  "Copia de seguridad / repositorio actualizado",
  "Accesos entregados al cliente (vía gestor de contraseñas)",
];

export async function addDefaultChecklist(projectId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("web_checklist_items")
      .insert(DEFAULT_CHECKLIST.map((label, i) => ({ project_id: projectId, label, position: i + 1 })));
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined, "Checklist añadida");
  });
}

export async function toggleChecklistItem(id: string, projectId: string, done: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase
      .from("web_checklist_items")
      .update({ done, done_by: done ? ctx.userId : null, done_at: done ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("project_id", projectId);
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/webs");
    return ok(undefined);
  });
}

export async function deleteChecklistItem(id: string, projectId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("web_checklist_items").delete().eq("id", id).eq("project_id", projectId);
    if (error) return fromDbError(error);
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined);
  });
}

export async function addSecretReference(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = secretReferenceSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    if (looksLikeSecret(parsed.data.vault_reference) || (parsed.data.notes && looksLikeSecret(parsed.data.notes))) {
      return fail("Parece que has pegado una credencial. Guarda solo la referencia al elemento del gestor de contraseñas.", {
        vault_reference: "No pegues contraseñas ni claves aquí",
      });
    }
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("secret_references").insert({ ...parsed.data, created_by: ctx.userId });
    if (error) return fromDbError(error, "Solo el responsable del proyecto o un administrador puede añadir accesos.");
    revalidatePath(`/proyectos/${parsed.data.project_id}`);
    return ok(undefined, "Referencia guardada");
  });
}

export async function deleteSecretReference(id: string, projectId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    const { error, count } = await ctx.supabase.from("secret_references").delete({ count: "exact" }).eq("id", id).eq("project_id", projectId);
    if (error) return fromDbError(error);
    if (!count) return fail("Solo el responsable del proyecto o un administrador puede eliminarla.");
    revalidatePath(`/proyectos/${projectId}`);
    return ok(undefined, "Referencia eliminada");
  });
}
