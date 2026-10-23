import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-foreground/70 ring-border",
  muted: "bg-muted/60 text-muted-foreground ring-border",
  info: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  brand: "bg-brand/10 text-brand ring-brand/25",
  success: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  danger: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-foreground/50",
  muted: "bg-muted-foreground/60",
  info: "bg-sky-500",
  brand: "bg-brand",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function StatusBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotClasses[tone])} /> : null}
      {children}
    </span>
  );
}

export function OptionBadge<T extends string>({
  value,
  map,
  className,
}: {
  value: T;
  map: Record<T, { label: string; tone?: Tone }>;
  className?: string;
}) {
  const opt = map[value];
  return (
    <StatusBadge tone={opt?.tone ?? "neutral"} className={className}>
      {opt?.label ?? value}
    </StatusBadge>
  );
}
