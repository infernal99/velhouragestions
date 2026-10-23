import type { Metadata } from "next";
import Link from "next/link";
import { addDays } from "date-fns";
import { AlertTriangle, Building2, CalendarDays, CheckSquare, FolderKanban, Receipt, TrendingUp, Wallet } from "lucide-react";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/queries/tasks";
import { resolvePeriod } from "@/lib/periods";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Panel } from "@/components/shared/info-list";
import { OptionBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ActivityFeed, type ActivityRow } from "@/components/shared/activity-feed";
import { TaskCollection } from "@/components/tasks/task-collection";
import { MonthlyChart, type MonthlyPoint } from "@/components/charts/monthly-chart";
import { ACTIVE_PROJECT_STATUSES, eventCategoryMap, projectStatusMapWith } from "@/lib/labels";
import { dayInAppTz, formatDate, formatDateLong, formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuickActions } from "./quick-actions";
import { PeriodSelect } from "./period-select";
import type { CalendarEvent, EventCategory, ProjectStatus } from "@/types/database";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const ctx = await requireContext();
  const { periodo } = await searchParams;
  const period = resolvePeriod(typeof periodo === "string" ? periodo : undefined);
  const supabase = await createClient();
  const today = todayISO();
  const in14 = dayInAppTz(addDays(new Date(), 14));
  const in7 = addDays(new Date(), 7).toISOString();
  const finance = ctx.permissions.canViewFinances;

  const [
    activeProjects,
    deadlines,
    openTasks,
    overdueTasks,
    myTasks,
    events,
    activeClients,
    activity,
    summary,
    monthly,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.company.id)
      .is("archived_at", null)
      .in("status", ACTIVE_PROJECT_STATUSES),
    supabase
      .from("projects")
      .select("id, name, status, due_date, progress, client:clients(name)")
      .eq("company_id", ctx.company.id)
      .is("archived_at", null)
      .in("status", ACTIVE_PROJECT_STATUSES)
      .not("due_date", "is", null)
      .lte("due_date", in14)
      .order("due_date")
      .limit(8)
      .returns<{ id: string; name: string; status: ProjectStatus; due_date: string; progress: number; client: { name: string } | null }[]>(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", ctx.company.id).neq("status", "completada"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.company.id)
      .neq("status", "completada")
      .lt("due_date", today),
    listTasks(ctx.company.id, { assigneeId: ctx.userId, openOnly: true, limit: 200 }),
    supabase
      .from("events")
      .select("id, title, category, starts_at, all_day, location")
      .eq("company_id", ctx.company.id)
      .gte("ends_at", new Date().toISOString())
      .lte("starts_at", in7)
      .order("starts_at")
      .limit(8)
      .returns<Pick<CalendarEvent, "id" | "title" | "category" | "starts_at" | "all_day" | "location">[]>(),
    supabase
      .from("projects")
      .select("client_id")
      .eq("company_id", ctx.company.id)
      .is("archived_at", null)
      .in("status", ACTIVE_PROJECT_STATUSES)
      .not("client_id", "is", null),
    supabase
      .from("activity_log")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<ActivityRow[]>(),
    finance
      ? supabase.rpc("finance_summary", { p_company: ctx.company.id, p_from: period.from, p_to: period.to })
      : Promise.resolve({ data: null }),
    finance ? supabase.rpc("finance_monthly", { p_company: ctx.company.id, p_months: 6 }) : Promise.resolve({ data: null }),
  ]);

  // "Mi día": overdue + due today first, then the next few with or without date.
  const mine = myTasks.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const myDay = mine.filter((t) => !t.due_date || t.due_date <= today).concat(mine.filter((t) => t.due_date && t.due_date > today)).slice(0, 8);
  const clientCount = new Set((activeClients.data ?? []).map((r) => r.client_id)).size;
  const s = (summary.data as { invoiced: number; collected: number; pending: number; overdue: number; expenses: number; profit: number }[] | null)?.[0];
  const c = ctx.company.currency;
  const firstName = (ctx.profile.full_name || ctx.profile.email).split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hola, ${firstName}`}
        description={<span className="capitalize">{formatDateLong(new Date())}</span>}
        actions={<QuickActions />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Proyectos activos" value={activeProjects.count ?? 0} icon={FolderKanban} href="/proyectos" accent="violet" />
        <StatCard
          label="Tareas pendientes"
          value={openTasks.count ?? 0}
          icon={CheckSquare}
          accent="sky"
          href="/tareas"
          hint={overdueTasks.count ? <span className="font-medium text-destructive">{overdueTasks.count} vencidas</span> : "Ninguna vencida"}
        />
        <StatCard label="Clientes activos" value={clientCount} icon={Building2} accent="orange" href="/clientes" hint="Con proyectos en curso" />
        <StatCard label="Próximos 7 días" value={events.data?.length ?? 0} icon={CalendarDays} accent="rose" href="/calendario" hint="Reuniones y eventos" />
      </div>

      {finance && s ? (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Finanzas · {period.label.toLowerCase()}</h2>
            <PeriodSelect value={period.key} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Cobros recibidos" value={formatMoney(s.collected, c)} icon={Wallet} accent="emerald" href="/finanzas/cobros" hint={`Facturado: ${formatMoney(s.invoiced, c)}`} />
            <StatCard
              label="Pendiente de cobro"
              value={formatMoney(s.pending, c)}
              icon={AlertTriangle}
              accent="amber"
              href="/finanzas/cobros"
              hint={Number(s.overdue) > 0 ? <span className="font-medium text-destructive">{formatMoney(s.overdue, c)} vencido</span> : "Total a día de hoy"}
            />
            <StatCard label="Gastos" value={formatMoney(s.expenses, c)} icon={Receipt} accent="rose" href="/finanzas/gastos" />
            <StatCard
              label="Beneficio estimado"
              value={formatMoney(s.profit, c)}
              icon={TrendingUp}
              accent="teal"
              tone={Number(s.profit) < 0 ? "danger" : undefined}
              hint="Cobrado − gastos"
              href="/finanzas"
            />
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Mi día" action={<Link href="/tareas?vista=mias" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>} bodyClassName="p-3">
            <TaskCollection
              tasks={myDay}
              hideNewButton
              emptyMessage="No tienes tareas pendientes asignadas. Buen momento para planificar."
            />
          </Panel>

          {finance && monthly.data ? (
            <Panel title="Cobros y gastos · últimos 6 meses">
              <MonthlyChart data={(monthly.data as MonthlyPoint[]).map((m) => ({ ...m, collected: Number(m.collected), expenses: Number(m.expenses), invoiced: Number(m.invoiced), profit: Number(m.profit) }))} currency={c} />
            </Panel>
          ) : null}

          <Panel title="Actividad reciente del equipo" action={<Link href="/actividad" className="text-xs text-muted-foreground hover:text-foreground">Ver todo</Link>}>
            <ActivityFeed items={activity.data ?? []} empty="Aún no hay actividad. Empieza creando un cliente o un proyecto." />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Próximas entregas" bodyClassName="p-0">
            {(deadlines.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin entregas en las próximas dos semanas.</p>
            ) : (
              <ul className="divide-y">
                {deadlines.data!.map((p) => {
                  const late = p.due_date < today;
                  return (
                    <li key={p.id}>
                      <Link href={`/proyectos/${p.id}`} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          <span className={cn("shrink-0 text-xs", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                            {late ? "Vencido · " : ""}
                            {formatDate(p.due_date, "d MMM")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs text-muted-foreground">{p.client?.name ?? "Sin cliente"}</span>
                          <OptionBadge value={p.status} map={projectStatusMapWith(ctx.company.project_status_labels)} className="ml-auto" />
                        </div>
                        <ProgressBar value={p.progress} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Reuniones y eventos" action={<Link href="/calendario" className="text-xs text-muted-foreground hover:text-foreground">Calendario</Link>} bodyClassName="p-0">
            {(events.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nada programado esta semana.</p>
            ) : (
              <ul className="divide-y">
                {events.data!.map((e) => {
                  const meta = eventCategoryMap[e.category as EventCategory];
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-11 shrink-0 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">{formatDate(e.starts_at, "EEE")}</p>
                        <p className="text-lg leading-none font-semibold tabular">{formatDate(e.starts_at, "d")}</p>
                      </div>
                      <span className="h-8 w-0.5 rounded-full" style={{ backgroundColor: meta?.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.all_day ? "Todo el día" : formatDate(e.starts_at, "HH:mm")} · {meta?.label}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
