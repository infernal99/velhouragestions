import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered tabs: each tab is a URL (?tab=), so content loads on demand. */
export function TabLinks({
  tabs,
  current,
  basePath,
}: {
  tabs: { value: string; label: string; count?: number }[];
  current: string;
  basePath: string;
}) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={t.value === tabs[0].value ? basePath : `${basePath}?tab=${t.value}`}
            scroll={false}
            className={cn(
              "relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors",
              active ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-muted px-1.5 text-[11px] tabular">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
