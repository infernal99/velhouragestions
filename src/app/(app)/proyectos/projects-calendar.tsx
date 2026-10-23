"use client";

import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import esLocale from "@fullcalendar/core/locales/es";
import type { ProjectRow } from "./projects-view";

const statusColor: Record<string, string> = {
  pendiente: "#94a3b8",
  planificado: "#0ea5e9",
  en_desarrollo: "#6366f1",
  revision: "#f59e0b",
  entregado: "#22c55e",
  pausado: "#a1a1aa",
  cancelado: "#ef4444",
};

function addDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Projects drawn from start to deadline (or just the deadline). */
export function ProjectsCalendar({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const events = projects
    .filter((p) => p.due_date || p.start_date)
    .map((p) => ({
      id: p.id,
      title: p.name,
      start: p.start_date ?? p.due_date!,
      end: addDay(p.due_date ?? p.start_date!),
      allDay: true,
      backgroundColor: statusColor[p.status],
      borderColor: statusColor[p.status],
    }));

  return (
    <div className="rounded-xl border bg-card p-3">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        locale={esLocale}
        height="auto"
        firstDay={1}
        events={events}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        eventClick={(info) => router.push(`/proyectos/${info.event.id}`)}
        dayMaxEvents={4}
      />
      {events.length === 0 ? (
        <p className="pt-3 text-center text-sm text-muted-foreground">Ningún proyecto tiene fechas asignadas.</p>
      ) : null}
    </div>
  );
}
