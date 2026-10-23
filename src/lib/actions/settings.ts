"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import {
  brandingSchema,
  categorySchema,
  companyProfileSchema,
  preferencesSchema,
  projectSettingsSchema,
  regionalSchema,
} from "@/lib/validation/settings";
import { webStageSchema } from "@/lib/validation/projects";

async function updateCompany(values: Record<string, unknown>, message: string): Promise<ActionResult> {
  const ctx = await actionContext("settings");
  const { error } = await ctx.supabase.from("companies").update(values).eq("id", ctx.company.id);
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return ok(undefined, message);
}

export async function saveCompanyProfile(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = companyProfileSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    return updateCompany(parsed.data, "Datos de la empresa guardados");
  });
}

export async function saveBranding(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = brandingSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    return updateCompany(parsed.data, "Color actualizado");
  });
}

export async function setCompanyLogo(url: string | null): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    if (url && !url.includes(`/storage/v1/object/public/public-assets/logos/${ctx.company.id}/`)) return fail("Imagen no válida.");
    return updateCompany({ logo_url: url }, url ? "Logotipo actualizado" : "Logotipo eliminado");
  });
}

export async function saveRegional(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = regionalSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    return updateCompany(parsed.data, "Preferencias regionales guardadas");
  });
}

export async function saveProjectSettings(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = projectSettingsSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const types = [...new Set(parsed.data.project_types)];
    if (!types.includes("web")) return fail("El tipo «web» es necesario para la sección Webs en desarrollo.");
    const labels = Object.fromEntries(Object.entries(parsed.data.project_status_labels).filter(([, v]) => v));
    return updateCompany({ project_types: types, project_status_labels: labels }, "Tipos y estados guardados");
  });
}

export async function savePreferences(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    return updateCompany({ preferences: parsed.data }, "Preferencias guardadas");
  });
}

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("settings");
    const { error } = id
      ? await ctx.supabase.from("expense_categories").update(parsed.data).eq("id", id).eq("company_id", ctx.company.id)
      : await ctx.supabase.from("expense_categories").insert({ ...parsed.data, company_id: ctx.company.id });
    if (error) return fromDbError(error);
    revalidatePath("/ajustes");
    return ok(undefined, "Categoría guardada");
  });
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("settings");
    const { error } = await ctx.supabase.from("expense_categories").delete().eq("id", id).eq("company_id", ctx.company.id);
    if (error) return fromDbError(error);
    revalidatePath("/ajustes");
    return ok(undefined, "Categoría eliminada; sus gastos quedan sin categoría");
  });
}

/** Replace the ordered list of web stages (rename, recolour, add, remove, reorder). */
export async function saveWebStages(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = z.array(webStageSchema).min(1, "Debe haber al menos una etapa").max(20).safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("settings");
    const { data: existing } = await ctx.supabase.from("web_stages").select("id").eq("company_id", ctx.company.id);
    const keep = new Set(parsed.data.map((s) => s.id).filter(Boolean));
    const toDelete = (existing ?? []).map((s) => s.id as string).filter((id) => !keep.has(id));
    if (toDelete.length) {
      const { error } = await ctx.supabase.from("web_stages").delete().in("id", toDelete);
      if (error) return fromDbError(error);
    }
    // two-phase positions: the unique (company, position) constraint is deferrable,
    // but separate requests aren't one transaction, so park existing rows first
    for (const [i, s] of parsed.data.entries()) {
      if (s.id) await ctx.supabase.from("web_stages").update({ position: 1000 + i }).eq("id", s.id);
    }
    for (const [i, s] of parsed.data.entries()) {
      const values = { name: s.name, color: s.color, position: i + 1 };
      const { error } = s.id
        ? await ctx.supabase.from("web_stages").update(values).eq("id", s.id).eq("company_id", ctx.company.id)
        : await ctx.supabase.from("web_stages").insert({ ...values, company_id: ctx.company.id });
      if (error) return fromDbError(error);
    }
    revalidatePath("/ajustes");
    revalidatePath("/webs");
    return ok(undefined, "Etapas guardadas");
  });
}
