import { TZDate } from "@date-fns/tz";
import { addMonths, addWeeks, addYears, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { APP_TIMEZONE } from "@/lib/format";

export const HOURS_PERIODS = ["semana", "semana-anterior", "mes", "mes-anterior", "anio", "todo"] as const;
export type HoursPeriod = (typeof HOURS_PERIODS)[number];

export function parseHoursPeriod(value: unknown): HoursPeriod {
  return HOURS_PERIODS.includes(value as HoursPeriod) ? (value as HoursPeriod) : "semana";
}

/** [from, to) as UTC instants, computed on calendar boundaries of the app timezone. */
export function hoursRange(period: HoursPeriod, now = new Date()): { from?: string; to?: string } {
  const local = new TZDate(now, APP_TIMEZONE);
  const iso = (d: Date) => new Date(d.getTime()).toISOString();
  switch (period) {
    case "semana": {
      const s = startOfWeek(local, { weekStartsOn: 1 });
      return { from: iso(s), to: iso(addWeeks(s, 1)) };
    }
    case "semana-anterior": {
      const s = startOfWeek(local, { weekStartsOn: 1 });
      return { from: iso(addWeeks(s, -1)), to: iso(s) };
    }
    case "mes": {
      const s = startOfMonth(local);
      return { from: iso(s), to: iso(addMonths(s, 1)) };
    }
    case "mes-anterior": {
      const s = startOfMonth(local);
      return { from: iso(addMonths(s, -1)), to: iso(s) };
    }
    case "anio": {
      const s = startOfYear(local);
      return { from: iso(s), to: iso(addYears(s, 1)) };
    }
    default:
      return {};
  }
}
