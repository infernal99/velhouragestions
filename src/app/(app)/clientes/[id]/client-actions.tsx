"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileText, MoreHorizontal, Pencil, Trash2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApp } from "@/components/app-provider";
import { useCreate } from "@/components/create/create-dialogs";
import { runAction } from "@/components/forms/use-action-form";
import { deleteClient, setClientArchived } from "@/lib/actions/clients";
import type { Client } from "@/types/database";

export function ClientActions({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const create = useCreate();
  const { permissions } = useApp();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Editar
      </Button>
      <ConfirmDialog
        title="¿Eliminar este cliente?"
        description="Se eliminarán su historial y comentarios. Los proyectos, presupuestos y cobros se conservarán sin cliente asociado."
        onConfirm={async () => {
          const res = await runAction(deleteClient(client.id));
          if (res.ok) router.push("/clientes");
        }}
        trigger={(openDelete) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Más acciones" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => create({ kind: "project", defaults: { client_id: client.id } })}>
                <FolderPlus /> Nuevo proyecto
              </DropdownMenuItem>
              {permissions.canViewFinances ? (
                <DropdownMenuItem onClick={() => create({ kind: "quote", clientId: client.id })}>
                  <FileText /> Nuevo presupuesto
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  const res = await runAction(setClientArchived(client.id, !client.archived_at));
                  if (res.ok) router.refresh();
                }}
              >
                {client.archived_at ? <ArchiveRestore /> : <Archive />}
                {client.archived_at ? "Restaurar" : "Archivar"}
              </DropdownMenuItem>
              {permissions.canManageClients ? (
                <DropdownMenuItem variant="destructive" onClick={openDelete}>
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
    </div>
  );
}
