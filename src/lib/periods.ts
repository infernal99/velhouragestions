import { endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfYear, subDays, subMonths } from "date-fns";

export const periodOptions = [
  { value: "mes", label: "Este mes" },
  { value: "mes-anterior", label: "Mes anterior" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "anio", label: "Este año" },
] as const;

export type PeriodKey = (typeof periodOptions)[number]["value"];

export function resolvePeriod(key: string | undefined, now = new Date()): { key: PeriodKey; from: string; to: string; label: string } {
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  const k = (periodOptions.find((p) => p.value === key)?.value ?? "mes") as PeriodKey;
  const label = periodOptions.find((p) => p.value === k)!.label;
  switch (k) {
    case "mes-anterior": {
      const prev = subMonths(now, 1);
      return { key: k, from: f(startOfMonth(prev)), to: f(endOfMonth(prev)), label };
    }
    case "trimestre":
      return { key: k, from: f(startOfQuarter(now)), to: f(endOfQuarter(now)), label };
    case "30d":
      return { key: k, from: f(subDays(now, 29)), to: f(now), label };
    case "anio":
      return { key: k, from: f(startOfYear(now)), to: f(endOfYear(now)), label };
    default:
      return { key: "mes", from: f(startOfMonth(now)), to: f(endOfMonth(now)), label };
  }
}
