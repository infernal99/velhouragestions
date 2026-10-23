import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Globe, Mail, Phone } from "lucide-react";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { InfoItem, InfoList, Panel } from "@/components/shared/info-list";
import { OptionBadge } from "@/components/shared/status-badge";
import { Comments } from "@/components/shared/comments";
import { FileList, type FileRow } from "@/components/files/file-list";
import { FileUploader } from "@/components/files/file-uploader";
import { ProgressBar } from "@/components/shared/progress-bar";
import { crmStageMap, projectStatusMapWith, quoteStatusMap, receivableStatusMap } from "@/lib/labels";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientActions } from "./client-actions";
import { Interactions } from "./interactions";
import { ClientNotes } from "./client-notes";
import type { Client, ClientInteraction, Project, Quote, ReceivableWithStatus } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Cliente" };
}

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle<Client>();
  if (!client) notFound();

  const finance = ctx.permissions.canViewFinances;
  const [interactions, projects, comments, files, quotes, receivables] = await Promise.all([
    supabase.from("client_interactions").select("*").eq("client_id", id).order("occurred_at", { ascending: false }).returns<ClientInteraction[]>(),
    supabase.from("projects").select("id, name, status, progress, due_date").eq("client_id", id).is("archived_at", null).order("created_at", { ascending: false }).returns<Pick<Project, "id" | "name" | "status" | "progress" | "due_date">[]>(),
    supabase.from("comments").select("id, body, author_id, created_at").eq("client_id", id).order("created_at"),
    supabase.from("files").select("id, name, mime_type, size_bytes, category, uploaded_by, created_at").eq("client_id", id).order("created_at", { ascending: false }).returns<FileRow[]>(),
    finance
      ? supabase.from("quotes").select("id, number, title, status, total, issue_date").eq("client_id", id).order("issue_date", { ascending: false }).returns<Pick<Quote, "id" | "number" | "title" | "status" | "total" | "issue_date">[]>()
      : Promise.resolve({ data: [] as Pick<Quote, "id" | "number" | "title" | "status" | "total" | "issue_date">[] }),
    finance
      ? supabase.from("receivables_with_status").select("*").eq("client_id", id).order("issue_date", { ascending: false }).returns<ReceivableWithStatus[]>()
      : Promise.resolve({ data: [] as ReceivableWithStatus[] }),
  ]);

  const owner = ctx.team.find((m) => m.id === client.owner_id);
  const totalInvoiced = (receivables.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = (receivables.data ?? []).reduce((s, r) => s + Number(r.amount_pending), 0);

  return (
    <>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Clientes
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <OptionBadge value={client.stage} map={crmStageMap} />
            {client.archived_at ? <span className="text-xs text-muted-foreground">Archivado</span> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.contact_name ? <span>{client.contact_name}</span> : null}
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {client.email}
              </a>
            ) : null}
            {client.phone ? (
              <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {client.phone}
              </a>
            ) : null}
            {client.website ? (
              <a href={client.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <Globe className="size-3.5" /> Web
              </a>
            ) : null}
          </div>
        </div>
        <ClientActions client={client} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Historial de comunicaciones" bodyClassName="p-0">
            <Interactions clientId={client.id} items={interactions.data ?? []} />
          </Panel>

          <Panel title="Proyectos" bodyClassName="p-0">
            {(projects.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin proyectos con este cliente.</p>
            ) : (
              <ul className="divide-y">
                {projects.data!.map((p) => (
                  <li key={p.id}>
                    <Link href={`/proyectos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <OptionBadge value={p.status} map={projectStatusMapWith(ctx.company.project_status_labels)} />
                      <ProgressBar value={p.progress} className="hidden w-24 sm:flex" />
                      <span className={cn("w-20 text-right text-xs text-muted-foreground", isOverdue(p.due_date, p.status === "entregado") && "text-destructive")}>
                        {formatDate(p.due_date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {finance ? (
            <Panel title="Presupuestos y cobros" bodyClassName="p-0">
              <div className="grid grid-cols-2 border-b text-sm">
                <div className="border-r px-4 py-3">
                  <p className="text-xs text-muted-foreground">Facturación registrada</p>
                  <p className="font-semibold tabular">{formatMoney(totalInvoiced, ctx.company.currency)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
                  <p className="font-semibold tabular">{formatMoney(totalPending, ctx.company.currency)}</p>
                </div>
              </div>
              <ul className="divide-y">
                {(quotes.data ?? []).map((q) => (
                  <li key={q.id}>
                    <Link href={`/finanzas/presupuestos/${q.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
                      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{q.number}</span>
                      <span className="min-w-0 flex-1 truncate">{q.title}</span>
                      <OptionBadge value={q.status} map={quoteStatusMap} />
                      <span className="w-24 text-right tabular">{formatMoney(q.total, ctx.company.currency)}</span>
                    </Link>
                  </li>
                ))}
                {(receivables.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">Cobro · {formatDate(r.issue_date)}</span>
                    <span className="min-w-0 flex-1 truncate">{r.concept}</span>
                    <OptionBadge value={r.status} map={receivableStatusMap} />
                    <span className="w-24 text-right tabular">{formatMoney(r.amount, ctx.company.currency)}</span>
                  </li>
                ))}
                {(quotes.data ?? []).length + (receivables.data ?? []).length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Sin presupuestos ni cobros.</li>
                ) : null}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Comentarios internos">
            <Comments target={{ client_id: client.id }} comments={comments.data ?? []} />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Seguimiento">
            {client.next_action || client.next_action_date ? (
              <div className="text-sm">
                <p className="font-medium">{client.next_action ?? "Seguimiento"}</p>
                <p className={cn("mt-0.5 text-muted-foreground", isOverdue(client.next_action_date) && "font-medium text-destructive")}>
                  {client.next_action_date ? formatDate(client.next_action_date, "EEEE d 'de' MMMM") : "Sin fecha"}
                  {isOverdue(client.next_action_date) ? " · atrasado" : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin próxima acción definida.</p>
            )}
          </Panel>
          <Panel title="Datos">
            <InfoList>
              <InfoItem label="Responsable">{owner ? owner.full_name || owner.email : "—"}</InfoItem>
              <InfoItem label="Origen">{client.source ?? "—"}</InfoItem>
              <InfoItem label="Valor estimado">
                {client.estimated_value != null ? formatMoney(client.estimated_value, ctx.company.currency) : "—"}
              </InfoItem>
              <InfoItem label="Razón social">{client.legal_name ?? "—"}</InfoItem>
              <InfoItem label="NIF / CIF">{client.tax_id ?? "—"}</InfoItem>
              <InfoItem label="Sector">{client.sector ?? "—"}</InfoItem>
              <InfoItem label="Dirección">{client.address ?? "—"}</InfoItem>
              <InfoItem label="Alta">{formatDate(client.created_at)}</InfoItem>
            </InfoList>
          </Panel>
          <Panel title="Notas internas">
            <ClientNotes clientId={client.id} initial={client.notes ?? ""} />
          </Panel>
          <Panel title="Documentos" className="min-w-0">
            <div className="flex flex-col gap-3">
              <FileUploader target={{ client_id: client.id }} defaultCategory="recurso_cliente" compact />
              <FileList files={files.data ?? []} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
