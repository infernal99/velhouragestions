// Duration helpers shared by server and client components.

export function entryMinutes(e: { started_at: string; ended_at: string | null }, now = Date.now()) {
  const end = e.ended_at ? Date.parse(e.ended_at) : now;
  return Math.max(0, (end - Date.parse(e.started_at)) / 60_000);
}

/** 135 → "2 h 15 min" */
export function formatDuration(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** 135 → "2,25 h" (decimal hours, Spanish format) */
export function formatHours(minutes: number) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(minutes / 60)} h`;
}

/** Elapsed seconds → "01:05:09" for the live timer. */
export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
