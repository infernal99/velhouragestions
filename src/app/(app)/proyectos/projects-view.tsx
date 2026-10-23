"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, FolderKanban, LayoutGrid, Table2 } from "lucide-react";
import { KanbanBoard } from "@/components/shared/kanban";
import { SortableTable } from "@/components/shared/sortable-table";
import { ViewSwitcher } from "@/components/shared/view-switcher";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { useApp, useMemberName, useProjectStatus } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { updateProjectStatus } from "@/lib/actions/projects";
import { priorityMap, PRIORITY_RANK, projectTypeLabel } from "@/lib/labels";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProjectsCalendar } from "./projects-calendar";
import type { Project } from "@/types/database";

export type ProjectRow = Project & {
  client: { id: string; name: string } | null;
  project_members: { user_id: string }[];
};

const statusColors: Record<string, string> = {
  pendiente: "#94a3b8",
  planificado: "#38bdf8",
  en_desarrollo: "var(--brand)",
  revision: "#f59e0b",
  entregado: "#22c55e",
  pausado: "#a1a1aa",
  cancelado: "#ef4444",
};

export function ProjectsView({
  projects,
  view,
  showArchived,
}: {
  projects: ProjectRow[];
  view: "tarjetas" | "tabla" | "kanban" | "calendario";
  showArchived: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const create = useCreate();
  const memberName = useMemberName();
  const { team, company } = useApp();
  const { map: projectStatusMap, options: projectStatusOptions } = useProjectStatus();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ status: null, type: null, owner: null });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return projects.filter((p) => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.owner && p.owner_id !== filters.owner && !p.project_members.some((m) => m.user_id === filters.owner)) return false;
      if (!q) return true;
      return [p.name, p.client?.name, memberName(p.owner_id)].some((v) => normalize(v).includes(q));
    });
  }, [projects, search, filters, memberName]);

  const owner = (p: ProjectRow) => team.find((m) => m.id === p.owner_id);

  const toggleArchived = () => {
    const p = new URLSearchParams(params.toString());
    if (showArchived) p.delete("archivados");
    else p.set("archivados", "1");
    router.replace(`${pathname}?${p.toString()}`);
  };

  if (projects.length === 0 && !showArchived) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Todavía no hay proyectos"
        description="Crea un proyecto para organizar tareas, entregas, archivos y cobros en un mismo sitio."
        action={<Button onClick={() => create({ kind: "project" })}>Crear proyecto</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por proyecto, cliente o responsable…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[
            { key: "status", label: "Todos los estados", options: projectStatusOptions.map((o) => ({ value: o.value, label: o.label })) },
            { key: "type", label: "Todos los tipos", options: company.projectTypes.map((t) => ({ value: t, label: projectTypeLabel(t) })) },
            { key: "owner", label: "Todo el equipo", options: team.map((m) => ({ value: m.id, label: m.full_name || m.email })) },
          ]}
        >
          <Button variant={showArchived ? "secondary" : "ghost"} size="sm" onClick={toggleArchived}>
            {showArchived ? "Ver activos" : "Archivados"}
          </Button>
        </FilterBar>
        <ViewSwitcher
          current={view}
          views={[
            { value: "tarjetas", label: "Tarjetas", icon: LayoutGrid },
            { value: "tabla", label: "Tabla", icon: Table2 },
            { value: "kanban", label: "Kanban", icon: Columns3 },
            { value: "calendario", label: "Calendario", icon: CalendarDays },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact title={showArchived ? "No hay proyectos archivados" : "Ningún proyecto coincide con los filtros"} />
      ) : view === "tarjetas" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              clientName={p.client?.name}
              ownerName={memberName(p.owner_id)}
              ownerAvatar={owner(p)?.avatar_url}
            />
          ))}
        </div>
      ) : view === "tabla" ? (
        <SortableTable
          rows={filtered}
          onRowClick={(p) => router.push(`/proyectos/${p.id}`)}
          initialSort={{ key: "due", dir: "asc" }}
          columns={[
            {
              key: "name",
              header: "Proyecto",
              sortValue: (p) => p.name,
              cell: (p) => (
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{projectTypeLabel(p.type)}</p>
                </div>
              ),
            },
            { key: "client", header: "Cliente", sortValue: (p) => p.client?.name, cell: (p) => p.client?.name ?? "—" },
            { key: "status", header: "Estado", sortValue: (p) => p.status, cell: (p) => <OptionBadge value={p.status} map={projectStatusMap} /> },
            {
              key: "priority",
              header: "Prioridad",
              sortValue: (p) => PRIORITY_RANK[p.priority],
              cell: (p) => <OptionBadge value={p.priority} map={priorityMap} />,
            },
            { key: "owner", header: "Responsable", sortValue: (p) => memberName(p.owner_id), cell: (p) => memberName(p.owner_id) ?? "—" },
            {
              key: "progress",
              header: "Progreso",
              sortValue: (p) => p.progress,
              cell: (p) => <ProgressBar value={p.progress} className="w-28" />,
            },
            {
              key: "due",
              header: "Fecha límite",
              sortValue: (p) => p.due_date,
              cell: (p) => (
                <span className={cn(isOverdue(p.due_date, ["entregado", "cancelado"].includes(p.status)) && "font-medium text-destructive")}>
                  {formatDate(p.due_date)}
                </span>
              ),
            },
            {
              key: "budget",
              header: "Presupuesto",
              sortValue: (p) => (p.budget == null ? null : Number(p.budget)),
              cell: (p) => (p.budget == null ? "—" : formatMoney(p.budget, company.currency)),
              className: "text-right tabular",
              headerClassName: "text-right",
            },
          ]}
        />
      ) : view === "kanban" ? (
        <KanbanBoard
          columns={projectStatusOptions.map((s) => ({ id: s.value, title: s.label, color: statusColors[s.value] }))}
          items={filtered}
          getColumn={(p) => p.status}
          onMove={async (p, to) => {
            const res = await runAction(updateProjectStatus(p.id, to));
            if (res.ok) router.refresh();
            return res.ok;
          }}
          renderCard={(p) => (
            <ProjectCard project={p} clientName={p.client?.name} ownerName={memberName(p.owner_id)} ownerAvatar={owner(p)?.avatar_url} compact />
          )}
        />
      ) : (
        <ProjectsCalendar projects={filtered} />
      )}
    </div>
  );
}
