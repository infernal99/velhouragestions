"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { loginSchema } from "@/lib/validation/auth";
import { signIn } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    action: (values) => signIn(values, next),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <TextField form={form} name="email" label="Correo electrónico" type="email" autoComplete="email" autoFocus />
      <TextField form={form} name="password" label="Contraseña" type="password" autoComplete="current-password" />
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Entrar
      </Button>
    </form>
  );
}
