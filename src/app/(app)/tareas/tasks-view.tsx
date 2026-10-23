"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckSquare, Columns3, List, User } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { KanbanBoard } from "@/components/shared/kanban";
import { ViewSwitcher } from "@/components/shared/view-switcher";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { TaskCollection } from "@/components/tasks/task-collection";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { dueTone, type TaskRow } from "@/components/tasks/task-list";
import { useApp, useMemberName } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { updateTaskDueDate, updateTaskStatus } from "@/lib/actions/tasks";
import { priorityMap, priorityOptions, taskStatusOptions } from "@/lib/labels";
import { formatDate, isOverdue, todayISO } from "@/lib/format";

type View = "lista" | "mias" | "kanban" | "calendario";

const statusColors: Record<string, string> = {
  pendiente: "#94a3b8",
  en_progreso: "var(--brand)",
  revision: "#f59e0b",
  bloqueada: "#ef4444",
  completada: "#22c55e",
};

const dueFilters = [
  { value: "vencidas", label: "Vencidas" },
  { value: "hoy", label: "Vencen hoy" },
  { value: "semana", label: "Próximos 7 días" },
  { value: "sin_fecha", label: "Sin fecha" },
];

function matchesDue(t: TaskRow, f: string) {
  const today = todayISO();
  if (f === "vencidas") return t.status !== "completada" && isOverdue(t.due_date);
  if (f === "hoy") return t.due_date === today;
  if (f === "semana") {
    if (!t.due_date) return false;
    const limit = new Date(`${today}T12:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 7);
    return t.due_date >= today && t.due_date <= limit.toISOString().slice(0, 10);
  }
  if (f === "sin_fecha") return !t.due_date;
  return true;
}

export function TasksView({ tasks, view }: { tasks: TaskRow[]; view: View }) {
  const router = useRouter();
  const create = useCreate();
  const memberName = useMemberName();
  const { team, userId } = useApp();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ assignee: null, priority: null, status: null, project: null, due: null });

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) if (t.project) map.set(t.project.id, t.project.name);
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return tasks.filter((t) => {
      if (view === "mias" && t.assignee_id !== userId) return false;
      if (filters.assignee && (filters.assignee === "__none" ? t.assignee_id : t.assignee_id !== filters.assignee)) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.project && (filters.project === "__none" ? t.project_id : t.project_id !== filters.project)) return false;
      if (filters.due && !matchesDue(t, filters.due)) return false;
      return !q || [t.title, t.project?.name, ...t.labels].some((v) => normalize(v).includes(q));
    });
  }, [tasks, search, filters, view, userId]);

  const [openId, setOpenId] = useState<string | null>(null);
  const openTask = (id: string | null) => {
    setOpenId(id);
  };

  const filterBar = (
    <FilterBar
      search={search}
      onSearch={setSearch}
      placeholder="Buscar tareas o etiquetas…"
      values={filters}
      onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
      filters={[
        ...(view !== "mias"
          ? [{ key: "assignee", label: "Responsable", options: [{ value: "__none", label: "Sin asignar" }, ...team.map((m) => ({ value: m.id, label: m.full_name || m.email }))] }]
          : []),
        { key: "priority", label: "Prioridad", options: priorityOptions.map((o) => ({ value: o.value, label: o.label })) },
        ...(view !== "kanban" ? [{ key: "status", label: "Estado", options: taskStatusOptions.map((o) => ({ value: o.value, label: o.label })) }] : []),
        { key: "project", label: "Proyecto", options: [{ value: "__none", label: "Independientes" }, ...projects] },
        { key: "due", label: "Vencimiento", options: dueFilters },
      ]}
    />
  );

  const overdueCount = tasks.filter((t) => t.status !== "completada" && isOverdue(t.due_date)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitcher
          current={view}
          views={[
            { value: "lista", label: "Todas", icon: List },
            { value: "mias", label: "Mis tareas", icon: User },
            { value: "kanban", label: "Kanban", icon: Columns3 },
            { value: "calendario", label: "Calendario", icon: CalendarDays },
          ]}
        />
        {overdueCount ? (
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, due: f.due === "vencidas" ? null : "vencidas" }))}
            className="text-sm font-medium text-destructive hover:underline"
          >
            {overdueCount} tarea{overdueCount === 1 ? "" : "s"} vencida{overdueCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      {filterBar}

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No hay tareas todavía"
          description="Crea tareas dentro de un proyecto o tareas internas independientes."
          action={<Button onClick={() => create({ kind: "task" })}>Crear tarea</Button>}
        />
      ) : view === "lista" || view === "mias" ? (
        <TaskCollection
          tasks={filtered}
          hideNewButton
          emptyMessage={view === "mias" ? "No tienes tareas con estos filtros." : "Ninguna tarea coincide con los filtros."}
        />
      ) : view === "kanban" ? (
        <>
          <KanbanBoard
            columns={taskStatusOptions.map((s) => ({ id: s.value, title: s.label, color: statusColors[s.value] }))}
            items={filtered}
            getColumn={(t) => t.status}
            onMove={async (t, to) => {
              const res = await runAction(updateTaskStatus(t.id, to));
              if (res.ok) router.refresh();
              return res.ok;
            }}
            renderCard={(t) => {
              const tone = dueTone(t);
              const assignee = team.find((m) => m.id === t.assignee_id);
              return (
                <button
                  type="button"
                  onClick={() => openTask(t.id)}
                  className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left text-sm shadow-xs transition-colors hover:border-foreground/20"
                >
                  <p className="leading-snug font-medium">{t.title}</p>
                  {t.project ? <p className="truncate text-xs text-muted-foreground">{t.project.name}</p> : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.priority === "alta" || t.priority === "urgente" ? <OptionBadge value={t.priority} map={priorityMap} /> : null}
                    {t.due_date ? (
                      <StatusBadge tone={tone} dot={false}>
                        {formatDate(t.due_date, "d MMM")}
                      </StatusBadge>
                    ) : null}
                    {t.assignee_id ? <UserAvatar name={memberName(t.assignee_id)} src={assignee?.avatar_url} size="xs" className="ml-auto size-5" /> : null}
                  </div>
                </button>
              );
            }}
          />
          <TaskSheet task={filtered.find((t) => t.id === openId) ?? null} onClose={() => openTask(null)} />
        </>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-3">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={esLocale}
              firstDay={1}
              height="auto"
              editable
              eventStartEditable
              eventDurationEditable={false}
              dayMaxEvents={4}
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              events={filtered
                .filter((t) => t.due_date)
                .map((t) => ({
                  id: t.id,
                  title: t.title,
                  start: t.due_date!,
                  allDay: true,
                  backgroundColor: t.status === "completada" ? "#a1a1aa" : dueTone(t) === "danger" ? "#dc2626" : statusColors[t.status],
                  borderColor: "transparent",
                  textColor: "#fff",
                  classNames: t.status === "completada" ? ["line-through", "opacity-70"] : [],
                }))}
              eventClick={(info) => openTask(info.event.id)}
              dateClick={(info) => create({ kind: "task", defaults: { due_date: info.dateStr } })}
              eventDrop={async (info) => {
                const day = info.event.startStr.slice(0, 10);
                const res = await runAction(updateTaskDueDate(info.event.id, day));
                if (!res.ok) info.revert();
                else router.refresh();
              }}
            />
            <p className="pt-3 text-xs text-muted-foreground">
              Arrastra una tarea para cambiar su fecha límite. Haz clic en un día para crear una tarea con esa fecha.
            </p>
          </div>
          <TaskSheet task={filtered.find((t) => t.id === openId) ?? null} onClose={() => openTask(null)} />
        </>
      )}
    </div>
  );
}
