"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { priorityMap, projectTypeLabel } from "@/lib/labels";
import { useProjectStatus } from "@/components/app-provider";
import { formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

export function ProjectCard({
  project,
  clientName,
  ownerName,
  ownerAvatar,
  compact,
}: {
  project: Pick<Project, "id" | "name" | "status" | "priority" | "type" | "due_date" | "progress" | "description">;
  clientName?: string | null;
  ownerName?: string | null;
  ownerAvatar?: string | null;
  compact?: boolean;
}) {
  const { map: projectStatusMap } = useProjectStatus();
  const overdue = isOverdue(project.due_date, ["entregado", "cancelado"].includes(project.status));
  return (
    <Link
      href={`/proyectos/${project.id}`}
      draggable={false}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all duration-200 ease-out hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium leading-snug">{project.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {clientName ?? "Sin cliente"} · {projectTypeLabel(project.type)}
          </p>
        </div>
        {ownerName ? <UserAvatar name={ownerName} src={ownerAvatar} size="sm" /> : null}
      </div>
      {!compact && project.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      ) : null}
      <ProgressBar value={project.progress} />
      <div className="flex flex-wrap items-center gap-1.5">
        {!compact ? <OptionBadge value={project.status} map={projectStatusMap} /> : null}
        {project.priority === "alta" || project.priority === "urgente" ? (
          <OptionBadge value={project.priority} map={priorityMap} />
        ) : null}
        {project.due_date ? (
          <StatusBadge tone={overdue ? "danger" : "muted"} dot={false} className="ml-auto">
            <CalendarClock className="size-3" />
            <span className={cn(overdue && "font-semibold")}>{formatDate(project.due_date, "d MMM yyyy")}</span>
          </StatusBadge>
        ) : null}
      </div>
    </Link>
  );
}
