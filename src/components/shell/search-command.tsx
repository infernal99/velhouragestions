"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckSquare, FileText, FolderKanban, Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type SearchResult } from "@/lib/actions/shell";
import { navGroups } from "@/lib/navigation";
import { useApp } from "@/components/app-provider";
import { can } from "@/lib/permissions";
import { projectStatusMapWith, taskStatusMap } from "@/lib/labels";
import type { ProjectStatus, TaskStatus } from "@/types/database";

const kindMeta = {
  client: { label: "Clientes", icon: Building2 },
  project: { label: "Proyectos", icon: FolderKanban },
  task: { label: "Tareas", icon: CheckSquare },
  file: { label: "Documentos", icon: FileText },
} as const;

function subtitle(r: SearchResult, custom: Partial<Record<ProjectStatus, string>>) {
  if (r.kind === "project") return projectStatusMapWith(custom)[r.subtitle as ProjectStatus]?.label ?? r.subtitle;
  if (r.kind === "task") return taskStatusMap[r.subtitle as TaskStatus]?.label ?? r.subtitle;
  return r.subtitle;
}

export function SearchCommand() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const { permissions, company } = useApp();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await globalSearch(q);
      if (!cancelled) {
        setResults(res.ok ? res.data : []);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  const pages = navGroups
    .flatMap((g) => g.items)
    .filter((i) => !i.requires || can(permissions, i.requires))
    .filter((i) => !query || i.label.toLowerCase().includes(query.toLowerCase()));

  const grouped = (Object.keys(kindMeta) as (keyof typeof kindMeta)[])
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuery("");
            setResults([]);
          }
        }}
        title="Búsqueda global"
        description="Busca clientes, proyectos, tareas y documentos"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Busca clientes, proyectos, tareas o documentos…"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              if (v.trim().length < 2) setResults([]);
            }}
          />
          <CommandList className="max-h-[60svh]">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </div>
            ) : null}
            {!loading && query.trim().length >= 2 && results.length === 0 && pages.length === 0 ? (
              <CommandEmpty>Sin resultados para «{query}».</CommandEmpty>
            ) : null}
            {grouped.map((g) => {
              const Icon = kindMeta[g.kind].icon;
              return (
                <CommandGroup key={g.kind} heading={kindMeta[g.kind].label}>
                  {g.items.map((r) => (
                    <CommandItem key={`${r.kind}-${r.id}`} value={`${r.kind}-${r.id}`} onSelect={() => go(r.link)}>
                      <Icon className="text-muted-foreground" />
                      <span className="flex-1 truncate">{r.title}</span>
                      {subtitle(r, company.statusLabels) ? <span className="truncate text-xs text-muted-foreground">{subtitle(r, company.statusLabels)}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {pages.length > 0 ? (
              <CommandGroup heading="Ir a">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon className="text-muted-foreground" />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
