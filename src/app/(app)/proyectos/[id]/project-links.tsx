"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField, TextField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { addProjectLink, deleteProjectLink } from "@/lib/actions/projects";
import { projectLinkSchema } from "@/lib/validation/projects";
import { linkKindMap, linkKindOptions } from "@/lib/labels";
import type { ProjectLink } from "@/types/database";

export function ProjectLinks({ projectId, links }: { projectId: string; links: ProjectLink[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults = () => ({ project_id: projectId, kind: "github" as const, label: "", url: "" });
  const { form, onSubmit, pending } = useActionForm({
    schema: projectLinkSchema,
    defaultValues: defaults(),
    action: addProjectLink,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, defaults);

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 ? <p className="text-sm text-muted-foreground">GitHub, Vercel, dominio, web de prueba, documentación…</p> : null}
      <ul className="flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{linkKindMap[l.kind]?.label}</span>
            <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-w-0 flex-1 items-center gap-1 text-sm hover:underline">
              <span className="truncate">{l.label}</span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </a>
            <button
              type="button"
              aria-label="Quitar enlace"
              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              onClick={async () => {
                const res = await runAction(deleteProjectLink(l.id, projectId));
                if (res.ok) router.refresh();
              }}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
        <Plus /> Añadir enlace
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Añadir enlace" onSubmit={onSubmit} pending={pending} size="sm" submitLabel="Añadir">
        <SelectField form={form} name="kind" label="Tipo" options={linkKindOptions.map((o) => ({ value: o.value, label: o.label }))} />
        <TextField form={form} name="label" label="Etiqueta" placeholder="Repositorio principal" required />
        <TextField form={form} name="url" label="URL" placeholder="https://" required />
      </FormDialog>
    </div>
  );
}
