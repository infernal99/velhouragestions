import { z } from "zod";
import {
  optionalDate,
  optionalMoney,
  optionalText,
  optionalUrl,
  optionalUuid,
  requiredText,
} from "./common";

export const projectStatuses = [
  "pendiente",
  "planificado",
  "en_desarrollo",
  "revision",
  "entregado",
  "pausado",
  "cancelado",
] as const;
export const priorities = ["baja", "media", "alta", "urgente"] as const;
export const webTypes = ["landing", "tienda", "corporativa", "portfolio", "otra"] as const;
export const linkKinds = ["github", "vercel", "dominio", "staging", "produccion", "documentacion", "diseno", "otro"] as const;

export const projectSchema = z
  .object({
    name: requiredText(160, "El nombre"),
    description: optionalText(10000),
    client_id: optionalUuid,
    type: z.string().trim().min(1, "Elige un tipo").max(40),
    status: z.enum(projectStatuses),
    priority: z.enum(priorities),
    start_date: optionalDate,
    due_date: optionalDate,
    budget: optionalMoney,
    owner_id: optionalUuid,
    member_ids: z.array(z.uuid()).max(50).default([]),
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    message: "La fecha límite no puede ser anterior al inicio",
    path: ["due_date"],
  });

export const projectLinkSchema = z.object({
  project_id: z.uuid(),
  kind: z.enum(linkKinds),
  label: requiredText(120, "La etiqueta"),
  url: z.string().trim().regex(/^https?:\/\/\S+$/i, "Debe empezar por http:// o https://").max(500),
});

export const webDetailsSchema = z.object({
  project_id: z.uuid(),
  web_type: z.enum(webTypes),
  stage_id: optionalUuid,
  dev_url: optionalUrl,
  production_url: optionalUrl,
  repository_url: optionalUrl,
  domain: optionalText(200),
  hosting_provider: optionalText(120),
  domain_renewal_date: optionalDate,
  requirements: optionalText(20000),
});

export const webRequestSchema = z.object({
  project_id: z.uuid(),
  kind: z.enum(["cambio", "problema"]),
  title: requiredText(200, "El título"),
  description: optionalText(5000),
  priority: z.enum(priorities),
  status: z.enum(["abierto", "en_curso", "resuelto", "descartado"]),
  assignee_id: optionalUuid,
  requested_by_client: z.boolean().default(true),
});

export const secretReferenceSchema = z.object({
  project_id: z.uuid(),
  label: requiredText(120, "La etiqueta"),
  vault_provider: requiredText(60, "El gestor"),
  vault_reference: requiredText(500, "La referencia"),
  notes: optionalText(500),
});

/**
 * Heuristic guard: the reference field must point to a vault item, never
 * contain the secret itself. Rejects values that look like API keys,
 * private keys or "user:password" pairs.
 */
export function looksLikeSecret(value: string) {
  const v = value.trim();
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(v)) return true;
  if (/^(sk|pk|rk|ghp|gho|github_pat|xox[bp]|AKIA|AIza|sb_secret)[-_A-Za-z0-9]{12,}/.test(v)) return true;
  if (/^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(v)) return true; // JWT
  if (/^[^\s/:@]+:[^\s/@]{6,}$/.test(v)) return true; // user:password
  if (!/[\s/:.]/.test(v) && v.length >= 24 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v)) return true;
  return false;
}

export const webStageSchema = z.object({
  id: optionalUuid,
  name: requiredText(60, "El nombre"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
});

export type ProjectInput = z.input<typeof projectSchema>;
