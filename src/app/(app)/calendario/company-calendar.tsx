"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import { CalendarPlus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventFormDialog, type EventFormValues } from "@/components/calendar/event-form-dialog";
import { runAction } from "@/components/forms/use-action-form";
import { getCalendarData, type CalendarData } from "@/lib/actions/calendar";
import { moveEvent } from "@/lib/actions/events";
import { updateTaskDueDate } from "@/lib/actions/tasks";
import { eventCategoryOptions } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/types/database";

const TASK_COLOR = "#0ea5e9";
const DEADLINE_COLOR = "#dc2626";

export function CompanyCalendar() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const range = useRef<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<CalendarData | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<EventFormValues | null>(null);

  const load = useCallback(async () => {
    if (!range.current) return;
    const res = await getCalendarData(range.current.from, range.current.to);
    if (res.ok) setData(res.data);
  }, []);

  const onDates = (arg: DatesSetArg) => {
    range.current = { from: arg.start.toISOString(), to: arg.end.toISOString() };
    void load();
  };

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const events: EventInput[] = [];
  if (data) {
    for (const e of data.events) {
      if (hidden.has(e.category)) continue;
      const color = e.color ?? eventCategoryOptions.find((c) => c.value === e.category)?.color;
      events.push({
        id: `event:${e.id}`,
        title: e.title,
        start: e.all_day ? e.starts_at.slice(0, 10) : e.starts_at,
        end: e.all_day ? e.ends_at.slice(0, 10) : e.ends_at,
        allDay: e.all_day,
        backgroundColor: color,
        borderColor: color,
        editable: true,
        extendedProps: { kind: "event" },
      });
    }
    if (!hidden.has("__tasks")) {
      for (const t of data.tasks) {
        events.push({
          id: `task:${t.id}`,
          title: `☐ ${t.title}`,
          start: t.due_date,
          allDay: true,
          backgroundColor: "transparent",
          borderColor: TASK_COLOR,
          textColor: TASK_COLOR,
          classNames: t.status === "completada" ? ["line-through", "opacity-60"] : [],
          editable: true,
          durationEditable: false,
          extendedProps: { kind: "task" },
        });
      }
    }
    if (!hidden.has("__deadlines")) {
      for (const p of data.deadlines) {
        events.push({
          id: `deadline:${p.id}`,
          title: `⚑ Entrega: ${p.name}`,
          start: p.due_date,
          allDay: true,
          backgroundColor: DEADLINE_COLOR,
          borderColor: DEADLINE_COLOR,
          editable: false,
          extendedProps: { kind: "deadline" },
        });
      }
    }
  }

  const legend = [
    ...eventCategoryOptions.map((c) => ({ key: c.value as string, label: c.label, color: c.color })),
    { key: "__tasks", label: "Tareas (fecha límite)", color: TASK_COLOR },
    { key: "__deadlines", label: "Entregas de proyectos", color: DEADLINE_COLOR },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {legend.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => toggle(l.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity",
              hidden.has(l.key) && "opacity-40",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setDialog({})}>
          <CalendarPlus /> Nuevo evento
        </Button>
      </div>
      <div className="rounded-xl border bg-card p-2 sm:p-3">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          firstDay={1}
          height="auto"
          nowIndicator
          selectable
          selectMirror
          dayMaxEvents={4}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          scrollTime="08:00:00"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          events={events}
          datesSet={onDates}
          select={(info) => {
            const date = info.startStr.slice(0, 10);
            if (info.allDay) {
              setDialog({ defaultDate: date, all_day: false });
            } else {
              setDialog({ starts_at: info.start.toISOString(), ends_at: info.end.toISOString(), all_day: false });
            }
            calendarRef.current?.getApi().unselect();
          }}
          eventClick={(info) => {
            const [kind, id] = info.event.id.split(":");
            if (kind === "event") {
              const ev = data?.events.find((e) => e.id === id);
              if (ev) setDialog({ ...ev, category: ev.category as EventCategory });
            } else if (kind === "task") {
              router.push(`/tareas?tarea=${id}`);
            } else if (kind === "deadline") {
              router.push(`/proyectos/${id}`);
            }
          }}
          eventDrop={async (info) => {
            const [kind, id] = info.event.id.split(":");
            let okMove = false;
            if (kind === "event") {
              const start = info.event.start!;
              const end = info.event.end ?? new Date(start.getTime() + 3_600_000);
              okMove = (
                await runAction(
                  moveEvent(id, {
                    starts_at: info.event.allDay ? `${info.event.startStr.slice(0, 10)}T00:00:00Z` : start.toISOString(),
                    ends_at: info.event.allDay
                      ? `${(info.event.endStr || info.event.startStr).slice(0, 10)}T00:00:00Z`
                      : end.toISOString(),
                    all_day: info.event.allDay,
                  }),
                )
              ).ok;
            } else if (kind === "task") {
              okMove = (await runAction(updateTaskDueDate(id, info.event.startStr.slice(0, 10)))).ok;
            }
            if (!okMove) info.revert();
            else void load();
          }}
          eventResize={async (info) => {
            const [kind, id] = info.event.id.split(":");
            if (kind !== "event") return info.revert();
            const res = await runAction(
              moveEvent(id, {
                starts_at: info.event.start!.toISOString(),
                ends_at: (info.event.end ?? info.event.start!).toISOString(),
                all_day: info.event.allDay,
              }),
            );
            if (!res.ok) info.revert();
            else void load();
          }}
        />
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        Las tareas y entregas se muestran desde su propia ficha, sin duplicarse como eventos. La sincronización con Google
        Calendar todavía no está conectada (la base de datos ya está preparada para ello).
      </p>
      <EventFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        event={dialog ?? undefined}
        onSaved={() => {
          void load();
          router.refresh();
        }}
      />
    </div>
  );
}
