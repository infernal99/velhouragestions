import { describe, expect, it } from "vitest";
import { computeQuoteTotals, expenseSchema, paymentSchema } from "./finance";
import { parseDecimal } from "./common";

describe("computeQuoteTotals", () => {
  it("matches the database trigger (same numbers as the RLS test)", () => {
    const t = computeQuoteTotals([
      { quantity: 1, unit_price: 1000, discount_pct: 10, tax_pct: 21 },
      { quantity: 12, unit_price: 10, discount_pct: 0, tax_pct: 21 },
    ]);
    expect(t).toEqual({ subtotal: 1120, discount: 100, net: 1020, tax: 214.2, total: 1234.2 });
  });
});

describe("Spanish number input", () => {
  it("parses 1.234,56 and 1234.56 alike", () => {
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("1234.56")).toBe(1234.56);
    expect(parseDecimal("")).toBeNull();
  });

  it("rejects non-positive payment amounts", () => {
    const r = paymentSchema.safeParse({
      receivable_id: "8c5b0f3e-2d1a-4f6b-9a7e-1c2d3e4f5a6b",
      amount: "0",
      paid_at: "2026-10-01",
      method: "transferencia",
    });
    expect(r.success).toBe(false);
  });

  it("accepts an expense with comma decimals", () => {
    const r = expenseSchema.parse({ concept: "Hosting", amount: "19,99", tax_amount: "4,20", expense_date: "2026-10-01" });
    expect(r.amount).toBe(19.99);
    expect(r.tax_amount).toBe(4.2);
  });
});
