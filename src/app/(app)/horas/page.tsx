import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { currentTimeMs, getRunningEntry, listTimeEntries } from "@/lib/queries/time";
import { hoursRange, parseHoursPeriod } from "@/lib/time-periods";
import { PageHeader } from "@/components/shared/page-header";
import { TimerCard } from "@/components/time/timer-card";
import { HoursSummary } from "@/components/time/hours-summary";
import { HoursFilters } from "@/components/time/hours-filters";
import { EntriesList } from "@/components/time/entries-list";

export const metadata: Metadata = { title: "Horas" };

export default async function HoursPage({ searchParams }: PageProps<"/horas">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const period = parseHoursPeriod(sp.periodo);
  const person = typeof sp.persona === "string" && ctx.team.some((m) => m.id === sp.persona) ? sp.persona : null;
  const projectId = typeof sp.proyecto === "string" && /^[0-9a-f-]{36}$/i.test(sp.proyecto) ? sp.proyecto : null;
  const range = hoursRange(period);

  const supabase = await createClient();
  const [running, entries, { data: projects }] = await Promise.all([
    getRunningEntry(ctx.userId),
    listTimeEntries(ctx.company.id, { ...range, userId: person ?? undefined, projectId: projectId ?? undefined }),
    supabase.from("projects").select("id, name").eq("company_id", ctx.company.id).is("archived_at", null).order("name"),
  ]);
  const now = currentTimeMs();

  return (
    <>
      <PageHeader title="Horas" description="Ficha el tiempo que dedicáis a cada proyecto y mira cuánto suma por proyecto y por persona." />
      <div className="flex flex-col gap-5">
        <TimerCard running={running} />
        <HoursFilters
          period={period}
          person={person}
          project={projectId}
          projects={(projects ?? []).map((p) => ({ value: p.id as string, label: p.name as string }))}
        />
        <HoursSummary entries={entries} team={ctx.team} now={now} />
        <div>
          <h2 className="mb-3 text-sm font-semibold">Fichajes</h2>
          <EntriesList entries={entries} now={now} />
        </div>
      </div>
    </>
  );
}
