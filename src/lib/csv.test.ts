import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("uses ; and decimal commas, with a BOM for Excel", () => {
    const csv = toCsv(["Concepto", "Importe"], [["Web; fase 1", 1234.5]]);
    expect(csv).toBe('﻿Concepto;Importe\r\n"Web; fase 1";1234,5\r\n');
  });

  it("neutralises formula injection in text cells", () => {
    const csv = toCsv(["x"], [["=HYPERLINK(\"http://evil\")"]]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
