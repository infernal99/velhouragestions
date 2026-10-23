"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FolderKanban, Pencil, Plus, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OptionBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Comments } from "@/components/shared/comments";
import { SimpleSelect } from "@/components/forms/fields";
import { FileUploader } from "@/components/files/file-uploader";
import { FileList } from "@/components/files/file-list";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useApp, useMemberName } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import {
  addTaskChecklistItem,
  deleteTask,
  deleteTaskChecklistItem,
  getTaskDetail,
  toggleTaskChecklistItem,
  updateTaskStatus,
  type TaskDetail,
} from "@/lib/actions/tasks";
import { priorityMap, taskStatusMap, taskStatusOptions } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/components/tasks/task-list";
import type { TaskStatus } from "@/types/database";

export function TaskSheet({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const router = useRouter();
  const { team, userId, permissions } = useApp();
  const memberName = useMemberName();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [status, setStatus] = useState<TaskStatus | null>(null);

  const load = useCallback(async (id: string) => {
    const res = await getTaskDetail(id);
    if (res.ok) setDetail(res.data);
  }, []);

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    void getTaskDetail(task.id).then((res) => {
      if (!cancelled && res.ok) setDetail(res.data);
    });
    return () => {
      cancelled = true;
      setDetail(null);
      setStatus(null);
    };
  }, [task]);

  if (!task) return null;
  const currentStatus = status ?? task.status;
  const assignee = team.find((m) => m.id === task.assignee_id);
  const canDelete = task.created_by === userId || permissions.isAdmin;
  const reload = () => {
    void load(task.id);
    router.refresh();
  };

  return (
    <>
      <Sheet open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
          <SheetHeader className="flex-row items-start gap-2 border-b px-5 py-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
              {task.project ? (
                <Link href={`/proyectos/${task.project.id}`} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <FolderKanban className="size-3" /> {task.project.name}
                </Link>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Tarea independiente</p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
            {canDelete ? (
              <ConfirmDialog
                title="¿Eliminar esta tarea?"
                description="También se eliminarán sus subtareas, checklist y comentarios."
                onConfirm={async () => {
                  const res = await runAction(deleteTask(task.id));
                  if (res.ok) {
                    onClose();
                    router.refresh();
                  }
                }}
                trigger={(o) => (
                  <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={o} className="hover:text-destructive">
                    <Trash2 />
                  </Button>
                )}
              />
            ) : null}
            <Button variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={onClose}>
              <X />
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-3 text-sm">
              <span className="text-muted-foreground">Estado</span>
              <SimpleSelect
                value={currentStatus}
                onChange={async (v) => {
                  if (!v) return;
                  setStatus(v as TaskStatus);
                  const res = await runAction(updateTaskStatus(task.id, v));
                  if (res.ok) router.refresh();
                  else setStatus(null);
                }}
                options={taskStatusOptions.map((o) => ({ value: o.value, label: o.label }))}
                className="h-7 w-44"
              />
              <span className="text-muted-foreground">Responsable</span>
              <span className="flex items-center gap-2">
                {task.assignee_id ? (
                  <>
                    <UserAvatar name={memberName(task.assignee_id)} src={assignee?.avatar_url} size="sm" />
                    {memberName(task.assignee_id)}
                  </>
                ) : (
                  <span className="text-muted-foreground">Sin asignar</span>
                )}
              </span>
              <span className="text-muted-foreground">Prioridad</span>
              <span>
                <OptionBadge value={task.priority} map={priorityMap} />
              </span>
              <span className="text-muted-foreground">Fecha límite</span>
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                {task.due_date ? formatDate(task.due_date, "EEEE d 'de' MMMM yyyy") : "Sin fecha"}
              </span>
              {detail && detail.collaborator_ids.length ? (
                <>
                  <span className="text-muted-foreground">Colaboradores</span>
                  <span className="flex flex-wrap gap-1.5">
                    {detail.collaborator_ids.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        <UserAvatar name={memberName(id)} size="xs" /> {memberName(id)}
                      </span>
                    ))}
                  </span>
                </>
              ) : null}
              {task.labels.length ? (
                <>
                  <span className="text-muted-foreground">Etiquetas</span>
                  <span className="flex flex-wrap gap-1">
                    {task.labels.map((l) => (
                      <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {l}
                      </span>
                    ))}
                  </span>
                </>
              ) : null}
            </div>

            {task.description ? (
              <p className="mt-5 text-sm whitespace-pre-wrap text-foreground/90">{task.description}</p>
            ) : null}

            {!detail ? (
              <div className="mt-6 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <section className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold">
                    Checklist{" "}
                    {detail.checklist.length ? (
                      <span className="font-normal text-muted-foreground">
                        {detail.checklist.filter((c) => c.done).length}/{detail.checklist.length}
                      </span>
                    ) : null}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {detail.checklist.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                        <Checkbox
                          checked={item.done}
                          onCheckedChange={async (c) => {
                            setDetail((d) => d && { ...d, checklist: d.checklist.map((x) => (x.id === item.id ? { ...x, done: Boolean(c) } : x)) });
                            await runAction(toggleTaskChecklistItem(item.id, Boolean(c)));
                          }}
                        />
                        <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.label}</span>
                        <button
                          type="button"
                          aria-label="Quitar"
                          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={async () => {
                            const res = await runAction(deleteTaskChecklistItem(item.id));
                            if (res.ok) void load(task.id);
                          }}
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="mt-1.5 flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newItem.trim()) return;
                      const res = await runAction(addTaskChecklistItem(task.id, newItem));
                      if (res.ok) {
                        setNewItem("");
                        void load(task.id);
                      }
                    }}
                  >
                    <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Añadir elemento…" className="h-7" />
                    <Button type="submit" size="sm" variant="outline" disabled={!newItem.trim()}>
                      Añadir
                    </Button>
                  </form>
                </section>

                {!task.parent_id ? (
                  <section className="mt-6">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Subtareas</h3>
                      <Button size="xs" variant="ghost" onClick={() => setSubtaskOpen(true)}>
                        <Plus /> Subtarea
                      </Button>
                    </div>
                    {detail.subtasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin subtareas.</p>
                    ) : (
                      <ul className="divide-y rounded-lg border">
                        {detail.subtasks.map((s) => (
                          <li key={s.id} className="flex items-center gap-2.5 px-3 py-2">
                            <Checkbox
                              checked={s.status === "completada"}
                              onCheckedChange={async (c) => {
                                const res = await runAction(updateTaskStatus(s.id, c ? "completada" : "pendiente"));
                                if (res.ok) void load(task.id);
                              }}
                            />
                            <span className={cn("flex-1 text-sm", s.status === "completada" && "text-muted-foreground line-through")}>{s.title}</span>
                            {s.assignee_id ? <UserAvatar name={memberName(s.assignee_id)} size="xs" /> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}

                <section className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold">Archivos</h3>
                  <div className="flex flex-col gap-2">
                    <FileUploader target={{ task_id: task.id, project_id: task.project_id }} compact onUploaded={() => void load(task.id)} />
                    {detail.files.length ? (
                      <FileList
                        files={detail.files}
                        onChanged={() => void load(task.id)}
                      />
                    ) : null}
                  </div>
                </section>

                <section className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold">Comentarios</h3>
                  <Comments target={{ task_id: task.id }} comments={detail.comments} onChanged={() => void load(task.id)} />
                </section>

                <p className="mt-6 text-xs text-muted-foreground">
                  Creada {formatDateTime(task.created_at)}
                  {task.created_by ? ` por ${memberName(task.created_by)}` : ""}
                  {task.completed_at ? ` · completada ${formatDateTime(task.completed_at)}` : ""}
                  {" · "}
                  <OptionBadge value={currentStatus} map={taskStatusMap} className="align-middle" />
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <TaskFormDialog
        open={editing}
        onOpenChange={setEditing}
        task={{ ...task, collaborator_ids: detail?.collaborator_ids ?? [] }}
        onSaved={() => onClose()}
      />
      <TaskFormDialog
        open={subtaskOpen}
        onOpenChange={setSubtaskOpen}
        task={{ parent_id: task.id, project_id: task.project_id }}
        onSaved={reload}
      />
    </>
  );
}
