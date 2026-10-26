import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./periods";

describe("resolvePeriod", () => {
  const now = new Date(2026, 9, 23); // 23 Oct 2026

  it("defaults to the current month", () => {
    expect(resolvePeriod(undefined, now)).toMatchObject({ key: "mes", from: "2026-10-01", to: "2026-10-31" });
  });

  it("handles the previous month and quarter", () => {
    expect(resolvePeriod("mes-anterior", now)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("trimestre", now)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("ignores unknown keys", () => {
    expect(resolvePeriod("hack';--", now).key).toBe("mes");
  });
});

describe("all-time period", () => {
  it("covers everything", () => {
    expect(resolvePeriod("todo", new Date(2026, 9, 23))).toMatchObject({ key: "todo", from: "2000-01-01", to: "2100-12-31", label: "Todo el tiempo" });
  });
});
