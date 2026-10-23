"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { useApp } from "@/components/app-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { runAction } from "@/components/forms/use-action-form";
import { switchCompany } from "@/lib/actions/shell";

export function CompanySwitcher() {
  const { company, companies } = useApp();
  const router = useRouter();
  const [, start] = useTransition();

  if (companies.length <= 1) {
    return <span className="truncate text-sm font-semibold tracking-tight">{company.name}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-1 py-1 text-sm font-semibold hover:bg-sidebar-accent">
        <span className="truncate">{company.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Empresas</DropdownMenuLabel>
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() =>
              start(async () => {
                if (c.id === company.id) return;
                await runAction(switchCompany(c.id));
                router.refresh();
              })
            }
          >
            <span className="flex-1 truncate">{c.name}</span>
            {c.id === company.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
