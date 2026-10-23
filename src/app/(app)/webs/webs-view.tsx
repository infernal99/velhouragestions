"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, Columns3, ExternalLink, GitBranch, Globe, LayoutGrid, ListChecks, Table2 } from "lucide-react";
import { KanbanBoard } from "@/components/shared/kanban";
import { SortableTable } from "@/components/shared/sortable-table";
import { ViewSwitcher } from "@/components/shared/view-switcher";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useApp, useMemberName, useProjectStatus } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { setWebStage } from "@/lib/actions/projects";
import { webTypeMap, webTypeOptions } from "@/lib/labels";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Priority, ProjectStatus, WebDetails, WebStage } from "@/types/database";

export interface WebRow {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: Priority;
  due_date: string | null;
  progress: number;
  budget: number | null;
  owner_id: string | null;
  client: { id: string; name: string } | null;
  web_details: WebDetails | null;
  web_requests: { status: string }[];
  web_checklist_items: { done: boolean }[];
  invoiced: number | null;
  collected: number | null;
}

const NO_STAGE = "__sin_etapa__";

function WebCard({ web, stageName }: { web: WebRow; stageName?: string }) {
  const memberName = useMemberName();
  const { team, company } = useApp();
  const owner = team.find((m) => m.id === web.owner_id);
  const openRequests = web.web_requests.filter((r) => r.status === "abierto" || r.status === "en_curso").length;
  const checklistDone = web.web_checklist_items.filter((c) => c.done).length;
  const overdue = isOverdue(web.due_date, ["entregado", "cancelado"].includes(web.status));
  const d = web.web_details;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/proyectos/${web.id}?tab=web`} draggable={false} className="min-w-0 hover:underline">
          <p className="truncate font-medium">{web.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {web.client?.name ?? "Sin cliente"} · {d ? webTypeMap[d.web_type]?.label : "Web"}
          </p>
        </Link>
        {web.owner_id ? <UserAvatar name={memberName(web.owner_id)} src={owner?.avatar_url} size="sm" /> : null}
      </div>
      <ProgressBar value={web.progress} />
      <div className="flex flex-wrap items-center gap-1.5">
        {stageName ? <StatusBadge tone="brand">{stageName}</StatusBadge> : null}
        {web.due_date ? (
          <StatusBadge tone={overdue ? "danger" : "muted"} dot={false}>
            <CalendarClock className="size-3" /> {formatDate(web.due_date, "d MMM")}
          </StatusBadge>
        ) : null}
        {openRequests ? (
          <StatusBadge tone="warning" dot={false}>
            <AlertCircle className="size-3" /> {openRequests} pendiente{openRequests === 1 ? "" : "s"}
          </StatusBadge>
        ) : null}
        {web.web_checklist_items.length ? (
          <StatusBadge tone={checklistDone === web.web_checklist_items.length ? "success" : "muted"} dot={false}>
            <ListChecks className="size-3" /> {checklistDone}/{web.web_checklist_items.length}
          </StatusBadge>
        ) : null}
      </div>
      {web.invoiced !== null || web.budget != null ? (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-[11px]">
          <div>
            <p className="text-muted-foreground">Presupuesto</p>
            <p className="font-medium tabular">{web.budget != null ? formatMoney(web.budget, company.currency) : "—"}</p>
          </div>
          {web.invoiced !== null ? (
            <>
              <div>
                <p className="text-muted-foreground">Cobrado</p>
                <p className="font-medium tabular">{formatMoney(web.collected ?? 0, company.currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pendiente</p>
                <p className="font-medium tabular">{formatMoney((web.invoiced ?? 0) - (web.collected ?? 0), company.currency)}</p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {d && (d.dev_url || d.production_url || d.repository_url) ? (
        <div className="flex flex-wrap gap-1.5">
          {d.dev_url ? <UrlChip href={d.dev_url} icon={Globe} label="Desarrollo" /> : null}
          {d.production_url ? <UrlChip href={d.production_url} icon={Globe} label="Producción" /> : null}
          {d.repository_url ? <UrlChip href={d.repository_url} icon={GitBranch} label="Repo" /> : null}
        </div>
      ) : null}
    </div>
  );
}

function UrlChip({ href, icon: Icon, label }: { href: string; icon: typeof Globe; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-3" /> {label} <ExternalLink className="size-2.5" />
    </a>
  );
}

export function WebsView({ webs, stages, view }: { webs: WebRow[]; stages: WebStage[]; view: "etapas" | "fichas" | "tabla" }) {
  const router = useRouter();
  const create = useCreate();
  const memberName = useMemberName();
  const { team, company, permissions } = useApp();
  const { map: projectStatusMap } = useProjectStatus();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ type: null, owner: null });
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return webs.filter((w) => {
      if (filters.type && w.web_details?.web_type !== filters.type) return false;
      if (filters.owner && w.owner_id !== filters.owner) return false;
      return !q || [w.name, w.client?.name, w.web_details?.domain].some((v) => normalize(v).includes(q));
    });
  }, [webs, search, filters]);

  if (webs.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No hay webs en desarrollo"
        description="Crea un proyecto de tipo «Web» para seguir su etapa, cobros, cambios del cliente y checklist de entrega."
        action={<Button onClick={() => create({ kind: "project", defaults: { type: "web", status: "planificado" } })}>Nueva web</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por web, cliente o dominio…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[
            { key: "type", label: "Todos los tipos", options: webTypeOptions.map((o) => ({ value: o.value, label: o.label })) },
            { key: "owner", label: "Todo el equipo", options: team.map((m) => ({ value: m.id, label: m.full_name || m.email })) },
          ]}
        />
        <div className="flex items-center gap-2">
          {permissions.canManageSettings ? (
            <Button variant="ghost" size="sm" render={<Link href="/ajustes?tab=proyectos" />} nativeButton={false}>
              Configurar etapas
            </Button>
          ) : null}
          <ViewSwitcher
            current={view}
            views={[
              { value: "etapas", label: "Etapas", icon: Columns3 },
              { value: "fichas", label: "Fichas", icon: LayoutGrid },
              { value: "tabla", label: "Tabla", icon: Table2 },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact title="Ninguna web coincide con los filtros" />
      ) : view === "etapas" ? (
        <KanbanBoard
          columns={[
            { id: NO_STAGE, title: "Sin etapa", color: "#a1a1aa" },
            ...stages.map((s) => ({ id: s.id, title: s.name, color: s.color })),
          ].filter((c) => c.id !== NO_STAGE || filtered.some((w) => !w.web_details?.stage_id))}
          items={filtered}
          getColumn={(w) => w.web_details?.stage_id ?? NO_STAGE}
          onMove={async (w, to) => {
            const res = await runAction(setWebStage(w.id, to === NO_STAGE ? null : to));
            if (res.ok) router.refresh();
            return res.ok;
          }}
          renderCard={(w) => <WebCard web={w} />}
        />
      ) : view === "fichas" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <WebCard key={w.id} web={w} stageName={w.web_details?.stage_id ? stageById.get(w.web_details.stage_id)?.name : undefined} />
          ))}
        </div>
      ) : (
        <SortableTable
          rows={filtered}
          onRowClick={(w) => router.push(`/proyectos/${w.id}?tab=web`)}
          initialSort={{ key: "due", dir: "asc" }}
          columns={[
            {
              key: "name",
              header: "Web",
              sortValue: (w) => w.name,
              cell: (w) => (
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.client?.name ?? "Sin cliente"}</p>
                </div>
              ),
            },
            { key: "type", header: "Tipo", sortValue: (w) => w.web_details?.web_type, cell: (w) => (w.web_details ? webTypeMap[w.web_details.web_type].label : "—") },
            {
              key: "stage",
              header: "Etapa",
              sortValue: (w) => (w.web_details?.stage_id ? stageById.get(w.web_details.stage_id)?.position : null),
              cell: (w) => (w.web_details?.stage_id ? stageById.get(w.web_details.stage_id)?.name : "—"),
            },
            { key: "status", header: "Estado", sortValue: (w) => w.status, cell: (w) => <OptionBadge value={w.status} map={projectStatusMap} /> },
            { key: "owner", header: "Responsable", sortValue: (w) => memberName(w.owner_id), cell: (w) => memberName(w.owner_id) ?? "—" },
            { key: "progress", header: "Progreso", sortValue: (w) => w.progress, cell: (w) => <ProgressBar value={w.progress} className="w-24" /> },
            {
              key: "due",
              header: "Entrega",
              sortValue: (w) => w.due_date,
              cell: (w) => (
                <span className={cn(isOverdue(w.due_date, ["entregado", "cancelado"].includes(w.status)) && "font-medium text-destructive")}>
                  {formatDate(w.due_date)}
                </span>
              ),
            },
            ...(permissions.canViewFinances
              ? [
                  {
                    key: "pending",
                    header: "Pendiente de cobro",
                    sortValue: (w: WebRow) => (w.invoiced ?? 0) - (w.collected ?? 0),
                    cell: (w: WebRow) => formatMoney((w.invoiced ?? 0) - (w.collected ?? 0), company.currency),
                    className: "text-right tabular",
                    headerClassName: "text-right",
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
