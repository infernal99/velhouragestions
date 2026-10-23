"use client";

import { useRouter } from "next/navigation";
import { AtSign, Bell, CalendarClock, CheckCheck, FolderKanban, MessageSquare, UserCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { runAction } from "@/components/forms/use-action-form";
import { markNotificationsRead } from "@/lib/actions/shell";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/types/database";

const icons: Record<NotificationKind, typeof Bell> = {
  task_assigned: UserCheck,
  assignee_changed: AtSign,
  comment: MessageSquare,
  project_updated: FolderKanban,
  due_soon: CalendarClock,
  payment_due: Wallet,
};

export function NotificationsList({ items }: { items: AppNotification[] }) {
  const router = useRouter();
  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return <EmptyState icon={Bell} title="No tienes notificaciones" description="Aquí verás las tareas que te asignen, comentarios nuevos y vencimientos próximos." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} sin leer` : "Todo leído"}</p>
        {unread ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await runAction(markNotificationsRead());
              if (res.ok) router.refresh();
            }}
          >
            <CheckCheck /> Marcar todo como leído
          </Button>
        ) : null}
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {items.map((n) => {
          const Icon = icons[n.kind] ?? Bell;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={async () => {
                  if (!n.read_at) await markNotificationsRead([n.id]);
                  if (n.link) router.push(n.link);
                  else router.refresh();
                }}
                className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40", !n.read_at && "bg-brand/[0.04]")}
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-medium")}>{n.title}</p>
                  {n.body ? <p className="truncate text-sm text-muted-foreground">{n.body}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(n.created_at)}>
                  {formatRelative(n.created_at)}
                </span>
                {!n.read_at ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
