"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/shared/progress-bar";
import { runAction } from "@/components/forms/use-action-form";
import { addChecklistItem, addDefaultChecklist, deleteChecklistItem, toggleChecklistItem } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "@/types/database";

export function WebChecklist({ projectId, items }: { projectId: string; items: ChecklistItem[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const done = items.filter((i) => local[i.id] ?? i.done).length;

  return (
    <div className="flex flex-col gap-3">
      {items.length ? <ProgressBar value={(done / items.length) * 100} /> : null}
      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">Revisa estos puntos antes de entregar la web al cliente.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await runAction(addDefaultChecklist(projectId));
              if (res.ok) router.refresh();
            }}
          >
            <ListPlus /> Usar checklist recomendada
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const checked = local[item.id] ?? item.done;
            return (
              <li key={item.id} className="group flex items-start gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={async (c) => {
                    setLocal((l) => ({ ...l, [item.id]: Boolean(c) }));
                    const res = await runAction(toggleChecklistItem(item.id, projectId, Boolean(c)));
                    if (!res.ok) setLocal((l) => ({ ...l, [item.id]: !c }));
                  }}
                />
                <span className={cn("flex-1 text-sm", checked && "text-muted-foreground line-through")}>{item.label}</span>
                <button
                  type="button"
                  aria-label="Quitar"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={async () => {
                    const res = await runAction(deleteChecklistItem(item.id, projectId));
                    if (res.ok) router.refresh();
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;
          const res = await runAction(addChecklistItem(projectId, label));
          if (res.ok) {
            setLabel("");
            router.refresh();
          }
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Añadir punto de revisión…" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={!label.trim()}>
          Añadir
        </Button>
      </form>
    </div>
  );
}
