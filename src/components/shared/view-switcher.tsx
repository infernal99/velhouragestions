"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

/** Segmented control that keeps the chosen view in the URL (?vista=). */
export function ViewSwitcher({ views, current, param = "vista" }: { views: ViewOption[]; current: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (
    <div className="inline-flex rounded-lg border bg-muted/50 p-0.5" role="tablist">
      {views.map((v) => {
        const active = v.value === current;
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              const params = new URLSearchParams(search.toString());
              params.set(param, v.value);
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-all",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <v.icon className="size-3.5" />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
