"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { useActionForm } from "@/components/forms/use-action-form";
import { saveWebDetails } from "@/lib/actions/projects";
import { webDetailsSchema } from "@/lib/validation/projects";
import { webTypeOptions } from "@/lib/labels";
import { formatMoney } from "@/lib/format";
import type { WebDetails, WebStage } from "@/types/database";

export function WebDetailsForm({
  projectId,
  details,
  stages,
  finance,
}: {
  projectId: string;
  details: WebDetails | null;
  stages: WebStage[];
  finance: { invoiced: number; collected: number; currency: string } | null;
}) {
  const router = useRouter();
  const { form, onSubmit, pending } = useActionForm({
    schema: webDetailsSchema,
    defaultValues: {
      project_id: projectId,
      web_type: details?.web_type ?? "corporativa",
      stage_id: details?.stage_id ?? null,
      dev_url: details?.dev_url ?? "",
      production_url: details?.production_url ?? "",
      repository_url: details?.repository_url ?? "",
      domain: details?.domain ?? "",
      hosting_provider: details?.hosting_provider ?? "",
      domain_renewal_date: details?.domain_renewal_date ?? "",
      requirements: details?.requirements ?? "",
    },
    action: saveWebDetails,
    onSuccess: () => router.refresh(),
  });

  const urls = [
    { label: "Desarrollo", url: details?.dev_url },
    { label: "Producción", url: details?.production_url },
    { label: "Repositorio", url: details?.repository_url },
  ].filter((u) => u.url);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {urls.length || finance ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((u) => (
            <a
              key={u.label}
              href={u.url!}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              {u.label} <ExternalLink className="size-3" />
            </a>
          ))}
          {finance ? (
            <span className="ml-auto inline-flex items-center gap-3 rounded-md bg-muted px-2.5 py-1 text-xs">
              <span>
                Facturado <strong className="tabular">{formatMoney(finance.invoiced, finance.currency)}</strong>
              </span>
              <span>
                Cobrado <strong className="tabular">{formatMoney(finance.collected, finance.currency)}</strong>
              </span>
              <span>
                Pendiente <strong className="tabular">{formatMoney(finance.invoiced - finance.collected, finance.currency)}</strong>
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField form={form} name="web_type" label="Tipo de web" options={webTypeOptions.map((o) => ({ value: o.value, label: o.label }))} />
        <SelectField
          form={form}
          name="stage_id"
          label="Etapa"
          allowEmpty
          emptyLabel="Sin etapa"
          options={stages.map((s) => ({ value: s.id, label: s.name }))}
        />
        <TextField form={form} name="dev_url" label="URL de desarrollo" placeholder="https://" />
        <TextField form={form} name="production_url" label="URL de producción" placeholder="https://" />
        <TextField form={form} name="repository_url" label="Repositorio de GitHub" placeholder="https://github.com/…" />
        <TextField form={form} name="domain" label="Dominio" placeholder="cliente.com" />
        <TextField form={form} name="hosting_provider" label="Alojamiento" placeholder="Vercel, Hostinger…" />
        <TextField form={form} name="domain_renewal_date" label="Renovación del dominio" type="date" />
      </div>
      <TextareaField form={form} name="requirements" label="Requisitos del cliente" rows={5} placeholder="Objetivos, secciones, funcionalidades, referencias…" />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar ficha
        </Button>
      </div>
    </form>
  );
}
