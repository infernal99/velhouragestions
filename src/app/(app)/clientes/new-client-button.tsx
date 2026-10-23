"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreate } from "@/components/create/create-dialogs";

export function NewClientButton() {
  const create = useCreate();
  return (
    <Button onClick={() => create({ kind: "client" })}>
      <Plus /> Nuevo cliente
    </Button>
  );
}
