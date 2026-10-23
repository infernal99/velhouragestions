"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { companySchema } from "@/lib/validation/auth";
import { createCompany } from "@/lib/actions/auth";

export function OnboardingForm() {
  const { form, onSubmit, pending } = useActionForm({
    schema: companySchema,
    defaultValues: { name: "" },
    action: createCompany,
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <TextField form={form} name="name" label="Nombre de la empresa" placeholder="Mi empresa" autoFocus />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Crear empresa
      </Button>
    </form>
  );
}
