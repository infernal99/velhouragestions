import { z } from "zod";
import { optionalDate, optionalEmail, optionalMoney, optionalText, optionalUrl, optionalUuid, requiredText } from "./common";

export const crmStages = ["nuevo", "contactado", "reunion", "propuesta", "negociacion", "ganado", "perdido"] as const;
export const interactionKinds = ["llamada", "reunion", "mensaje", "email", "acuerdo", "nota"] as const;

export const clientSchema = z.object({
  name: requiredText(160, "El nombre"),
  contact_name: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  legal_name: optionalText(200),
  tax_id: optionalText(30),
  address: optionalText(300),
  website: optionalUrl,
  sector: optionalText(80),
  stage: z.enum(crmStages),
  source: optionalText(80),
  owner_id: optionalUuid,
  notes: optionalText(10000),
  next_action: optionalText(300),
  next_action_date: optionalDate,
  estimated_value: optionalMoney,
});

export const interactionSchema = z.object({
  client_id: z.uuid(),
  kind: z.enum(interactionKinds),
  summary: requiredText(5000, "El resumen"),
  occurred_at: z.string().min(1, "Indica la fecha"),
});

export type ClientInput = z.input<typeof clientSchema>;
