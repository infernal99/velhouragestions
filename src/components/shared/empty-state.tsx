import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed text-center",
        compact ? "gap-1.5 px-4 py-6" : "gap-2 px-6 py-14",
        className,
      )}
    >
      {Icon ? (
        <div className={cn("mb-1 grid place-items-center rounded-lg bg-muted text-muted-foreground", compact ? "size-8" : "size-10")}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </div>
      ) : null}
      <p className={cn("font-medium", compact ? "text-sm" : "text-[15px]")}>{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
