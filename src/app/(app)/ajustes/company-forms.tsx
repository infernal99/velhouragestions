"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, SelectField, TextField } from "@/components/forms/fields";
import { runAction, useActionForm } from "@/components/forms/use-action-form";
import { CompanyMark } from "@/components/shell/company-mark";
import { ImageUpload } from "@/components/shared/image-upload";
import { companyProfileSchema, regionalSchema } from "@/lib/validation/settings";
import { saveBranding, saveCompanyProfile, saveRegional, setCompanyLogo } from "@/lib/actions/settings";
import type { Company } from "@/types/database";

function SaveButton({ pending, label = "Guardar" }: { pending: boolean; label?: string }) {
  return (
    <div className="flex justify-end sm:col-span-2">
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

export function BrandingForm({ companyId, name, logoUrl, color }: { companyId: string; name: string; logoUrl: string | null; color: string }) {
  const router = useRouter();
  const [value, setValue] = useState(color);
  const [saving, setSaving] = useState(false);
  const presets = ["#4f46e5", "#0f766e", "#2563eb", "#db2777", "#ea580c", "#18181b", "#7c3aed", "#059669"];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FormField label="Logotipo" hint="PNG, JPG, WebP o SVG · máx. 2 MB. Se usa en la barra lateral y en los presupuestos.">
        <div className="flex items-center gap-3">
          <CompanyMark name={name} logoUrl={logoUrl} className="size-12 text-base" />
          <ImageUpload
            folder={`logos/${companyId}`}
            label={logoUrl ? "Cambiar" : "Subir logotipo"}
            onUploaded={async (url) => {
              const res = await runAction(setCompanyLogo(url));
              if (res.ok) router.refresh();
            }}
          />
          {logoUrl ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const res = await runAction(setCompanyLogo(null));
                if (res.ok) router.refresh();
              }}
            >
              Quitar
            </Button>
          ) : null}
        </div>
      </FormField>
      <FormField label="Color principal" hint="Se aplica a botones, enlaces activos y gráficos.">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue(p)}
              aria-label={`Usar ${p}`}
              className="size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow"
              style={{ backgroundColor: p, boxShadow: value === p ? `0 0 0 2px var(--background), 0 0 0 4px ${p}` : undefined }}
            />
          ))}
          <Input type="color" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-12 cursor-pointer p-1" aria-label="Color personalizado" />
          <Button
            size="sm"
            disabled={saving || value === color}
            onClick={async () => {
              setSaving(true);
              const res = await runAction(saveBranding({ primary_color: value }));
              setSaving(false);
              if (res.ok) router.refresh();
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            Aplicar
          </Button>
        </div>
      </FormField>
    </div>
  );
}

export function CompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const { form, onSubmit, pending } = useActionForm({
    schema: companyProfileSchema,
    defaultValues: {
      name: company.name,
      legal_name: company.legal_name ?? "",
      tax_id: company.tax_id ?? "",
      address: company.address ?? "",
      city: company.city ?? "",
      postal_code: company.postal_code ?? "",
      country: company.country ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      website: company.website ?? "",
    },
    action: saveCompanyProfile,
    onSuccess: () => router.refresh(),
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextField form={form} name="name" label="Nombre de la empresa" required hint="Es el nombre que se muestra en toda la aplicación." />
      <TextField form={form} name="legal_name" label="Razón social" />
      <TextField form={form} name="tax_id" label="NIF / CIF" />
      <TextField form={form} name="email" label="Correo de contacto" type="email" />
      <TextField form={form} name="phone" label="Teléfono" />
      <TextField form={form} name="website" label="Web" placeholder="https://" />
      <TextField form={form} name="address" label="Dirección" className="sm:col-span-2" />
      <TextField form={form} name="postal_code" label="Código postal" />
      <TextField form={form} name="city" label="Ciudad" />
      <TextField form={form} name="country" label="País" />
      <SaveButton pending={pending} />
    </form>
  );
}

export function RegionalForm({ company }: { company: Company }) {
  const router = useRouter();
  const { form, onSubmit, pending } = useActionForm({
    schema: regionalSchema,
    defaultValues: {
      currency: company.currency,
      date_format: company.date_format as "dd/MM/yyyy",
      default_tax_rate: String(company.default_tax_rate).replace(".", ","),
      quote_prefix: company.quote_prefix,
    },
    action: saveRegional,
    onSuccess: () => router.refresh(),
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <SelectField
        form={form}
        name="currency"
        label="Moneda"
        options={[
          { value: "EUR", label: "Euro (€)" },
          { value: "USD", label: "Dólar estadounidense ($)" },
          { value: "GBP", label: "Libra esterlina (£)" },
        ]}
      />
      <SelectField
        form={form}
        name="date_format"
        label="Formato de fecha en documentos"
        options={[
          { value: "dd/MM/yyyy", label: "23/10/2026" },
          { value: "d MMM yyyy", label: "23 oct 2026" },
          { value: "yyyy-MM-dd", label: "2026-10-23" },
        ]}
      />
      <TextField form={form} name="default_tax_rate" label="IVA por defecto (%)" inputMode="decimal" hint="Se propone en las nuevas líneas de presupuesto." />
      <TextField form={form} name="quote_prefix" label="Prefijo de presupuestos" hint={`Ejemplo: ${company.quote_prefix}-2026-0001`} />
      <SaveButton pending={pending} />
    </form>
  );
}
