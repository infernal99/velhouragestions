import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft } from "lucide-react";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/queries/tasks";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { TabLinks } from "@/components/shared/tab-links";
import { InfoItem, InfoList, Panel } from "@/components/shared/info-list";
import { Comments } from "@/components/shared/comments";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskCollection } from "@/components/tasks/task-collection";
import { FileUploader } from "@/components/files/file-uploader";
import { FileList, type FileRow } from "@/components/files/file-list";
import { ActivityFeed, type ActivityRow } from "@/components/shared/activity-feed";
import { priorityMap, projectStatusMapWith, projectTypeLabel } from "@/lib/labels";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import { ProjectActions } from "./project-actions";
import { ProjectLinks } from "./project-links";
import { WebSection } from "./web-section";
import { ProjectFinance } from "./project-finance";
import type { Project, ProjectLink } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/proyectos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Proyecto" };
}

type ProjectFull = Project & {
  client: { id: string; name: string } | null;
  project_members: { user_id: string }[];
  project_links: ProjectLink[];
  web_details: { project_id: string } | null;
};

export default async function ProjectPage({ params, searchParams }: PageProps<"/proyectos/[id]">) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, client:clients(id, name), project_members(user_id), project_links(*), web_details(project_id)")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle<ProjectFull>();
  if (!project) notFound();

  const isWeb = project.type === "web" || Boolean(project.web_details);
  const finance = ctx.permissions.canViewFinances;
  const tabs = [
    { value: "resumen", label: "Resumen" },
    { value: "tareas", label: "Tareas" },
    ...(isWeb ? [{ value: "web", label: "Ficha web" }] : []),
    { value: "archivos", label: "Archivos" },
    ...(finance ? [{ value: "finanzas", label: "Cobros y gastos" }] : []),
    { value: "actividad", label: "Actividad" },
  ];
  const tab = tabs.some((t) => t.value === rawTab) ? (rawTab as string) : "resumen";

  const owner = ctx.team.find((m) => m.id === project.owner_id);
  const memberIds = project.project_members.map((m) => m.user_id);
  const canManage = ctx.permissions.isAdmin || project.owner_id === ctx.userId;
  const overdue = isOverdue(project.due_date, ["entregado", "cancelado"].includes(project.status));

  return (
    <>
      <Link href={isWeb ? "/webs" : "/proyectos"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {isWeb ? "Webs en desarrollo" : "Proyectos"}
      </Link>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <OptionBadge value={project.status} map={projectStatusMapWith(ctx.company.project_status_labels)} />
            <OptionBadge value={project.priority} map={priorityMap} />
            {project.archived_at ? <StatusBadge tone="muted">Archivado</StatusBadge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.client ? (
              <Link href={`/clientes/${project.client.id}`} className="hover:text-foreground hover:underline">
                {project.client.name}
              </Link>
            ) : (
              "Sin cliente"
            )}{" "}
            · {projectTypeLabel(project.type)}
            {project.due_date ? (
              <span className={overdue ? "font-medium text-destructive" : undefined}>
                {" "}
                · <CalendarClock className="inline size-3.5 align-[-2px]" /> {formatDate(project.due_date)}
                {overdue ? " (vencido)" : ""}
              </span>
            ) : null}
          </p>
          <ProgressBar value={project.progress} className="mt-3 max-w-sm" />
        </div>
        <ProjectActions project={{ ...project, member_ids: memberIds }} />
      </div>

      <TabLinks tabs={tabs} current={tab} basePath={`/proyectos/${project.id}`} />

      {tab === "resumen" ? <Overview project={project} ownerName={owner ? owner.full_name || owner.email : null} memberIds={memberIds} currency={ctx.company.currency} /> : null}
      {tab === "tareas" ? <TasksTab companyId={ctx.company.id} projectId={project.id} /> : null}
      {tab === "web" ? <WebSection projectId={project.id} canManage={canManage} /> : null}
      {tab === "archivos" ? <FilesTab projectId={project.id} clientId={project.client_id} /> : null}
      {tab === "finanzas" ? <ProjectFinance projectId={project.id} budget={project.budget} clientId={project.client_id} /> : null}
      {tab === "actividad" ? <ActivityTab projectId={project.id} /> : null}
    </>
  );
}

async function Overview({
  project,
  ownerName,
  memberIds,
  currency,
}: {
  project: ProjectFull;
  ownerName: string | null;
  memberIds: string[];
  currency: string;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [{ data: comments }, { data: taskStats }] = await Promise.all([
    supabase.from("comments").select("id, body, author_id, created_at").eq("project_id", project.id).order("created_at"),
    supabase.from("tasks").select("status, due_date").eq("project_id", project.id).is("parent_id", null),
  ]);
  const total = taskStats?.length ?? 0;
  const doneCount = taskStats?.filter((t) => t.status === "completada").length ?? 0;
  const overdueCount = taskStats?.filter((t) => t.status !== "completada" && isOverdue(t.due_date as string | null)).length ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="Descripción">
          {project.description ? (
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin descripción.</p>
          )}
        </Panel>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tareas", value: total },
            { label: "Completadas", value: doneCount },
            { label: "Vencidas", value: overdueCount, danger: overdueCount > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-0.5 text-xl font-semibold tabular ${s.danger ? "text-destructive" : ""}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <Panel title="Comentarios y conversación interna">
          <Comments target={{ project_id: project.id }} comments={comments ?? []} />
        </Panel>
      </div>
      <div className="flex flex-col gap-5">
        <Panel title="Detalles">
          <InfoList>
            <InfoItem label="Responsable">{ownerName ?? "—"}</InfoItem>
            <InfoItem label="Inicio">{formatDate(project.start_date)}</InfoItem>
            <InfoItem label="Fecha límite">{formatDate(project.due_date)}</InfoItem>
            <InfoItem label="Presupuesto">{project.budget != null ? formatMoney(project.budget, currency) : "—"}</InfoItem>
            <InfoItem label="Creado">{formatDate(project.created_at)}</InfoItem>
          </InfoList>
        </Panel>
        <Panel title="Equipo">
          {memberIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin colaboradores además del responsable.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {memberIds.map((id) => {
                const m = ctx.team.find((t) => t.id === id);
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <UserAvatar name={m?.full_name || m?.email} src={m?.avatar_url} size="sm" />
                    {m ? m.full_name || m.email : "Antiguo miembro"}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Enlaces">
          <ProjectLinks projectId={project.id} links={project.project_links} />
        </Panel>
      </div>
    </div>
  );
}

async function TasksTab({ companyId, projectId }: { companyId: string; projectId: string }) {
  const tasks = await listTasks(companyId, { projectId });
  return (
    <TaskCollection
      tasks={tasks}
      showProject={false}
      newTaskDefaults={{ project_id: projectId }}
      emptyMessage="Este proyecto aún no tiene tareas. El progreso se calcula a partir de las tareas completadas."
    />
  );
}

async function FilesTab({ projectId, clientId }: { projectId: string; clientId: string | null }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("files")
    .select("id, name, mime_type, size_bytes, category, uploaded_by, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<FileRow[]>();
  return (
    <div className="flex flex-col gap-3">
      <FileUploader target={{ project_id: projectId, client_id: clientId }} />
      <FileList files={data ?? []} />
    </div>
  );
}

async function ActivityTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ActivityRow[]>();
  return (
    <Panel>
      <ActivityFeed items={data ?? []} />
    </Panel>
  );
}
