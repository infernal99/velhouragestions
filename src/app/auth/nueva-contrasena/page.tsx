"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { newPasswordSchema } from "@/lib/validation/auth";
import { updatePassword } from "@/lib/actions/auth";

export default function NewPasswordPage() {
  const { form, onSubmit, pending } = useActionForm({
    schema: newPasswordSchema,
    defaultValues: { password: "", confirm: "" },
    action: updatePassword,
  });

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Nueva contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Elige una contraseña segura.</p>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <TextField form={form} name="password" label="Contraseña" type="password" autoComplete="new-password" />
          <TextField form={form} name="confirm" label="Repite la contraseña" type="password" autoComplete="new-password" />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
