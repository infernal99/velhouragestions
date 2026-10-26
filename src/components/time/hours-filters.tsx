"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/forms/fields";
import { TimeEntryDialog } from "@/components/time/entry-dialog";
import { ExportButton } from "@/components/shared/export-button";
import { useApp } from "@/components/app-provider";

export const hoursPeriods = [
  { value: "semana", label: "Esta semana" },
  { value: "semana-anterior", label: "Semana pasada" },
  { value: "mes", label: "Este mes" },
  { value: "mes-anterior", label: "Mes anterior" },
  { value: "anio", label: "Este año" },
  { value: "todo", label: "Todo" },
];

export function HoursFilters({ period, person, project, projects }: { period: string; person: string | null; project: string | null; projects: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { team } = useApp();
  const [adding, setAdding] = useState(false);

  const set = (key: string, value: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SimpleSelect value={period} onChange={(v) => set("periodo", v)} options={hoursPeriods} className="w-40" />
      <SimpleSelect
        value={person}
        onChange={(v) => set("persona", v)}
        options={team.map((m) => ({ value: m.id, label: m.full_name || m.email }))}
        allowEmpty
        emptyLabel="Todo el equipo"
        className="w-44"
      />
      <SimpleSelect value={project} onChange={(v) => set("proyecto", v)} options={projects} allowEmpty emptyLabel="Todos los proyectos" className="w-52" />
      <div className="ml-auto flex gap-2">
        <ExportButton tipo="horas" />
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Registrar horas
        </Button>
      </div>
      <TimeEntryDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
