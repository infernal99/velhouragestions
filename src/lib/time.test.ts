import { describe, expect, it } from "vitest";
import { entryMinutes, formatClock, formatDuration, formatHours } from "./time";

describe("time helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
    expect(formatHours(135)).toBe("2,25 h");
    expect(formatClock(3_909_000)).toBe("01:05:09");
  });

  it("counts a running entry up to now", () => {
    const start = new Date("2026-10-26T08:00:00Z").toISOString();
    expect(entryMinutes({ started_at: start, ended_at: null }, Date.parse("2026-10-26T09:30:00Z"))).toBe(90);
    expect(entryMinutes({ started_at: start, ended_at: "2026-10-26T08:45:00Z" })).toBe(45);
  });
});
