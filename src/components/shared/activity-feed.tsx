"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useApp, useMemberName } from "@/components/app-provider";
import { activityActionLabels, entityTypeLabels, projectStatusMapWith, quoteStatusMap, taskStatusMap } from "@/lib/labels";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ActivityEntry, ProjectStatus } from "@/types/database";

export type ActivityRow = ActivityEntry;

const statusLabel = (entity: string, value: unknown, custom: Partial<Record<ProjectStatus, string>>) => {
  const v = String(value ?? "");
  if (entity === "project") return projectStatusMapWith(custom)[v as ProjectStatus]?.label ?? v;
  if (entity === "task") return taskStatusMap[v as keyof typeof taskStatusMap]?.label ?? v;
  if (entity === "quote") return quoteStatusMap[v as keyof typeof quoteStatusMap]?.label ?? v;
  return v;
};

function linkFor(a: ActivityRow) {
  if (a.action === "deleted") return null;
  switch (a.entity_type) {
    case "project":
      return `/proyectos/${a.entity_id}`;
    case "client":
      return `/clientes/${a.entity_id}`;
    case "task":
      return `/tareas?tarea=${a.entity_id}`;
    case "quote":
      return `/finanzas/presupuestos/${a.entity_id}`;
    case "event":
      return "/calendario";
    case "file":
      return "/documentos";
    default:
      return a.project_id ? `/proyectos/${a.project_id}` : null;
  }
}

export function ActivityFeed({ items, empty = "Sin actividad registrada." }: { items: ActivityRow[]; empty?: string }) {
  const memberName = useMemberName();
  const { team, company } = useApp();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((a) => {
        const actor = team.find((m) => m.id === a.actor_id);
        const href = linkFor(a);
        const label = a.entity_type === "comment" ? "" : (a.entity_label ?? "");
        const meta = a.metadata as { from?: string; to?: string };
        return (
          <li key={a.id} className="flex gap-3 text-sm">
            <UserAvatar name={memberName(a.actor_id) ?? "Sistema"} src={actor?.avatar_url} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="leading-snug">
                <span className="font-medium">{memberName(a.actor_id) ?? "Sistema"}</span>{" "}
                <span className="text-muted-foreground">
                  {activityActionLabels[a.action] ?? a.action} {entityTypeLabels[a.entity_type] ?? a.entity_type}
                </span>{" "}
                {label ? (
                  href ? (
                    <Link href={href} className="font-medium hover:underline">
                      {label}
                    </Link>
                  ) : (
                    <span className="font-medium">{label}</span>
                  )
                ) : null}
                {a.action === "status_changed" && meta?.to ? (
                  <span className="text-muted-foreground">
                    {" "}
                    → {statusLabel(a.entity_type, meta.to, company.statusLabels)}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground" title={formatDateTime(a.created_at)}>
                {formatRelative(a.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
