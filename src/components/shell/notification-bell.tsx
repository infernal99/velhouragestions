"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { listNotifications, markNotificationsRead } from "@/lib/actions/shell";
import { formatRelative } from "@/lib/format";
import { useApp } from "@/components/app-provider";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const { userId } = useApp();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<AppNotification[] | null>(null);

  const load = React.useCallback(async () => {
    const res = await listNotifications();
    if (res.ok) {
      setItems(res.data.items);
      setUnread(res.data.unread);
    }
  }, []);

  // Realtime: RLS on notifications means this channel only ever receives
  // the signed-in user's own rows.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          setUnread((n) => n + 1);
          setItems(null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAll = async () => {
    const res = await markNotificationsRead();
    if (res.ok) {
      setUnread(0);
      setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative" />}
      >
        <Bell />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-brand-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 ? (
            <Button variant="ghost" size="xs" onClick={markAll}>
              <CheckCheck /> Marcar todo como leído
            </Button>
          ) : null}
        </div>
        <div className="max-h-[60svh] overflow-y-auto">
          {items === null ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={async () => {
                  setOpen(false);
                  if (!n.read_at) {
                    setUnread((c) => Math.max(0, c - 1));
                    await markNotificationsRead([n.id]);
                  }
                  if (n.link) router.push(n.link);
                }}
                className={cn(
                  "flex w-full gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/60",
                  !n.read_at && "bg-brand/[0.04]",
                )}
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body ? <span className="block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" render={<Link href="/notificaciones" />} nativeButton={false} onClick={() => setOpen(false)}>
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
