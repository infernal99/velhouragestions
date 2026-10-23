import { describe, expect, it } from "vitest";
import { eventRange, eventSchema, taskSchema } from "./tasks";

describe("taskSchema", () => {
  it("splits comma separated labels and nulls empty optionals", () => {
    const v = taskSchema.parse({
      title: "Maquetar home",
      status: "pendiente",
      priority: "alta",
      labels: "diseño, front ,",
      due_date: "",
      assignee_id: "",
    });
    expect(v.labels).toEqual(["diseño", "front"]);
    expect(v.due_date).toBeNull();
    expect(v.assignee_id).toBeNull();
  });
});

describe("eventRange", () => {
  it("converts local Madrid time (UTC+2 in summer) to UTC", () => {
    const v = eventSchema.parse({
      title: "Reunión",
      category: "reunion",
      date: "2026-07-10",
      start_time: "10:30",
      duration_minutes: 90,
      tz_offset: -120,
    });
    expect(eventRange(v)).toEqual({
      starts_at: "2026-07-10T08:30:00.000Z",
      ends_at: "2026-07-10T10:00:00.000Z",
    });
  });

  it("requires a start time unless all-day", () => {
    const r = eventSchema.safeParse({ title: "X", category: "otro", date: "2026-01-01", start_time: "" });
    expect(r.success).toBe(false);
  });
});
