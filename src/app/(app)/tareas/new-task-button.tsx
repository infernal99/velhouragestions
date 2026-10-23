"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreate } from "@/components/create/create-dialogs";

export function NewTaskButton() {
  const create = useCreate();
  return (
    <Button onClick={() => create({ kind: "task" })}>
      <Plus /> Nueva tarea
    </Button>
  );
}
