// CSV tuned for Spanish Excel: ";" separator, decimal comma, UTF-8 BOM.

export type CsvValue = string | number | null | undefined;

function cell(v: CsvValue) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  // neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v !== "number" ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  const lines = [headers.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
