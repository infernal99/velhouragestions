"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ListChecks, MessageSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useApp, useMemberName } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { priorityMap, taskStatusMap } from "@/lib/labels";
import { formatDate, isOverdue, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

export type TaskRow = Task & {
  project?: { id: string; name: string } | null;
  subtask_count?: number;
  comment_count?: number;
};

export function dueTone(task: Pick<Task, "due_date" | "status">) {
  if (!task.due_date || task.status === "completada") return "muted" as const;
  if (isOverdue(task.due_date)) return "danger" as const;
  if (task.due_date === todayISO()) return "warning" as const;
  return "muted" as const;
}

export function TaskListItem({
  task,
  onOpen,
  showProject = true,
}: {
  task: TaskRow;
  onOpen: (task: TaskRow) => void;
  showProject?: boolean;
}) {
  const router = useRouter();
  const memberName = useMemberName();
  const { team } = useApp();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const done = optimistic ?? task.status === "completada";
  const assignee = team.find((m) => m.id === task.assignee_id);
  const tone = dueTone(task);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
        tone === "danger" && !done && "bg-red-500/[0.03]",
      )}
    >
      <Checkbox
        checked={done}
        aria-label={done ? "Marcar como pendiente" : "Marcar como completada"}
        onCheckedChange={async (checked) => {
          setOptimistic(Boolean(checked));
          const res = await runAction(updateTaskStatus(task.id, checked ? "completada" : "pendiente"));
          if (!res.ok) setOptimistic(null);
          else router.refresh();
        }}
      />
      <button type="button" onClick={() => onOpen(task)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", done && "text-muted-foreground line-through")}>{task.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {showProject && task.project ? <span className="truncate">{task.project.name}</span> : null}
            {task.labels.slice(0, 3).map((l) => (
              <span key={l} className="rounded bg-muted px-1 py-px">
                {l}
              </span>
            ))}
            {task.subtask_count ? (
              <span className="inline-flex items-center gap-0.5">
                <ListChecks className="size-3" />
                {task.subtask_count}
              </span>
            ) : null}
            {task.comment_count ? (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-3" />
                {task.comment_count}
              </span>
            ) : null}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {task.status !== "pendiente" && task.status !== "completada" ? (
            <OptionBadge value={task.status} map={taskStatusMap} />
          ) : null}
          {task.priority === "alta" || task.priority === "urgente" ? <OptionBadge value={task.priority} map={priorityMap} /> : null}
        </div>
        {task.due_date ? (
          <StatusBadge tone={tone} dot={false} className="shrink-0">
            <CalendarClock className="size-3" />
            {tone === "danger" ? "Vencida · " : ""}
            {formatDate(task.due_date, "d MMM")}
          </StatusBadge>
        ) : null}
        {task.assignee_id ? (
          <UserAvatar name={memberName(task.assignee_id)} src={assignee?.avatar_url} size="sm" />
        ) : (
          <span className="size-6 shrink-0 rounded-full border border-dashed" />
        )}
      </button>
    </div>
  );
}
