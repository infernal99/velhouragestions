import { toneOf, valueToneClass } from "@/lib/accents";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** An amount coloured by its sign: green above zero, red below, neutral at zero. */
export function Money({
  value,
  currency = "EUR",
  signed = false,
  className,
}: {
  value: number | string | null | undefined;
  currency?: string;
  /** show an explicit + for positive amounts */
  signed?: boolean;
  className?: string;
}) {
  const n = Number(value ?? 0);
  const text = formatMoney(Math.abs(n), currency);
  const prefix = n < 0 ? "−" : signed && n > 0 ? "+" : "";
  return <span className={cn("tabular", valueToneClass[toneOf(n)], className)}>{`${prefix}${text}`}</span>;
}
