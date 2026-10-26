import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringView, type RecurringRow } from "./recurring-view";

export const metadata: Metadata = { title: "Pagos mensuales" };

export default async function RecurringPage() {
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const month = `${todayISO().slice(0, 7)}-01`;

  const [{ data }, { data: generated }] = await Promise.all([
    supabase
      .from("recurring_payments")
      .select("*, client:clients(name), project:projects(name)")
      .eq("company_id", ctx.company.id)
      .order("created_at")
      .returns<RecurringRow[]>(),
    supabase.from("receivables").select("recurring_id").eq("company_id", ctx.company.id).eq("recurring_period", month),
  ]);

  return (
    <>
      <PageHeader
        title="Pagos mensuales"
        description="Servicios que se cobran cada mes (redes sociales, mantenimiento…). Solo los activos suman en el total mensual."
      />
      <RecurringView
        rows={data ?? []}
        generatedIds={(generated ?? []).map((g) => g.recurring_id as string)}
        monthLabel={new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`))}
      />
    </>
  );
}
