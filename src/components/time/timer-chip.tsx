"use client";

import Link from "next/link";
import { useNowSeconds } from "@/components/time/use-ticker";
import { formatClock } from "@/lib/time";
import type { RunningTimer } from "@/components/time/timer-card";

/** Top-bar indicator of the running timer; links to the hours page. */
export function TimerChip({ running }: { running: RunningTimer | null }) {
  const now = useNowSeconds();
  if (!running) return null;
  const elapsed = now ? now * 1000 - Date.parse(running.started_at) : 0;
  return (
    <Link
      href="/horas"
      title={`Fichado en ${running.project?.name ?? "proyecto"}`}
      className="hidden h-8 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 sm:flex dark:text-emerald-300"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="tabular">{formatClock(elapsed)}</span>
      <span className="max-w-32 truncate text-emerald-800/70 dark:text-emerald-200/70">{running.project?.name}</span>
    </Link>
  );
}
