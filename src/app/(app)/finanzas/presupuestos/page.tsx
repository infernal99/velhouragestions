import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { QuotesView, type QuoteRow } from "./quotes-view";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function QuotesPage() {
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("id, number, title, status, total, issue_date, valid_until, project_id, client:clients(name)")
    .eq("company_id", ctx.company.id)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(1000)
    .returns<QuoteRow[]>();

  return (
    <>
      <PageHeader title="Presupuestos" description="Ofertas a clientes. Un presupuesto nunca cuenta como ingreso hasta que se registra y se cobra." />
      <QuotesView rows={data ?? []} />
    </>
  );
}
