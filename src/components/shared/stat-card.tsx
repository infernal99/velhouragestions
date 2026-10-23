import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "danger" | "success";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground/70" /> : null}
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tracking-tight tabular",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-xl border bg-card p-4 transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-foreground/15 hover:bg-muted/20")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
