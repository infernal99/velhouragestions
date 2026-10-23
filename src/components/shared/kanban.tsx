"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  hint?: React.ReactNode;
}

/**
 * Generic board. Moves are optimistic: the card jumps immediately and
 * `onMove` persists it; if that rejects, the card snaps back.
 */
export function KanbanBoard<T extends { id: string }>({
  columns,
  items,
  getColumn,
  renderCard,
  onMove,
  emptyLabel = "Sin elementos",
}: {
  columns: KanbanColumn[];
  items: T[];
  getColumn: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onMove: (item: T, toColumn: string) => Promise<boolean>;
  emptyLabel?: string;
}) {
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columnOf = (item: T) => overrides[item.id] ?? getColumn(item);
  const active = activeId ? items.find((i) => i.id === activeId) : undefined;

  const handleEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const to = event.over?.id as string | undefined;
    const item = items.find((i) => i.id === event.active.id);
    if (!to || !item || columnOf(item) === to) return;
    const previous = overrides[item.id];
    setOverrides((o) => ({ ...o, [item.id]: to }));
    const okMove = await onMove(item, to);
    if (!okMove) {
      setOverrides((o) => {
        const next = { ...o };
        if (previous) next[item.id] = previous;
        else delete next[item.id];
        return next;
      });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {columns.map((col) => {
          const colItems = items.filter((i) => columnOf(i) === col.id);
          return (
            <Column key={col.id} column={col} count={colItems.length}>
              {colItems.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>
              ) : (
                colItems.map((item) => (
                  <DraggableCard key={item.id} id={item.id}>
                    {renderCard(item)}
                  </DraggableCard>
                ))
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <div className="rotate-1 cursor-grabbing opacity-95 shadow-lg">{renderCard(active)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ column, count, children }: { column: KanbanColumn; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
        isOver && "bg-brand/[0.07] ring-1 ring-brand/30",
      )}
    >
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-1">
        {column.color ? <span className="size-2 rounded-full" style={{ backgroundColor: column.color }} /> : null}
        <span className="text-[13px] font-semibold">{column.title}</span>
        <span className="text-xs text-muted-foreground tabular">{count}</span>
        {column.hint ? <span className="ml-auto text-xs text-muted-foreground">{column.hint}</span> : null}
      </div>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("touch-manipulation outline-none", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}
