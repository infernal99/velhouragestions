import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { accentChip, accentGradient, valueToneClass, type Accent, type ValueTone } from "@/lib/accents";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
  valueTone,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  /** legacy: "danger" → red, "success" → green */
  tone?: "danger" | "success";
  /** colour of the number itself: green positive, red negative, amber warning */
  valueTone?: ValueTone;
  accent?: Accent;
}) {
  const resolved: ValueTone = valueTone ?? (tone === "danger" ? "negative" : tone === "success" ? "positive" : "neutral");
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-xl", accentChip[accent])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular", valueToneClass[resolved])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = cn("block rounded-xl border p-4 transition-all duration-200", accentGradient[accent]);
  return href ? (
    <Link href={href} className={cn(cls, "hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
