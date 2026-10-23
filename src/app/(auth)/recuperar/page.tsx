"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { forgotSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: forgotSchema,
    defaultValues: { email: "" },
    action: requestPasswordReset,
    onSuccess: () => setDone(true),
  });

  return (
    <>
      <h1 className="text-lg font-semibold">Recuperar contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
      {done ? (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          Si existe una cuenta con ese correo, recibirás el enlace en unos minutos.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <TextField form={form} name="email" label="Correo electrónico" type="email" autoComplete="email" autoFocus />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Enviar enlace
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
