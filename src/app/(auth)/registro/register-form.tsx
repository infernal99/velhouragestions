"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { registerSchema } from "@/lib/validation/auth";
import { signUp } from "@/lib/actions/auth";

export function RegisterForm({ next }: { next?: string }) {
  const [sent, setSent] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: registerSchema,
    defaultValues: { fullName: "", email: "", password: "" },
    action: (values) => signUp(values, next),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MailCheck className="size-8 text-brand" />
        <p className="font-medium">Revisa tu correo</p>
        <p className="text-sm text-muted-foreground">
          Te hemos enviado un enlace para confirmar la cuenta a <strong>{form.getValues("email") as string}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <TextField form={form} name="fullName" label="Nombre completo" autoComplete="name" autoFocus />
      <TextField form={form} name="email" label="Correo electrónico" type="email" autoComplete="email" />
      <TextField
        form={form}
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 10 caracteres, con letras y números."
      />
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Crear cuenta
      </Button>
    </form>
  );
}
