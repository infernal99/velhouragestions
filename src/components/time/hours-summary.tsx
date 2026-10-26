import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Panel } from "@/components/shared/info-list";
import { entryMinutes, formatDuration, formatHours } from "@/lib/time";
import { accentChip, accentForName } from "@/lib/accents";
import { cn } from "@/lib/utils";
import type { TimeEntryRow } from "@/lib/queries/time";

interface Person {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-brand" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

/** Totals, hours per project and hours per person for a set of entries. */
export function HoursSummary({
  entries,
  team,
  now,
  showProjects = true,
}: {
  entries: TimeEntryRow[];
  team: Person[];
  now: number;
  showProjects?: boolean;
}) {
  const total = entries.reduce((s, e) => s + entryMinutes(e, now), 0);

  const byProject = new Map<string, { id: string; name: string; minutes: number }>();
  const byPerson = new Map<string, number>();
  for (const e of entries) {
    const m = entryMinutes(e, now);
    const p = byProject.get(e.project_id) ?? { id: e.project_id, name: e.project?.name ?? "Proyecto", minutes: 0 };
    p.minutes += m;
    byProject.set(e.project_id, p);
    byPerson.set(e.user_id, (byPerson.get(e.user_id) ?? 0) + m);
  }
  const projects = [...byProject.values()].sort((a, b) => b.minutes - a.minutes);
  const people = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[13px] text-muted-foreground">Horas totales</p>
          <p className="mt-2 text-2xl font-semibold tabular">{formatHours(total)}</p>
          <p className="text-xs text-muted-foreground">{formatDuration(total)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[13px] text-muted-foreground">Fichajes</p>
          <p className="mt-2 text-2xl font-semibold tabular">{entries.length}</p>
        </div>
        <div className="col-span-2 rounded-xl border bg-card p-4 md:col-span-1">
          <p className="text-[13px] text-muted-foreground">Media por fichaje</p>
          <p className="mt-2 text-2xl font-semibold tabular">{entries.length ? formatDuration(total / entries.length) : "—"}</p>
        </div>
      </div>

      <div className={cn("grid gap-5", showProjects && "lg:grid-cols-2")}>
        {showProjects ? (
          <Panel title="Horas por proyecto">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin horas en este periodo.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <Link href={`/proyectos/${p.id}?tab=horas`} className="w-40 shrink-0 truncate font-medium hover:underline">
                      {p.name}
                    </Link>
                    <Bar value={p.minutes} max={projects[0].minutes} />
                    <span className="w-24 shrink-0 text-right tabular">{formatDuration(p.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
        <Panel title="Horas por persona">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin horas en este periodo.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {people.map(([id, minutes]) => {
                const p = team.find((m) => m.id === id);
                const name = p ? p.full_name || p.email : "Antiguo miembro";
                return (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="flex w-40 shrink-0 items-center gap-2 truncate font-medium">
                      <UserAvatar name={name} src={p?.avatar_url} size="sm" className={accentChip[accentForName(name)]} />
                      <span className="truncate">{name}</span>
                    </span>
                    <Bar value={minutes} max={people[0][1]} />
                    <span className="w-24 shrink-0 text-right tabular">{formatDuration(minutes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
