"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions/result";
import type { AppNotification } from "@/types/database";

export interface SearchResult {
  kind: "client" | "project" | "task" | "file";
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export async function globalSearch(query: string): Promise<ActionResult<SearchResult[]>> {
  return run(async () => {
    const q = z.string().trim().min(2).max(100).safeParse(query);
    if (!q.success) return ok([]);
    const ctx = await actionContext();
    // The RPC runs as the user: RLS filters every result.
    const { data, error } = await ctx.supabase.rpc("global_search", {
      p_company: ctx.company.id,
      p_query: q.data.replace(/[%_\\]/g, (c) => `\\${c}`),
    });
    if (error) return fromDbError(error);
    return ok((data ?? []) as SearchResult[]);
  });
}

export async function listNotifications(): Promise<ActionResult<{ items: AppNotification[]; unread: number }>> {
  return run(async () => {
    const ctx = await actionContext();
    const [{ data, error }, { count }] = await Promise.all([
      ctx.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("company_id", ctx.company.id)
        .order("created_at", { ascending: false })
        .limit(30),
      ctx.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("company_id", ctx.company.id)
        .is("read_at", null),
    ]);
    if (error) return fromDbError(error);
    return ok({ items: (data ?? []) as AppNotification[], unread: count ?? 0 });
  });
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    let query = ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", ctx.userId)
      .is("read_at", null);
    if (ids?.length) {
      const parsed = z.array(z.uuid()).max(100).safeParse(ids);
      if (!parsed.success) return fail("Selección no válida.");
      query = query.in("id", parsed.data);
    }
    const { error } = await query;
    if (error) return fromDbError(error);
    revalidatePath("/notificaciones");
    return ok(undefined);
  });
}

export async function switchCompany(companyId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    if (!ctx.companies.some((c) => c.id === companyId)) return fail("No perteneces a esa empresa.");
    const { error } = await ctx.supabase.from("profiles").update({ active_company_id: companyId }).eq("id", ctx.userId);
    if (error) return fromDbError(error);
    revalidatePath("/", "layout");
    return ok(undefined);
  });
}
