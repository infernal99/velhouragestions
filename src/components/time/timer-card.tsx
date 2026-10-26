"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, SimpleSelect } from "@/components/forms/fields";
import { runAction } from "@/components/forms/use-action-form";
import { useLookups } from "@/components/create/use-lookups";
import { useNowSeconds } from "@/components/time/use-ticker";
import { listProjectTasks, startTimer, stopTimer } from "@/lib/actions/time";
import { formatClock } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface RunningTimer {
  id: string;
  started_at: string;
  note: string | null;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
}

/** Task options for a project, reloaded whenever the project changes. */
export function useProjectTasks(projectId: string | null) {
  const [state, setState] = useState<{ projectId: string | null; tasks: { id: string; title: string }[] }>({ projectId: null, tasks: [] });
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void listProjectTasks(projectId).then((res) => {
      if (!cancelled) setState({ projectId, tasks: res.ok ? res.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return projectId && state.projectId === projectId ? state.tasks : [];
}

export function TimerCard({ running, defaultProjectId }: { running: RunningTimer | null; defaultProjectId?: string }) {
  const router = useRouter();
  const lookups = useLookups(true);
  const now = useNowSeconds();
  const [pending, start] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const tasks = useProjectTasks(running ? null : projectId);

  const elapsed = running && now ? now * 1000 - Date.parse(running.started_at) : 0;

  if (running) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Fichado ahora
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular">{formatClock(elapsed)}</p>
          <p className="mt-1 text-sm">
            <strong>{running.project?.name ?? "Proyecto"}</strong>
            {running.task ? <span className="text-muted-foreground"> · {running.task.title}</span> : null}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-72">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={running.note ?? "¿Qué has hecho? (opcional)"} maxLength={500} />
          <Button
            size="lg"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await runAction(stopTimer(note));
                if (res.ok) {
                  setNote("");
                  router.refresh();
                }
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Square />}
            Parar y guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-3 text-sm font-semibold">Fichar horas</p>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
        <FormField label="Proyecto" required>
          <SimpleSelect
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setTaskId(null);
            }}
            options={lookups.projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={lookups.loading ? "Cargando…" : "Elige un proyecto"}
          />
        </FormField>
        <FormField label="Tarea (opcional)">
          <SimpleSelect
            value={taskId}
            onChange={setTaskId}
            options={tasks.map((t) => ({ value: t.id, label: t.title }))}
            allowEmpty
            emptyLabel="Sin tarea concreta"
            disabled={!projectId}
          />
        </FormField>
        <FormField label="Nota (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maquetar la home…" maxLength={500} />
        </FormField>
        <Button
          size="lg"
          disabled={!projectId || pending}
          className={cn("md:min-w-32")}
          onClick={() =>
            start(async () => {
              const res = await runAction(startTimer({ project_id: projectId, task_id: taskId, note }));
              if (res.ok) {
                setNote("");
                router.refresh();
              }
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          Empezar
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">El cronómetro sigue contando aunque cierres la página. Solo puedes tener uno en marcha.</p>
    </div>
  );
}
