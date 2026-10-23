import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectsView, type ProjectRow } from "./projects-view";
import { NewProjectButton } from "./new-project-button";

export const metadata: Metadata = { title: "Proyectos" };

const VIEWS = ["tarjetas", "tabla", "kanban", "calendario"] as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/proyectos">) {
  const ctx = await requireContext();
  const { vista, archivados } = await searchParams;
  const view = VIEWS.includes(vista as (typeof VIEWS)[number]) ? (vista as (typeof VIEWS)[number]) : "tarjetas";
  const showArchived = archivados === "1";
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("*, client:clients(id, name), project_members(user_id)")
    .eq("company_id", ctx.company.id)
    .order("updated_at", { ascending: false })
    .limit(1000);
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data } = await query.returns<ProjectRow[]>();

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Todos los proyectos de la empresa y su estado."
        actions={<NewProjectButton />}
      />
      <ProjectsView projects={data ?? []} view={view} showArchived={showArchived} />
    </>
  );
}
