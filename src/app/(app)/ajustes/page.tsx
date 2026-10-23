import type { Metadata } from "next";
import Link from "next/link";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TabLinks } from "@/components/shared/tab-links";
import { Panel } from "@/components/shared/info-list";
import { CompanyForm, BrandingForm, RegionalForm } from "./company-forms";
import { ProjectSettingsForm, WebStagesForm } from "./project-forms";
import { CategoriesForm } from "./categories-form";
import { PreferencesForm } from "./preferences-form";
import type { ExpenseCategory, WebStage } from "@/types/database";

export const metadata: Metadata = { title: "Ajustes" };

const TABS = [
  { value: "empresa", label: "Empresa" },
  { value: "proyectos", label: "Proyectos y webs" },
  { value: "gastos", label: "Categorías de gastos" },
  { value: "notificaciones", label: "Notificaciones y privacidad" },
  { value: "equipo", label: "Miembros y permisos" },
];

export default async function SettingsPage({ searchParams }: PageProps<"/ajustes">) {
  const ctx = await requireCapability("settings");
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t.value === raw) ? (raw as string) : "empresa";
  const supabase = await createClient();
  const co = ctx.company;

  return (
    <>
      <PageHeader title="Ajustes" description="Configuración de la empresa. Solo los administradores pueden modificarla." />
      <TabLinks tabs={TABS} current={tab} basePath="/ajustes" />

      {tab === "empresa" ? (
        <div className="grid max-w-4xl gap-5">
          <Panel title="Identidad">
            <BrandingForm companyId={co.id} name={co.name} logoUrl={co.logo_url} color={co.primary_color} />
          </Panel>
          <Panel title="Datos comerciales">
            <CompanyForm company={co} />
          </Panel>
          <Panel title="Moneda, fechas e impuestos">
            <RegionalForm company={co} />
          </Panel>
        </div>
      ) : null}

      {tab === "proyectos" ? <ProjectsTab companyId={co.id} types={co.project_types} labels={co.project_status_labels} /> : null}

      {tab === "gastos" ? <CategoriesTab companyId={co.id} /> : null}

      {tab === "notificaciones" ? (
        <div className="max-w-3xl">
          <PreferencesForm preferences={co.preferences} />
        </div>
      ) : null}

      {tab === "equipo" ? (
        <Panel className="max-w-3xl">
          <p className="text-sm text-muted-foreground">
            Los miembros, sus roles y permisos (acceso a finanzas y gestión de clientes) se gestionan en{" "}
            <Link href="/equipo" className="font-medium text-foreground underline">
              Equipo
            </Link>
            . Desde allí también puedes invitar a nuevas personas.
          </p>
        </Panel>
      ) : null}
    </>
  );

  async function ProjectsTab({ companyId, types, labels }: { companyId: string; types: string[]; labels: Record<string, string> }) {
    const { data: stages } = await supabase.from("web_stages").select("*").eq("company_id", companyId).order("position").returns<WebStage[]>();
    return (
      <div className="grid max-w-4xl gap-5">
        <Panel title="Tipos de proyecto y nombres de estado">
          <ProjectSettingsForm types={types} labels={labels} />
        </Panel>
        <Panel title="Etapas de las webs en desarrollo">
          <WebStagesForm stages={stages ?? []} />
        </Panel>
      </div>
    );
  }

  async function CategoriesTab({ companyId }: { companyId: string }) {
    const { data } = await supabase.from("expense_categories").select("*").eq("company_id", companyId).order("name").returns<ExpenseCategory[]>();
    return (
      <Panel title="Categorías de gastos" className="max-w-3xl">
        <CategoriesForm categories={data ?? []} />
      </Panel>
    );
  }
}
