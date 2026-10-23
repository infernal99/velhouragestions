"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { run } from "@/lib/actions/guard";
import { companySchema, forgotSchema, loginSchema, newPasswordSchema, registerSchema } from "@/lib/validation/auth";
import { siteUrl } from "@/lib/env";

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : siteUrl();
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return fail("Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.");
    return fail("Correo o contraseña incorrectos.");
  }
  redirect(safeNext(next));
}

export async function signUp(input: unknown, next?: string): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const base = await origin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${base}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("Ya existe una cuenta con este correo.");
    if (error.code === "signup_disabled") return fail("El registro está desactivado. Pide una invitación a un administrador.");
    return fail("No se pudo crear la cuenta. Inténtalo de nuevo.");
  }
  if (data.session) redirect(safeNext(next));
  return ok({ needsConfirmation: true });
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const base = await origin();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${base}/auth/callback?next=/auth/nueva-contrasena`,
  });
  // Same answer whether or not the account exists (no account enumeration).
  return ok(undefined, "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
}

export async function updatePassword(input: unknown, stay = false): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("No se pudo actualizar la contraseña. El enlace puede haber caducado.");
  if (stay) return ok(undefined, "Contraseña actualizada");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCompany(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = companySchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_company", { p_name: parsed.data.name });
    if (error) return fromDbError(error, "No se pudo crear la empresa.");
    redirect("/");
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  return run(async () => {
    if (!token || token.length > 200) return fail("Invitación no válida.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) return fromDbError(error, "No se pudo aceptar la invitación.");
    redirect("/");
  });
}
