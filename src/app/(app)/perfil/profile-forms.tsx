"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/info-list";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ImageUpload } from "@/components/shared/image-upload";
import { TextField } from "@/components/forms/fields";
import { runAction, useActionForm } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { profileSchema } from "@/lib/validation/settings";
import { newPasswordSchema } from "@/lib/validation/auth";
import { setAvatarUrl, updateProfile } from "@/lib/actions/team";
import { updatePassword } from "@/lib/actions/auth";

export function ProfileForms({
  profile,
  role,
}: {
  profile: { full_name: string; email: string; job_title: string | null; phone: string | null; avatar_url: string | null };
  role: "admin" | "member";
}) {
  const router = useRouter();
  const { userId } = useApp();
  const { form, onSubmit, pending } = useActionForm({
    schema: profileSchema,
    defaultValues: { full_name: profile.full_name, job_title: profile.job_title ?? "", phone: profile.phone ?? "" },
    action: updateProfile,
    onSuccess: () => router.refresh(),
  });
  const pw = useActionForm({
    schema: newPasswordSchema,
    defaultValues: { password: "", confirm: "" },
    action: (v) => updatePassword(v, true),
    onSuccess: () => pw.form.reset({ password: "", confirm: "" }),
  });

  return (
    <div className="grid max-w-3xl gap-5">
      <Panel title="Foto">
        <div className="flex items-center gap-4">
          <UserAvatar name={profile.full_name || profile.email} src={profile.avatar_url} size="xl" />
          <div className="flex flex-wrap gap-2">
            <ImageUpload
              folder={`avatars/${userId}`}
              label="Cambiar foto"
              onUploaded={async (url) => {
                const res = await runAction(setAvatarUrl(url));
                if (res.ok) router.refresh();
              }}
            />
            {profile.avatar_url ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const res = await runAction(setAvatarUrl(null));
                  if (res.ok) router.refresh();
                }}
              >
                Quitar
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>
      <Panel title="Datos personales">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField form={form} name="full_name" label="Nombre completo" required />
          <TextField form={form} name="job_title" label="Puesto" placeholder="Diseñador, desarrollador…" />
          <TextField form={form} name="phone" label="Teléfono" type="tel" />
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Correo y rol</span>
            <p className="flex h-8 items-center text-sm text-muted-foreground">
              {profile.email} · {role === "admin" ? "Administrador" : "Miembro"}
            </p>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Cambiar contraseña">
        <form onSubmit={pw.onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField form={pw.form} name="password" label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." />
          <TextField form={pw.form} name="confirm" label="Repite la contraseña" type="password" autoComplete="new-password" />
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="outline" disabled={pw.pending}>
              {pw.pending ? <Loader2 className="animate-spin" /> : null}
              Actualizar contraseña
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
