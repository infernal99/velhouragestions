import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { NewProjectButton } from "../proyectos/new-project-button";
import { WebsView, type WebRow } from "./webs-view";
import type { WebStage } from "@/types/database";

export const metadata: Metadata = { title: "Webs en desarrollo" };

export default async function WebsPage({ searchParams }: PageProps<"/webs">) {
  const ctx = await requireContext();
  const { vista } = await searchParams;
  const supabase = await createClient();

  const [{ data: projects }, { data: stages }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, priority, due_date, progress, budget, owner_id, client:clients(id, name), web_details(*), web_requests(status), web_checklist_items(done)",
      )
      .eq("company_id", ctx.company.id)
      .eq("type", "web")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<Omit<WebRow, "invoiced" | "collected">[]>(),
    supabase.from("web_stages").select("*").eq("company_id", ctx.company.id).order("position").returns<WebStage[]>(),
  ]);

  // Money per web, only for people who can see finances (RLS returns nothing otherwise).
  const money = new Map<string, { invoiced: number; collected: number }>();
  if (ctx.permissions.canViewFinances && projects?.length) {
    const { data: rec } = await supabase
      .from("receivables")
      .select("project_id, amount, amount_paid")
      .in(
        "project_id",
        projects.map((p) => p.id),
      );
    for (const r of rec ?? []) {
      const m = money.get(r.project_id as string) ?? { invoiced: 0, collected: 0 };
      m.invoiced += Number(r.amount);
      m.collected += Number(r.amount_paid);
      money.set(r.project_id as string, m);
    }
  }

  const rows: WebRow[] = (projects ?? []).map((p) => ({
    ...p,
    invoiced: money.get(p.id)?.invoiced ?? null,
    collected: money.get(p.id)?.collected ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Webs en desarrollo"
        description="Seguimiento de cada web: etapa, entregas, cobros, cambios del cliente y checklist de entrega."
        actions={<NewProjectButton defaults={{ type: "web", status: "planificado" }} label="Nueva web" />}
      />
      <WebsView webs={rows} stages={stages ?? []} view={vista === "fichas" || vista === "tabla" ? vista : "etapas"} />
    </>
  );
}
