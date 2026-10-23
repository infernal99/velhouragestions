"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext, run } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { inviteSchema, memberUpdateSchema, profileSchema } from "@/lib/validation/settings";
import { getAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";

export async function inviteMember(input: unknown): Promise<ActionResult<{ link: string; emailSent: boolean }>> {
  return run(async () => {
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("team");
    const email = parsed.data.email.toLowerCase();
    if (ctx.team.some((m) => m.email.toLowerCase() === email)) return fail("Esta persona ya es miembro de la empresa.");

    // Only the hash is stored; the raw token travels in the link.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await ctx.supabase.from("invitations").insert({
      company_id: ctx.company.id,
      email,
      role: parsed.data.role,
      token_hash: tokenHash,
      invited_by: ctx.userId,
    });
    if (error) {
      if (error.code === "23505") return fail("Ya hay una invitación pendiente para este correo. Revócala para enviar otra.");
      return fromDbError(error);
    }

    const link = `${siteUrl()}/invitacion/${token}`;
    let emailSent = false;
    // Email delivery needs the server-only service role key (Supabase Auth's
    // invite email). Without it the admin shares the link manually.
    const admin = getAdminClient();
    if (admin) {
      const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(`/invitacion/${token}`)}`,
        data: { invited_to: ctx.company.name },
      });
      emailSent = !mailError;
    }

    revalidatePath("/equipo");
    return ok(
      { link, emailSent },
      emailSent ? "Invitación enviada por correo" : "Invitación creada. Copia el enlace y compártelo con la persona invitada.",
    );
  });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext("team");
    const { error } = await ctx.supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("accepted_at", null);
    if (error) return fromDbError(error);
    revalidatePath("/equipo");
    return ok(undefined, "Invitación revocada");
  });
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = memberUpdateSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext("team");
    const { user_id, ...values } = parsed.data;
    const { error, count } = await ctx.supabase
      .from("memberships")
      .update(values, { count: "exact" })
      .eq("company_id", ctx.company.id)
      .eq("user_id", user_id);
    if (error) return fromDbError(error);
    if (!count) return fail("Miembro no encontrado.");
    revalidatePath("/equipo");
    return ok(undefined, "Permisos actualizados");
  });
}

export async function removeMember(userId: string): Promise<ActionResult> {
  return run(async () => {
    if (!z.uuid().safeParse(userId).success) return fail("Miembro no válido.");
    const ctx = await actionContext();
    if (userId !== ctx.userId && !ctx.permissions.isAdmin) return fail("No tienes permiso para realizar esta acción.");
    const { error, count } = await ctx.supabase
      .from("memberships")
      .delete({ count: "exact" })
      .eq("company_id", ctx.company.id)
      .eq("user_id", userId);
    if (error) return fromDbError(error);
    if (!count) return fail("No se pudo quitar al miembro.");
    revalidatePath("/equipo");
    return ok(undefined, userId === ctx.userId ? "Has salido de la empresa" : "Miembro eliminado de la empresa");
  });
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);
    const ctx = await actionContext();
    const { error } = await ctx.supabase.from("profiles").update(parsed.data).eq("id", ctx.userId);
    if (error) return fromDbError(error);
    revalidatePath("/", "layout");
    return ok(undefined, "Perfil actualizado");
  });
}

export async function setAvatarUrl(url: string | null): Promise<ActionResult> {
  return run(async () => {
    const ctx = await actionContext();
    // only accept files from our own public bucket, under this user's folder
    if (url && !url.includes(`/storage/v1/object/public/public-assets/avatars/${ctx.userId}/`)) {
      return fail("Imagen no válida.");
    }
    const { error } = await ctx.supabase.from("profiles").update({ avatar_url: url }).eq("id", ctx.userId);
    if (error) return fromDbError(error);
    revalidatePath("/", "layout");
    return ok(undefined, url ? "Foto actualizada" : "Foto eliminada");
  });
}
