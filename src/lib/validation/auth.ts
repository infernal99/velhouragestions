import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Introduce un correo válido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});

const password = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-z]/, "Incluye al menos una letra")
  .regex(/\d/, "Incluye al menos un número");

export const forgotSchema = z.object({ email: z.email("Introduce un correo válido") });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export const companySchema = z.object({
  name: z.string().trim().min(1, "Introduce el nombre de la empresa").max(120),
});

export type LoginInput = z.infer<typeof loginSchema>;
