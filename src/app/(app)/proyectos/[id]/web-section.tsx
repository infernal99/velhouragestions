import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/shared/info-list";
import { WebDetailsForm } from "./web-details-form";
import { WebRequests } from "./web-requests";
import { WebChecklist } from "./web-checklist";
import { SecretRefs } from "./secret-refs";
import type { ChecklistItem, SecretReference, WebDetails, WebRequest, WebStage } from "@/types/database";

export async function WebSection({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [details, stages, requests, checklist, secrets, finance] = await Promise.all([
    supabase.from("web_details").select("*").eq("project_id", projectId).maybeSingle<WebDetails>(),
    supabase.from("web_stages").select("*").eq("company_id", ctx.company.id).order("position").returns<WebStage[]>(),
    supabase.from("web_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).returns<WebRequest[]>(),
    supabase.from("web_checklist_items").select("id, label, done, position").eq("project_id", projectId).order("position").returns<ChecklistItem[]>(),
    supabase.from("secret_references").select("*").eq("project_id", projectId).order("created_at").returns<SecretReference[]>(),
    ctx.permissions.canViewFinances
      ? supabase.from("receivables").select("amount, amount_paid").eq("project_id", projectId)
      : Promise.resolve({ data: null }),
  ]);

  const invoiced = (finance.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const collected = (finance.data ?? []).reduce((s, r) => s + Number(r.amount_paid), 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="Ficha de la web">
          <WebDetailsForm
            projectId={projectId}
            details={details.data}
            stages={stages.data ?? []}
            finance={finance.data ? { invoiced, collected, currency: ctx.company.currency } : null}
          />
        </Panel>
        <Panel title="Cambios solicitados y problemas pendientes" bodyClassName="p-0">
          <WebRequests projectId={projectId} requests={requests.data ?? []} />
        </Panel>
      </div>
      <div className="flex flex-col gap-5">
        <Panel title="Checklist antes de entregar">
          <WebChecklist projectId={projectId} items={checklist.data ?? []} />
        </Panel>
        <Panel title="Accesos y credenciales">
          <SecretRefs projectId={projectId} items={secrets.data ?? []} canManage={canManage} />
        </Panel>
      </div>
    </div>
  );
}
