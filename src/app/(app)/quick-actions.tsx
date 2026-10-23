"use client";

import { Building2, CalendarPlus, CheckSquare, FileText, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreate } from "@/components/create/create-dialogs";
import { useApp } from "@/components/app-provider";

export function QuickActions() {
  const create = useCreate();
  const { permissions } = useApp();
  const actions = [
    { label: "Tarea", icon: CheckSquare, onClick: () => create({ kind: "task" }) },
    { label: "Proyecto", icon: FolderPlus, onClick: () => create({ kind: "project" }) },
    { label: "Cliente", icon: Building2, onClick: () => create({ kind: "client" }) },
    { label: "Evento", icon: CalendarPlus, onClick: () => create({ kind: "event" }) },
    ...(permissions.canViewFinances ? [{ label: "Presupuesto", icon: FileText, onClick: () => create({ kind: "quote" }) }] : []),
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button key={a.label} variant="outline" size="sm" onClick={a.onClick}>
          <a.icon /> {a.label}
        </Button>
      ))}
    </div>
  );
}
