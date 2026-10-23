"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskListItem, type TaskRow } from "@/components/tasks/task-list";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { useCreate } from "@/components/create/create-dialogs";
import { cn } from "@/lib/utils";
import type { TaskFormValues } from "@/components/tasks/task-form-dialog";

/**
 * Open tasks grouped, completed ones collapsed. Clicking a task opens the
 * detail sheet; ?tarea=<id> deep-links to it (used by notifications/search).
 */
export function TaskCollection({
  tasks,
  showProject = true,
  newTaskDefaults,
  emptyMessage = "No hay tareas.",
  hideNewButton,
}: {
  tasks: TaskRow[];
  showProject?: boolean;
  newTaskDefaults?: TaskFormValues;
  emptyMessage?: string;
  hideNewButton?: boolean;
}) {
  const create = useCreate();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("tarea"));
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with URL (back/forward, notification links)
    setOpenId(params.get("tarea"));
  }, [params]);

  const setOpen = (id: string | null) => {
    setOpenId(id);
    const p = new URLSearchParams(params.toString());
    if (id) p.set("tarea", id);
    else p.delete("tarea");
    router.replace(`${pathname}${p.size ? `?${p.toString()}` : ""}`, { scroll: false });
  };

  const open = useMemo(() => tasks.filter((t) => t.status !== "completada"), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.status === "completada"), [tasks]);
  const selected = tasks.find((t) => t.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {!hideNewButton ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => create({ kind: "task", defaults: newTaskDefaults })}>
            <Plus /> Nueva tarea
          </Button>
        </div>
      ) : null}
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {open.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">Todo completado. 🎉</p>
          ) : (
            <div className="divide-y">
              {open.map((t) => (
                <TaskListItem key={t.id} task={t} onOpen={(x) => setOpen(x.id)} showProject={showProject} />
              ))}
            </div>
          )}
          {done.length ? (
            <>
              <button
                type="button"
                onClick={() => setShowDone((s) => !s)}
                className="flex w-full items-center gap-1.5 border-t bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                Completadas ({done.length})
              </button>
              {showDone ? (
                <div className="divide-y border-t">
                  {done.map((t) => (
                    <TaskListItem key={t.id} task={t} onOpen={(x) => setOpen(x.id)} showProject={showProject} />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      <TaskSheet task={selected} onClose={() => setOpen(null)} />
    </div>
  );
}
