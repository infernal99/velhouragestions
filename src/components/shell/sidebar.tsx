"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { CompanyMark } from "@/components/shell/company-mark";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { isActive, navGroups } from "@/lib/navigation";
import { accentChip, accentText } from "@/lib/accents";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { permissions } = useApp();

  return (
    <nav className="flex flex-col gap-5 px-3 py-2">
      {navGroups.map((group, i) => {
        const items = group.items.filter((item) => !item.requires || can(permissions, item.requires));
        if (items.length === 0) return null;
        return (
          <div key={group.label ?? i} className="flex flex-col gap-0.5">
            {group.label ? (
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                {group.label}
              </p>
            ) : null}
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md transition-colors",
                      active ? accentChip[item.accent] : "group-hover:bg-muted",
                    )}
                  >
                    <item.icon className={cn("size-4", active ? "" : cn(accentText[item.accent], "opacity-70 group-hover:opacity-100"))} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { company } = useApp();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <CompanyMark name={company.name} logoUrl={company.logoUrl} />
        <CompanySwitcher />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <SidebarNav />
      </div>
    </aside>
  );
}
