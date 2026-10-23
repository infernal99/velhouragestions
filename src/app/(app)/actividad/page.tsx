import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/info-list";
import { ActivityFeed, type ActivityRow } from "@/components/shared/activity-feed";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Actividad" };

const FILTERS = [
  { value: "", label: "Todo" },
  { value: "project", label: "Proyectos" },
  { value: "task", label: "Tareas" },
  { value: "client", label: "Clientes" },
  { value: "event", label: "Eventos" },
  { value: "file", label: "Archivos" },
  { value: "finance", label: "Finanzas" },
];

const PAGE = 50;

export default async function ActivityPage({ searchParams }: PageProps<"/actividad">) {
  const ctx = await requireContext();
  const { tipo, persona, pagina } = await searchParams;
  const type = typeof tipo === "string" ? tipo : "";
  const person = typeof persona === "string" ? persona : "";
  const page = Math.max(1, Number(pagina) || 1);
  const supabase = await createClient();

  // RLS limits what each member sees (finance entries only with finance access).
  let q = supabase
    .from("activity_log")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE);
  if (type === "finance") q = q.eq("is_finance", true);
  else if (type) q = q.eq("entity_type", type);
  if (person && ctx.team.some((m) => m.id === person)) q = q.eq("actor_id", person);
  const { data } = await q.returns<ActivityRow[]>();
  const rows = data ?? [];
  const hasMore = rows.length > PAGE;

  const href = (params: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const merged = { tipo: type, persona: person, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "pagina" && Number(v) === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/actividad${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Actividad" description="Historial de acciones del equipo: quién hizo qué y cuándo." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.filter((f) => f.value !== "finance" || ctx.permissions.canViewFinances).map((f) => (
          <Link
            key={f.value}
            href={href({ tipo: f.value, pagina: 1 })}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", type === f.value ? "bg-foreground text-background" : "hover:bg-muted")}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 w-px bg-border" />
        {ctx.team.map((m) => (
          <Link
            key={m.id}
            href={href({ persona: person === m.id ? "" : m.id, pagina: 1 })}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", person === m.id ? "bg-foreground text-background" : "hover:bg-muted")}
          >
            {m.full_name || m.email}
          </Link>
        ))}
      </div>
      <Panel>
        <ActivityFeed items={rows.slice(0, PAGE)} />
      </Panel>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={href({ pagina: page - 1 })} className="hover:underline">← Más recientes</Link> : <span />}
        {hasMore ? <Link href={href({ pagina: page + 1 })} className="hover:underline">Anteriores →</Link> : null}
      </div>
    </>
  );
}
