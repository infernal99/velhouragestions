import { cn } from "@/lib/utils";

export function InfoList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid gap-3 text-sm", className)}>{children}</dl>;
}

export function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-baseline gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {title ? (
        <header className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
