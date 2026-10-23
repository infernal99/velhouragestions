import { format as formatDateFns, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { tz as tzFn } from "@date-fns/tz";

// Spanish formats throughout: 1.234,56 €, dd/MM/yyyy, 24h clock.

export function formatMoney(value: number | string | null | undefined, currency = "EUR") {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    useGrouping: "always",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatCompactMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits, useGrouping: "always" }).format(value);
}

/**
 * Display timezone. Fixed (not the machine's) so the server — UTC on
 * Vercel — and the browser render identical times.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? "Europe/Madrid";
const tz = tzFn(APP_TIMEZONE);

function toDate(value: string | Date) {
  if (value instanceof Date) return value;
  // plain dates ("2026-10-23") are calendar days, not instants: keep them as-is
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(`${value}T12:00:00Z`) : parseISO(value);
}

export function formatDate(value: string | Date | null | undefined, pattern = "dd/MM/yyyy") {
  if (!value) return "—";
  const d = toDate(value);
  if (!isValid(d)) return "—";
  const plainDay = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  // a plain day is formatted in UTC (where we anchored it), instants in the app timezone
  return formatDateFns(d, pattern, { locale: es, in: plainDay ? tzFn("UTC") : tz });
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function formatDateLong(value: string | Date | null | undefined) {
  return formatDate(value, "EEEE, d 'de' MMMM");
}

export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = toDate(value);
  if (!isValid(d)) return "—";
  return `hace ${formatDistanceToNowStrict(d, { locale: es })}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

/** Today's date as yyyy-MM-dd in the app timezone. */
export function todayISO() {
  return formatDateFns(new Date(), "yyyy-MM-dd", { in: tz });
}

/** A Date's calendar day (yyyy-MM-dd) in the app timezone. */
export function dayInAppTz(date: Date) {
  return formatDateFns(date, "yyyy-MM-dd", { in: tz });
}

export function isOverdue(dueDate: string | null | undefined, done = false) {
  if (!dueDate || done) return false;
  return dueDate < todayISO();
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
