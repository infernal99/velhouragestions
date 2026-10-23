import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/components/tasks/task-list";
import type { Task } from "@/types/database";

// Shared select for task lists: project name + subtask/comment counts.
export const TASK_SELECT =
  "*, project:projects(id, name), subtasks:tasks!parent_id(count), comments(count)";

type RawTask = Task & {
  project: { id: string; name: string } | null;
  subtasks: { count: number }[];
  comments: { count: number }[];
};

export function toTaskRows(rows: RawTask[] | null): TaskRow[] {
  return (rows ?? []).map(({ subtasks, comments, ...t }) => ({
    ...t,
    subtask_count: subtasks?.[0]?.count ?? 0,
    comment_count: comments?.[0]?.count ?? 0,
  }));
}

export async function listTasks(
  companyId: string,
  opts: { projectId?: string; assigneeId?: string; openOnly?: boolean; limit?: number } = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("company_id", companyId)
    .is("parent_id", null)
    .order("position", { ascending: true })
    .limit(opts.limit ?? 1000);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
  if (opts.openOnly) q = q.neq("status", "completada");
  const { data } = await q.returns<RawTask[]>();
  return toTaskRows(data);
}
