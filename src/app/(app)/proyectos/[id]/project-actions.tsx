"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectFormDialog, type ProjectFormValues } from "@/components/projects/project-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApp } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { deleteProject, setProjectArchived } from "@/lib/actions/projects";

export function ProjectActions({ project }: { project: ProjectFormValues & { id: string; archived_at: string | null } }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const create = useCreate();
  const { permissions } = useApp();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="outline" onClick={() => create({ kind: "task", defaults: { project_id: project.id } })}>
        <Plus /> Tarea
      </Button>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Editar
      </Button>
      <ConfirmDialog
        title="¿Eliminar el proyecto definitivamente?"
        description="Se eliminarán sus tareas, comentarios, archivos y ficha web. Los cobros y gastos se conservarán sin proyecto. Si solo quieres ocultarlo, archívalo."
        onConfirm={async () => {
          const res = await runAction(deleteProject(project.id));
          if (res.ok) router.push("/proyectos");
        }}
        trigger={(openDelete) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Más acciones" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  create({ kind: "event", defaults: { project_id: project.id, client_id: project.client_id ?? null, category: "revision" } })
                }
              >
                <CalendarPlus /> Programar evento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  const res = await runAction(setProjectArchived(project.id, !project.archived_at));
                  if (res.ok) router.refresh();
                }}
              >
                {project.archived_at ? <ArchiveRestore /> : <Archive />}
                {project.archived_at ? "Restaurar" : "Archivar"}
              </DropdownMenuItem>
              {permissions.isAdmin ? (
                <DropdownMenuItem variant="destructive" onClick={openDelete}>
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} />
    </div>
  );
}
