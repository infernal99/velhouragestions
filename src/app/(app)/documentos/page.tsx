import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentsView, type DocRow } from "./documents-view";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documentos">) {
  const ctx = await requireContext();
  const { archivo } = await searchParams;
  const supabase = await createClient();
  // RLS returns only the files this user may open (finance receipts only with finance access).
  const { data } = await supabase
    .from("files")
    .select("id, name, mime_type, size_bytes, category, uploaded_by, created_at, project_id, client_id, project:projects(name), client:clients(name)")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<DocRow[]>();

  return (
    <>
      <PageHeader title="Documentos" description="Briefings, diseños, contratos, documentación técnica y recursos de clientes, organizados por cliente y proyecto." />
      <DocumentsView files={data ?? []} highlight={typeof archivo === "string" ? archivo : null} />
    </>
  );
}
