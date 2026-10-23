"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { FilterBar, normalize } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { FileList, type FileRow } from "@/components/files/file-list";
import { FileUploader } from "@/components/files/file-uploader";
import { FormField, SimpleSelect } from "@/components/forms/fields";
import { useLookups } from "@/components/create/use-lookups";
import { fileCategoryOptions } from "@/lib/labels";

export type DocRow = FileRow & {
  project_id: string | null;
  client_id: string | null;
  project: { name: string } | null;
  client: { name: string } | null;
};

export function DocumentsView({ files, highlight }: { files: DocRow[]; highlight: string | null }) {
  const lookups = useLookups(true);
  const [search, setSearch] = useState(() => (highlight ? (files.find((f) => f.id === highlight)?.name ?? "") : ""));
  const [filters, setFilters] = useState<Record<string, string | null>>({ category: null, client: null, project: null });
  const [target, setTarget] = useState<{ client_id: string | null; project_id: string | null }>({ client_id: null, project_id: null });

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) if (f.client_id && f.client) m.set(f.client_id, f.client.name);
    return [...m].map(([value, label]) => ({ value, label }));
  }, [files]);
  const projects = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) if (f.project_id && f.project) m.set(f.project_id, f.project.name);
    return [...m].map(([value, label]) => ({ value, label }));
  }, [files]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return files
      .filter(
        (f) =>
          (!filters.category || f.category === filters.category) &&
          (!filters.client || f.client_id === filters.client) &&
          (!filters.project || f.project_id === filters.project) &&
          (!q || [f.name, f.project?.name, f.client?.name].some((v) => normalize(v).includes(q))),
      )
      .map((f) => ({ ...f, project_name: f.project?.name ?? null, client_name: f.client?.name ?? null }));
  }, [files, search, filters]);

  const projectOptions = lookups.projects.filter((p) => !target.client_id || p.client_id === target.client_id);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Subir documentos</p>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Cliente">
            <SimpleSelect
              value={target.client_id}
              onChange={(v) => setTarget({ client_id: v, project_id: null })}
              options={lookups.clients.map((c) => ({ value: c.id, label: c.name }))}
              allowEmpty
              emptyLabel="Sin cliente"
            />
          </FormField>
          <FormField label="Proyecto">
            <SimpleSelect
              value={target.project_id}
              onChange={(v) => setTarget((t) => ({ ...t, project_id: v }))}
              options={projectOptions.map((p) => ({ value: p.id, label: p.name }))}
              allowEmpty
              emptyLabel="Sin proyecto"
            />
          </FormField>
        </div>
        <FileUploader target={target} />
      </div>

      {files.length === 0 ? (
        <EmptyState icon={FileText} title="Aún no hay documentos" description="Sube briefings, contratos, diseños o recursos del cliente. Se guardan de forma privada para el equipo." />
      ) : (
        <>
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="Buscar por nombre, cliente o proyecto…"
            values={filters}
            onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
            filters={[
              { key: "category", label: "Todas las categorías", options: fileCategoryOptions.map((o) => ({ value: o.value, label: o.label })) },
              { key: "client", label: "Todos los clientes", options: clients },
              { key: "project", label: "Todos los proyectos", options: projects },
            ]}
          />
          {filtered.length === 0 ? (
            <EmptyState compact title="Ningún documento coincide con los filtros" />
          ) : (
            <FileList files={filtered} showContext />
          )}
        </>
      )}
    </div>
  );
}
