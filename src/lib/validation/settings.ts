import { z } from "zod";
import { hexColor, optionalEmail, optionalText, optionalUrl, requiredText } from "./common";

export const companyProfileSchema = z.object({
  name: requiredText(120, "El nombre"),
  legal_name: optionalText(200),
  tax_id: optionalText(30),
  address: optionalText(300),
  city: optionalText(100),
  postal_code: optionalText(20),
  country: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
});

export const brandingSchema = z.object({
  primary_color: hexColor,
});

export const regionalSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, "Código ISO de 3 letras (EUR)"),
  date_format: z.enum(["dd/MM/yyyy", "d MMM yyyy", "yyyy-MM-dd"]),
  default_tax_rate: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number().min(0).max(100)),
  quote_prefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
});

export const projectSettingsSchema = z.object({
  project_types: z
    .array(z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z0-9_-]+$/, "Usa minúsculas sin espacios"))
    .min(1, "Debe haber al menos un tipo")
    .max(20),
  project_status_labels: z.record(z.string(), z.string().trim().max(40)),
});

export const notificationKinds = ["task_assigned", "assignee_changed", "comment", "project_updated", "due_soon", "payment_due"] as const;

export const preferencesSchema = z.object({
  notifications: z.record(z.enum(notificationKinds), z.boolean()),
});

export const inviteSchema = z.object({
  email: z.email("Correo no válido"),
  role: z.enum(["admin", "member"]),
});

export const memberUpdateSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(["admin", "member"]),
  can_view_finances: z.boolean(),
  can_manage_clients: z.boolean(),
});

export const profileSchema = z.object({
  full_name: requiredText(120, "El nombre"),
  job_title: optionalText(120),
  phone: optionalText(40),
});

export const categorySchema = z.object({
  name: requiredText(60, "El nombre"),
  color: hexColor,
});
