import { z } from "zod";

// Shared building blocks. Forms send "" for empty inputs; these helpers turn
// that into null so optional columns stay NULL instead of empty strings.

const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

export const optionalText = (max = 2000) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Máximo ${max} caracteres`).nullable());

export const requiredText = (max = 200, label = "Este campo") =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max, `Máximo ${max} caracteres`);

export const optionalEmail = z.preprocess(emptyToNull, z.email("Correo no válido").nullable());

export const optionalUrl = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\/\S+$/i, "Debe empezar por http:// o https://")
    .nullable(),
);

export const optionalUuid = z.preprocess(emptyToNull, z.uuid("Selección no válida").nullable());
export const uuid = z.uuid("Identificador no válido");

export const optionalDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
    .nullable(),
);
export const requiredDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

/** Accepts "1.234,56", "1234.56" or a number. */
export function parseDecimal(v: unknown) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (s === "") return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : v;
}

export const optionalMoney = z.preprocess(
  parseDecimal,
  z.number({ error: "Importe no válido" }).min(0, "No puede ser negativo").max(99_999_999, "Importe demasiado alto").nullable(),
);
export const requiredMoney = z.preprocess(
  parseDecimal,
  z.number({ error: "Importe no válido" }).positive("Debe ser mayor que 0").max(99_999_999, "Importe demasiado alto"),
);

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido");
