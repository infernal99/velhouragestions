"use client";

import { Building2, CalendarPlus, CheckSquare, FileText, FolderPlus, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCreate } from "@/components/create/create-dialogs";
import { useApp } from "@/components/app-provider";

export function QuickCreate() {
  const create = useCreate();
  const { permissions } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" className="gap-1" />}>
        <Plus />
        <span className="hidden sm:inline">Crear</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => create({ kind: "task" })}>
          <CheckSquare /> Tarea
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => create({ kind: "project" })}>
          <FolderPlus /> Proyecto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => create({ kind: "client" })}>
          <Building2 /> Cliente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => create({ kind: "event" })}>
          <CalendarPlus /> Evento
        </DropdownMenuItem>
        {permissions.canViewFinances ? (
          <DropdownMenuItem onClick={() => create({ kind: "quote" })}>
            <FileText /> Presupuesto
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
