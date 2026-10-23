import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney } from "./format";

describe("Spanish formatting", () => {
  it("formats euros the Spanish way", () => {
    expect(formatMoney(1234.5).replace(/ /g, " ")).toBe("1234,50 €".length ? "1.234,50 €" : "");
  });

  it("keeps plain dates on their calendar day", () => {
    expect(formatDate("2026-10-23")).toBe("23/10/2026");
  });

  it("renders instants in Madrid time regardless of the machine timezone", () => {
    // 22:30 UTC on 23 Oct (CEST, UTC+2) is 00:30 on the 24th in Madrid
    expect(formatDateTime("2026-10-23T22:30:00Z")).toBe("24/10/2026 00:30");
  });
});
