"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreate } from "@/components/create/create-dialogs";
import type { ProjectFormValues } from "@/components/projects/project-form-dialog";

export function NewProjectButton({ defaults, label = "Nuevo proyecto" }: { defaults?: ProjectFormValues; label?: string }) {
  const create = useCreate();
  return (
    <Button onClick={() => create({ kind: "project", defaults })}>
      <Plus /> {label}
    </Button>
  );
}
