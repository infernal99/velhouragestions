import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { toCsv, type CsvValue } from "@/lib/csv";
import {
  crmStageMap,
  priorityMap,
  projectStatusMapWith,
  projectTypeLabel,
  quoteStatusMap,
  receivableStatusMap,
  taskStatusMap,
} from "@/lib/labels";
import type { CrmStage, Priority, ProjectStatus, QuoteStatus, ReceivableStatus, TaskStatus } from "@/types/database";

const FINANCE = new Set(["cobros", "pagos", "gastos", "presupuestos"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * CSV exports. Runs with the user's own session, so RLS decides which rows
 * are included; finance exports additionally require finance access.
 */
export async function GET(request: NextRequest, ctxRoute: RouteContext<"/api/exportar/[tipo]">) {
  const { tipo } = await ctxRoute.params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (FINANCE.has(tipo) && !ctx.permissions.canViewFinances) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("desde");
  const to = request.nextUrl.searchParams.get("hasta");
  const range = from && to && DATE.test(from) && DATE.test(to) ? { from, to } : null;
  const supabase = await createClient();
  const name = (k: string | null | undefined) => (k ? (ctx.team.find((m) => m.id === k)?.full_name ?? "") : "");

  let headers: string[] = [];
  let rows: CsvValue[][] = [];

  switch (tipo) {
    case "cobros": {
      let q = supabase
        .from("receivables_with_status")
        .select("*, client:clients(name), project:projects(name)")
        .eq("company_id", ctx.company.id)
        .order("issue_date");
      if (range) q = q.gte("issue_date", range.from).lte("issue_date", range.to);
      const { data } = await q;
      headers = ["Fecha", "Concepto", "Cliente", "Proyecto", "Referencia", "Vencimiento", "Importe", "Cobrado", "Pendiente", "Estado"];
      rows = (data ?? []).map((r) => [
        r.issue_date,
        r.concept,
        r.client?.name,
        r.project?.name,
        r.reference,
        r.due_date,
        Number(r.amount),
        Number(r.amount_paid),
        Number(r.amount_pending),
        receivableStatusMap[r.status as ReceivableStatus]?.label,
      ]);
      break;
    }
    case "pagos": {
      let q = supabase
        .from("payments")
        .select("*, receivable:receivables(concept)")
        .eq("company_id", ctx.company.id)
        .order("paid_at");
      if (range) q = q.gte("paid_at", range.from).lte("paid_at", range.to);
      const { data } = await q;
      headers = ["Fecha", "Cobro", "Importe", "Método", "Referencia"];
      rows = (data ?? []).map((p) => [p.paid_at, p.receivable?.concept, Number(p.amount), p.method, p.reference]);
      break;
    }
    case "gastos": {
      let q = supabase
        .from("expenses")
        .select("*, category:expense_categories(name), project:projects(name)")
        .eq("company_id", ctx.company.id)
        .order("expense_date");
      if (range) q = q.gte("expense_date", range.from).lte("expense_date", range.to);
      const { data } = await q;
      headers = ["Fecha", "Concepto", "Categoría", "Proveedor", "Proyecto", "Base", "Impuestos", "Total"];
      rows = (data ?? []).map((e) => [
        e.expense_date,
        e.concept,
        e.category?.name,
        e.supplier,
        e.project?.name,
        Number(e.amount),
        Number(e.tax_amount),
        Number(e.amount) + Number(e.tax_amount),
      ]);
      break;
    }
    case "presupuestos": {
      const { data } = await supabase
        .from("quotes")
        .select("*, client:clients(name)")
        .eq("company_id", ctx.company.id)
        .order("issue_date");
      headers = ["Número", "Fecha", "Título", "Cliente", "Estado", "Base", "Impuestos", "Total"];
      rows = (data ?? []).map((q) => [
        q.number,
        q.issue_date,
        q.title,
        q.client?.name,
        quoteStatusMap[q.status as QuoteStatus]?.label,
        Number(q.subtotal) - Number(q.discount_total),
        Number(q.tax_total),
        Number(q.total),
      ]);
      break;
    }
    case "clientes": {
      const { data } = await supabase.from("clients").select("*").eq("company_id", ctx.company.id).order("name");
      headers = ["Nombre", "Contacto", "Correo", "Teléfono", "Estado", "Origen", "Responsable", "Próxima acción", "Seguimiento"];
      rows = (data ?? []).map((c) => [
        c.name,
        c.contact_name,
        c.email,
        c.phone,
        crmStageMap[c.stage as CrmStage]?.label,
        c.source,
        name(c.owner_id),
        c.next_action,
        c.next_action_date,
      ]);
      break;
    }
    case "proyectos": {
      const { data } = await supabase
        .from("projects")
        .select("*, client:clients(name)")
        .eq("company_id", ctx.company.id)
        .order("created_at");
      headers = ["Proyecto", "Cliente", "Tipo", "Estado", "Prioridad", "Responsable", "Inicio", "Fecha límite", "Progreso %", "Presupuesto"];
      rows = (data ?? []).map((p) => [
        p.name,
        p.client?.name,
        projectTypeLabel(p.type),
        projectStatusMapWith(ctx.company.project_status_labels)[p.status as ProjectStatus]?.label,
        priorityMap[p.priority as Priority]?.label,
        name(p.owner_id),
        p.start_date,
        p.due_date,
        p.progress,
        ctx.permissions.canViewFinances && p.budget != null ? Number(p.budget) : null,
      ]);
      break;
    }
    case "tareas": {
      const { data } = await supabase
        .from("tasks")
        .select("*, project:projects(name)")
        .eq("company_id", ctx.company.id)
        .order("created_at");
      headers = ["Tarea", "Proyecto", "Estado", "Prioridad", "Responsable", "Fecha límite", "Etiquetas", "Completada"];
      rows = (data ?? []).map((t) => [
        t.title,
        t.project?.name,
        taskStatusMap[t.status as TaskStatus]?.label,
        priorityMap[t.priority as Priority]?.label,
        name(t.assignee_id),
        t.due_date,
        (t.labels as string[]).join(", "),
        t.completed_at?.slice(0, 10),
      ]);
      break;
    }
    default:
      return NextResponse.json({ error: "Exportación no disponible" }, { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
