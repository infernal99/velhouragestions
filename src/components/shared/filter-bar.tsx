"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleSelect, type SelectOption } from "@/components/forms/fields";

export interface FilterDef {
  key: string;
  label: string;
  options: SelectOption[];
}

/** Search box + compact select filters (state is owned by the caller). */
export function FilterBar({
  search,
  onSearch,
  placeholder = "Buscar…",
  filters = [],
  values,
  onChange,
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  filters?: FilterDef[];
  values: Record<string, string | null>;
  onChange: (key: string, value: string | null) => void;
  children?: React.ReactNode;
}) {
  const active = Boolean(search) || Object.values(values).some(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      {filters.map((f) => (
        <SimpleSelect
          key={f.key}
          value={values[f.key] ?? null}
          onChange={(v) => onChange(f.key, v)}
          options={f.options}
          allowEmpty
          emptyLabel={f.label}
          className="w-auto min-w-36"
        />
      ))}
      {children}
      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearch("");
            for (const f of filters) onChange(f.key, null);
          }}
        >
          <X /> Limpiar
        </Button>
      ) : null}
    </div>
  );
}

export function normalize(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
