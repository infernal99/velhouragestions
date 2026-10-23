"use server";

import { actionContext, run } from "@/lib/actions/guard";
import { ok, type ActionResult } from "@/lib/actions/result";

export interface Lookups {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; client_id: string | null }[];
  expenseCategories: { id: string; name: string }[];
  webStages: { id: string; name: string; color: string }[];
}

/** Options for selects in create/edit dialogs — only what the user can see. */
export async function getLookups(): Promise<ActionResult<Lookups>> {
  return run(async () => {
    const ctx = await actionContext();
    const [clients, projects, categories, stages] = await Promise.all([
      ctx.supabase
        .from("clients")
        .select("id, name")
        .eq("company_id", ctx.company.id)
        .is("archived_at", null)
        .order("name"),
      ctx.supabase
        .from("projects")
        .select("id, name, client_id")
        .eq("company_id", ctx.company.id)
        .is("archived_at", null)
        .order("name"),
      ctx.supabase.from("expense_categories").select("id, name").eq("company_id", ctx.company.id).order("name"),
      ctx.supabase.from("web_stages").select("id, name, color").eq("company_id", ctx.company.id).order("position"),
    ]);
    return ok({
      clients: (clients.data ?? []) as Lookups["clients"],
      projects: (projects.data ?? []) as Lookups["projects"],
      expenseCategories: (categories.data ?? []) as Lookups["expenseCategories"],
      webStages: (stages.data ?? []) as Lookups["webStages"],
    });
  });
}
