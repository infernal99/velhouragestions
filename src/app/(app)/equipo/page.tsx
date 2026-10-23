import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TeamView, type MemberRow } from "./team-view";
import type { Invitation, Membership } from "@/types/database";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: memberships }, { data: tasks }, invitations] = await Promise.all([
    supabase
      .from("memberships")
      .select("*, profile:profiles(id, full_name, email, avatar_url, job_title, phone)")
      .eq("company_id", ctx.company.id)
      .returns<(Membership & { profile: MemberRow["profile"] })[]>(),
    // workload: open tasks the current user can see, grouped by assignee
    supabase.from("tasks").select("assignee_id, due_date, status").eq("company_id", ctx.company.id).neq("status", "completada"),
    ctx.permissions.canManageTeam
      ? supabase
          .from("invitations")
          .select("*")
          .eq("company_id", ctx.company.id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .returns<Invitation[]>()
      : Promise.resolve({ data: [] as Invitation[] }),
  ]);

  const load = new Map<string, { open: number; overdue: number; today: number }>();
  for (const t of tasks ?? []) {
    if (!t.assignee_id) continue;
    const l = load.get(t.assignee_id as string) ?? { open: 0, overdue: 0, today: 0 };
    l.open++;
    if (t.due_date && (t.due_date as string) < today) l.overdue++;
    if (t.due_date === today) l.today++;
    load.set(t.assignee_id as string, l);
  }

  const members: MemberRow[] = (memberships ?? [])
    .filter((m) => m.profile)
    .map((m) => ({ ...m, load: load.get(m.user_id) ?? { open: 0, overdue: 0, today: 0 } }))
    .sort((a, b) => (a.role === b.role ? (a.profile.full_name || "").localeCompare(b.profile.full_name || "", "es") : a.role === "admin" ? -1 : 1));

  return (
    <>
      <PageHeader title="Equipo" description="Miembros de la empresa, permisos y carga de trabajo." />
      <TeamView members={members} invitations={invitations.data ?? []} />
    </>
  );
}
