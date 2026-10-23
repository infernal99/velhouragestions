"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/shell/sidebar";
import { CompanyMark } from "@/components/shell/company-mark";
import { useApp } from "@/components/app-provider";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { company } = useApp();
  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setOpen(true)}>
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="flex-row items-center gap-2.5 px-4 py-3">
            <CompanyMark name={company.name} logoUrl={company.logoUrl} />
            <SheetTitle className="truncate text-sm">{company.name}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto pb-6">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
