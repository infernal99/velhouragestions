import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClientsView } from "./clients-view";
import { NewClientButton } from "./new-client-button";
import type { Client } from "@/types/database";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const ctx = await requireContext();
  const { vista, archivados } = await searchParams;
  const showArchived = archivados === "1";
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("*, projects(count)")
    .eq("company_id", ctx.company.id)
    .order("updated_at", { ascending: false })
    .limit(1000);
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data } = await query.returns<(Client & { projects: { count: number }[] })[]>();

  const clients = (data ?? []).map((c) => ({ ...c, project_count: c.projects?.[0]?.count ?? 0 }));

  return (
    <>
      <PageHeader
        title="Clientes"
        description="CRM y embudo comercial de la empresa."
        actions={<NewClientButton />}
      />
      <ClientsView clients={clients} view={vista === "lista" ? "lista" : "embudo"} showArchived={showArchived} />
    </>
  );
}
