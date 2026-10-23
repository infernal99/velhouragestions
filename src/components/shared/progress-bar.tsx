import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, showLabel = true }: { value: number; className?: string; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", v === 100 ? "bg-emerald-500" : "bg-brand")}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel ? <span className="w-8 text-right text-xs text-muted-foreground tabular">{v}%</span> : null}
    </div>
  );
}
