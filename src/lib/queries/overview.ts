import "server-only";
import { addDays } from "date-fns";
import type { createClient } from "@/lib/supabase/server";
import { dayInAppTz, formatDate } from "@/lib/format";
import { crmStageOptions, projectStatusMapWith, projectStatusOptions, taskStatusOptions } from "@/lib/labels";
import { currentTimeMs } from "@/lib/queries/time";
import type { Slice } from "@/components/charts/simple-charts";
import type { ProjectStatus } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TASK_COLORS: Record<string, string> = {
  pendiente: "#94a3b8",
  en_progreso: "#6366f1",
  revision: "#f59e0b",
  bloqueada: "#f43f5e",
  completada: "#10b981",
};

const PROJECT_COLORS: Record<string, string> = {
  pendiente: "#94a3b8",
  planificado: "#0ea5e9",
  en_desarrollo: "#6366f1",
  revision: "#f59e0b",
  entregado: "#10b981",
  pausado: "#a1a1aa",
  cancelado: "#f43f5e",
};

const STAGE_COLORS: Record<string, string> = {
  nuevo: "#94a3b8",
  contactado: "#0ea5e9",
  reunion: "#6366f1",
  propuesta: "#a855f7",
  negociacion: "#f59e0b",
  ganado: "#10b981",
  perdido: "#f43f5e",
};

/** Everything the dashboard charts need, computed from the user's visible rows. */
export async function getOverview(
  supabase: Supabase,
  companyId: string,
  statusLabels: Partial<Record<ProjectStatus, string>>,
) {
  const now = currentTimeMs();
  const since = addDays(new Date(now), -8).toISOString();

  const [tasks, projects, clients, hours] = await Promise.all([
    supabase.from("tasks").select("status").eq("company_id", companyId).is("parent_id", null).limit(5000),
    supabase.from("projects").select("status").eq("company_id", companyId).is("archived_at", null).limit(5000),
    supabase.from("clients").select("stage, estimated_value").eq("company_id", companyId).is("archived_at", null).limit(5000),
    supabase.from("time_entries").select("started_at, ended_at").eq("company_id", companyId).gte("started_at", since).limit(5000),
  ]);

  const tally = <T extends string>(rows: { [k: string]: unknown }[] | null, key: string, keys: T[]) => {
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r[key] as string, (counts.get(r[key] as string) ?? 0) + 1);
    return keys.map((k) => ({ key: k, value: counts.get(k) ?? 0 }));
  };

  const tasksByStatus: Slice[] = tally(tasks.data, "status", taskStatusOptions.map((o) => o.value)).map((t) => ({
    name: taskStatusOptions.find((o) => o.value === t.key)!.label,
    value: t.value,
    color: TASK_COLORS[t.key],
  }));

  const labels = projectStatusMapWith(statusLabels);
  const projectsByStatus: Slice[] = tally(projects.data, "status", projectStatusOptions.map((o) => o.value)).map((p) => ({
    name: labels[p.key as ProjectStatus].label,
    value: p.value,
    color: PROJECT_COLORS[p.key],
  }));

  const funnel: Slice[] = crmStageOptions
    .filter((s) => s.value !== "perdido")
    .map((s) => ({
      name: s.label,
      value: (clients.data ?? []).filter((c) => c.stage === s.value).reduce((sum, c) => sum + Number(c.estimated_value ?? 0), 0),
      color: STAGE_COLORS[s.value],
    }));
  const funnelCounts = crmStageOptions.map((s) => ({ stage: s.value, count: (clients.data ?? []).filter((c) => c.stage === s.value).length }));

  // last 7 calendar days (app timezone), running timers counted up to now
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(now), i - 6));
  const minutesByDay = new Map<string, number>(days.map((d) => [dayInAppTz(d), 0]));
  for (const e of hours.data ?? []) {
    const key = dayInAppTz(new Date(e.started_at as string));
    if (!minutesByDay.has(key)) continue;
    const end = e.ended_at ? Date.parse(e.ended_at as string) : now;
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + Math.max(0, (end - Date.parse(e.started_at as string)) / 60_000));
  }
  const hoursByDay = days.map((d) => ({
    label: formatDate(d, "EEE d"),
    value: Math.round(((minutesByDay.get(dayInAppTz(d)) ?? 0) / 60) * 10) / 10,
  }));

  return { tasksByStatus, projectsByStatus, funnel, funnelCounts, hoursByDay };
}
