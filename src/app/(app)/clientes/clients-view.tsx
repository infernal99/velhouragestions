"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarClock, Columns3, List, Mail } from "lucide-react";
import { KanbanBoard } from "@/components/shared/kanban";
import { SortableTable } from "@/components/shared/sortable-table";
import { ViewSwitcher } from "@/components/shared/view-switcher";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useApp, useMemberName } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { updateClientStage } from "@/lib/actions/clients";
import { crmStageMap, crmStageOptions } from "@/lib/labels";
import { formatCompactMoney, formatDate, formatMoney, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/database";

type Row = Client & { project_count: number };

const stageColors: Record<string, string> = {
  nuevo: "#94a3b8",
  contactado: "#38bdf8",
  reunion: "#818cf8",
  propuesta: "#a855f7",
  negociacion: "#f59e0b",
  ganado: "#22c55e",
  perdido: "#ef4444",
};

export function ClientsView({ clients, view, showArchived }: { clients: Row[]; view: "embudo" | "lista"; showArchived: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const create = useCreate();
  const memberName = useMemberName();
  const { team, company } = useApp();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({ stage: null, owner: null });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return clients.filter((c) => {
      if (filters.stage && c.stage !== filters.stage) return false;
      if (filters.owner && c.owner_id !== filters.owner) return false;
      if (!q) return true;
      return [c.name, c.contact_name, c.email, c.sector].some((v) => normalize(v).includes(q));
    });
  }, [clients, search, filters]);

  const toggleArchived = () => {
    const p = new URLSearchParams(params.toString());
    if (showArchived) p.delete("archivados");
    else p.set("archivados", "1");
    router.replace(`${pathname}?${p.toString()}`);
  };

  if (clients.length === 0 && !showArchived) {
    return (
      <EmptyState
        icon={Building2}
        title="Aún no hay clientes"
        description="Registra tu primer cliente o posible cliente para empezar a seguir el embudo comercial."
        action={<Button onClick={() => create({ kind: "client" })}>Añadir cliente</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por nombre, contacto…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          filters={[
            { key: "stage", label: "Todos los estados", options: crmStageOptions.map((o) => ({ value: o.value, label: o.label })) },
            { key: "owner", label: "Todos los responsables", options: team.map((m) => ({ value: m.id, label: m.full_name || m.email })) },
          ]}
        >
          <Button variant={showArchived ? "secondary" : "ghost"} size="sm" onClick={toggleArchived}>
            {showArchived ? "Ver activos" : "Ver archivados"}
          </Button>
        </FilterBar>
        <ViewSwitcher
          current={view}
          views={[
            { value: "embudo", label: "Embudo", icon: Columns3 },
            { value: "lista", label: "Lista", icon: List },
          ]}
        />
      </div>

      {view === "embudo" ? (
        <KanbanBoard
          columns={crmStageOptions.map((s) => {
            const value = filtered.filter((c) => c.stage === s.value).reduce((sum, c) => sum + Number(c.estimated_value ?? 0), 0);
            return {
              id: s.value,
              title: s.label,
              color: stageColors[s.value],
              hint: value > 0 ? formatCompactMoney(value, company.currency) : undefined,
            };
          })}
          items={filtered}
          getColumn={(c) => c.stage}
          onMove={async (c, to) => {
            const res = await runAction(updateClientStage(c.id, to));
            if (res.ok) router.refresh();
            return res.ok;
          }}
          renderCard={(c) => (
            <Link
              href={`/clientes/${c.id}`}
              className="block rounded-lg border bg-card p-3 text-sm shadow-xs transition-colors hover:border-foreground/20"
              draggable={false}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{c.name}</p>
                {c.owner_id ? <UserAvatar name={memberName(c.owner_id)} size="sm" /> : null}
              </div>
              {c.contact_name ? <p className="mt-0.5 text-xs text-muted-foreground">{c.contact_name}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {c.estimated_value ? <span className="tabular">{formatMoney(c.estimated_value, company.currency)}</span> : null}
                {c.next_action_date ? (
                  <span className={cn("inline-flex items-center gap-1", isOverdue(c.next_action_date) && "text-destructive")}>
                    <CalendarClock className="size-3" />
                    {formatDate(c.next_action_date, "d MMM")}
                  </span>
                ) : null}
              </div>
              {c.next_action ? <p className="mt-1.5 line-clamp-2 text-xs">{c.next_action}</p> : null}
            </Link>
          )}
        />
      ) : (
        <SortableTable
          rows={filtered}
          onRowClick={(c) => router.push(`/clientes/${c.id}`)}
          initialSort={{ key: "name", dir: "asc" }}
          empty={<EmptyState compact title="No hay clientes con estos filtros" />}
          columns={[
            {
              key: "name",
              header: "Cliente",
              sortValue: (c) => c.name,
              cell: (c) => (
                <div>
                  <p className="font-medium">{c.name}</p>
                  {c.contact_name ? <p className="text-xs text-muted-foreground">{c.contact_name}</p> : null}
                </div>
              ),
            },
            {
              key: "email",
              header: "Contacto",
              cell: (c) =>
                c.email ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="size-3.5" /> {c.email}
                  </span>
                ) : (
                  "—"
                ),
            },
            { key: "stage", header: "Estado", sortValue: (c) => c.stage, cell: (c) => <OptionBadge value={c.stage} map={crmStageMap} /> },
            {
              key: "owner",
              header: "Responsable",
              sortValue: (c) => memberName(c.owner_id),
              cell: (c) => memberName(c.owner_id) ?? "—",
            },
            { key: "projects", header: "Proyectos", sortValue: (c) => c.project_count, cell: (c) => c.project_count, className: "tabular" },
            {
              key: "next",
              header: "Seguimiento",
              sortValue: (c) => c.next_action_date,
              cell: (c) => (
                <span className={cn(isOverdue(c.next_action_date) && "font-medium text-destructive")}>{formatDate(c.next_action_date)}</span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
