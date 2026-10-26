import { describe, expect, it } from "vitest";
import { hoursRange, parseHoursPeriod } from "./time-periods";

describe("hoursRange", () => {
  const wednesday = new Date("2026-10-28T12:00:00Z");

  it("weeks start on Monday at local midnight (Madrid is UTC+1 after the October clock change)", () => {
    expect(hoursRange("semana", wednesday)).toEqual({ from: "2026-10-25T23:00:00.000Z", to: "2026-11-01T23:00:00.000Z" });
    expect(hoursRange("semana-anterior", wednesday)).toEqual({ from: "2026-10-18T22:00:00.000Z", to: "2026-10-25T23:00:00.000Z" });
  });

  it("months and all-time", () => {
    expect(hoursRange("mes", wednesday).from).toBe("2026-09-30T22:00:00.000Z");
    expect(hoursRange("todo", wednesday)).toEqual({});
  });

  it("falls back to the current week for unknown values", () => {
    expect(parseHoursPeriod("x")).toBe("semana");
  });
});
