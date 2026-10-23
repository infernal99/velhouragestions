import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { accentChip, type Accent } from "@/lib/accents";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "danger" | "success";
  accent?: Accent;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid size-7 place-items-center rounded-lg", accentChip[accent])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-xl border bg-card p-4 transition-all duration-200";
  return href ? (
    <Link href={href} className={cn(cls, "hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
