import { describe, expect, it } from "vitest";
import { entryRange, timeEntrySchema } from "./time";

describe("time entries", () => {
  const base = { project_id: "8c5b0f3e-2d1a-4f6b-9a7e-1c2d3e4f5a6b", date: "2026-10-26", start_time: "09:00", end_time: "13:30", tz_offset: -60 };

  it("converts local time to UTC (Madrid in winter is UTC+1)", () => {
    expect(entryRange(base)).toEqual({ started_at: "2026-10-26T08:00:00.000Z", ended_at: "2026-10-26T12:30:00.000Z" });
  });

  it("requires the end after the start", () => {
    expect(timeEntrySchema.safeParse({ ...base, end_time: "08:00" }).success).toBe(false);
    expect(timeEntrySchema.safeParse(base).success).toBe(true);
  });
});
