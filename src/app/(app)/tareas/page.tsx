import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { listTasks } from "@/lib/queries/tasks";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "./tasks-view";
import { NewTaskButton } from "./new-task-button";

export const metadata: Metadata = { title: "Tareas" };

const VIEWS = ["lista", "mias", "kanban", "calendario"] as const;

export default async function TasksPage({ searchParams }: PageProps<"/tareas">) {
  const ctx = await requireContext();
  const { vista } = await searchParams;
  const view = VIEWS.includes(vista as (typeof VIEWS)[number]) ? (vista as (typeof VIEWS)[number]) : "lista";
  const tasks = await listTasks(ctx.company.id);

  return (
    <>
      <PageHeader title="Tareas" description="Tareas de proyectos y tareas internas del equipo." actions={<NewTaskButton />} />
      <TasksView tasks={tasks} view={view} />
    </>
  );
}
