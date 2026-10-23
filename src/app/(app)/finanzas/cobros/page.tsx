import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import type { ReceivableRow } from "@/components/finance/receivables-table";
import { ReceivablesView } from "./receivables-view";

export const metadata: Metadata = { title: "Cobros" };

export default async function ReceivablesPage() {
  const ctx = await requireCapability("finances");
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables_with_status")
    .select("*, client:clients(name), project:projects(name)")
    .eq("company_id", ctx.company.id)
    .order("issue_date", { ascending: false })
    .limit(2000)
    .returns<ReceivableRow[]>();

  return (
    <>
      <PageHeader
        title="Ingresos y cobros"
        description="Registra lo que te deben y cada pago recibido. Los pagos parciales se suman automáticamente."
      />
      <ReceivablesView rows={data ?? []} />
    </>
  );
}
