"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimeEntryDialog } from "@/components/time/entry-dialog";
import { useApp, useMemberName } from "@/components/app-provider";
import { runAction } from "@/components/forms/use-action-form";
import { deleteTimeEntry } from "@/lib/actions/time";
import { entryMinutes, formatDuration } from "@/lib/time";
import { formatDate } from "@/lib/format";
import type { TimeEntryRow } from "@/lib/queries/time";

export function EntriesList({ entries, showProject = true, now }: { entries: TimeEntryRow[]; showProject?: boolean; now: number }) {
  const router = useRouter();
  const { userId, permissions, team } = useApp();
  const memberName = useMemberName();
  const [editing, setEditing] = useState<TimeEntryRow | null>(null);

  if (entries.length === 0) {
    return <EmptyState compact icon={Clock} title="Aún no hay horas fichadas" description="Empieza el cronómetro o registra horas a mano." />;
  }

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card">
        {entries.map((e) => {
          const mine = e.user_id === userId;
          const canEdit = mine || permissions.isAdmin;
          const person = team.find((m) => m.id === e.user_id);
          return (
            <li key={e.id} className="group flex items-center gap-3 px-4 py-3">
              <UserAvatar name={memberName(e.user_id)} src={person?.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {showProject ? (e.project?.name ?? "Proyecto") : (memberName(e.user_id) ?? "—")}
                  {e.task ? <span className="font-normal text-muted-foreground"> · {e.task.title}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {showProject ? `${memberName(e.user_id) ?? "—"} · ` : ""}
                  {formatDate(e.started_at, "EEE d MMM")} · {formatDate(e.started_at, "HH:mm")}
                  {e.ended_at ? `–${formatDate(e.ended_at, "HH:mm")}` : ""}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              {e.ended_at ? null : <StatusBadge tone="success">En marcha</StatusBadge>}
              <span className="w-20 shrink-0 text-right text-sm font-semibold tabular">{formatDuration(entryMinutes(e, now))}</span>
              {canEdit && e.ended_at ? (
                <div className="flex shrink-0 opacity-60 group-hover:opacity-100">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(e)}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    title="¿Eliminar este fichaje?"
                    description="Las horas dejarán de contar en el proyecto."
                    onConfirm={async () => {
                      const res = await runAction(deleteTimeEntry(e.id));
                      if (res.ok) router.refresh();
                    }}
                    trigger={(open) => (
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={open} className="hover:text-destructive">
                        <Trash2 />
                      </Button>
                    )}
                  />
                </div>
              ) : (
                <span className="w-16 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
      <TimeEntryDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} entry={editing ?? undefined} />
    </>
  );
}
