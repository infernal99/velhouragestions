import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TimeEntry } from "@/types/database";

export type TimeEntryRow = TimeEntry & {
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
};

/** The signed-in user's running timer, if any. */
export async function getRunningEntry(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*, project:projects(id, name), task:tasks(id, title)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle<TimeEntryRow>();
  return data ?? null;
}

export async function listTimeEntries(
  companyId: string,
  opts: { from?: string; to?: string; projectId?: string; userId?: string; limit?: number } = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("time_entries")
    .select("*, project:projects(id, name), task:tasks(id, title)")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? 2000);
  if (opts.from) q = q.gte("started_at", opts.from);
  if (opts.to) q = q.lt("started_at", opts.to);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data } = await q.returns<TimeEntryRow[]>();
  return data ?? [];
}

/** Request-time clock (kept out of components: they must stay pure). */
export function currentTimeMs() {
  return Date.now();
}
