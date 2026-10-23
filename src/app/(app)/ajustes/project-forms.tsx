"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAction } from "@/components/forms/use-action-form";
import { saveProjectSettings, saveWebStages } from "@/lib/actions/settings";
import { projectStatusOptions, projectTypeLabel } from "@/lib/labels";
import type { WebStage } from "@/types/database";

export function ProjectSettingsForm({ types, labels }: { types: string[]; labels: Record<string, string> }) {
  const router = useRouter();
  const [list, setList] = useState(types);
  const [newType, setNewType] = useState("");
  const [names, setNames] = useState<Record<string, string>>(labels);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="mb-2 block text-[13px]">Tipos de proyecto</Label>
        <div className="flex flex-wrap gap-1.5">
          {list.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-sm">
              {projectTypeLabel(t)}
              {t !== "web" ? (
                <button type="button" aria-label={`Quitar ${t}`} onClick={() => setList((l) => l.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
        <form
          className="mt-2 flex max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const slug = newType
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .replace(/[^a-z0-9]+/g, "_");
            if (slug && !list.includes(slug)) setList((l) => [...l, slug]);
            setNewType("");
          }}
        >
          <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo (p. ej. SEO)" className="h-8" />
          <Button type="submit" variant="outline" size="sm" disabled={!newType.trim()}>
            Añadir
          </Button>
        </form>
        <p className="mt-1.5 text-xs text-muted-foreground">El tipo «Web» es fijo: alimenta la sección Webs en desarrollo.</p>
      </div>
      <div>
        <Label className="mb-2 block text-[13px]">Nombres de los estados</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {projectStatusOptions.map((s) => (
            <div key={s.value} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">{s.label}</span>
              <Input value={names[s.value] ?? ""} placeholder={s.label} onChange={(e) => setNames((n) => ({ ...n, [s.value]: e.target.value }))} className="h-8" />
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Los estados en sí son fijos (el sistema los usa para calcular entregas y paneles); aquí solo puedes adaptar cómo se llaman.
        </p>
      </div>
      <div className="flex justify-end">
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const res = await runAction(saveProjectSettings({ project_types: list, project_status_labels: names }));
            setSaving(false);
            if (res.ok) router.refresh();
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </div>
    </div>
  );
}

export function WebStagesForm({ stages }: { stages: WebStage[] }) {
  const router = useRouter();
  const [list, setList] = useState(stages.map((s) => ({ id: s.id as string | null, name: s.name, color: s.color })));
  const [saving, setSaving] = useState(false);

  const move = (i: number, dir: -1 | 1) =>
    setList((l) => {
      const next = [...l];
      const [item] = next.splice(i, 1);
      next.splice(i + dir, 0, item);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {list.map((s, i) => (
          <li key={s.id ?? `new-${i}`} className="flex items-center gap-2">
            <span className="w-5 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
            <Input
              type="color"
              value={s.color}
              onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
              className="h-8 w-10 cursor-pointer p-1"
              aria-label="Color"
            />
            <Input value={s.name} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-8 flex-1" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" disabled={list.length === 1} onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => setList((l) => [...l, { id: null, name: "Nueva etapa", color: "#64748b" }])}>
          <Plus /> Añadir etapa
        </Button>
        <Button
          disabled={saving || list.some((s) => !s.name.trim())}
          onClick={async () => {
            setSaving(true);
            const res = await runAction(saveWebStages(list.map((s) => ({ ...s, name: s.name.trim() }))));
            setSaving(false);
            if (res.ok) router.refresh();
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar etapas
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Si quitas una etapa, las webs que estaban en ella quedarán «Sin etapa».</p>
    </div>
  );
}
