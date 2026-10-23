import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, derivePermissions, type Capability, type Permissions } from "@/lib/permissions";
import type { Company, Membership, Profile } from "@/types/database";

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  role: Membership["role"];
}

export interface AppContext {
  userId: string;
  profile: Profile;
  company: Company;
  membership: Membership;
  permissions: Permissions;
  companies: Pick<Company, "id" | "name">[];
  team: TeamMember[];
}

/** The signed-in user id, or null. Cached per request. */
export const getUserId = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims.sub as string | undefined) ?? null;
});

/**
 * Loads the user, their active company and their permissions in it.
 * Returns null when there is no session or no company yet.
 */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single<Profile>(),
    supabase
      .from("memberships")
      .select("*, company:companies(*)")
      .eq("user_id", userId)
      .order("created_at")
      .returns<(Membership & { company: Company })[]>(),
  ]);

  if (!profile || !memberships || memberships.length === 0) return null;

  const active = memberships.find((m) => m.company_id === profile.active_company_id) ?? memberships[0];

  const { data: teamRows } = await supabase
    .from("memberships")
    .select("role, profile:profiles(id, full_name, email, avatar_url, job_title)")
    .eq("company_id", active.company_id)
    .returns<{ role: Membership["role"]; profile: Omit<TeamMember, "role"> }[]>();

  const team = (teamRows ?? [])
    .filter((row) => row.profile)
    .map((row) => ({ ...row.profile, role: row.role }))
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "es"));

  const { company, ...membership } = active;

  return {
    userId,
    profile,
    company,
    membership,
    permissions: derivePermissions(membership),
    companies: memberships.map((m) => ({ id: m.company.id, name: m.company.name })),
    team,
  };
});

/** For pages: redirects to login / onboarding when there's no context. */
export async function requireContext(): Promise<AppContext> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** For pages that need a capability: renders the 403 page otherwise. */
export async function requireCapability(capability: Capability): Promise<AppContext> {
  const ctx = await requireContext();
  if (!can(ctx.permissions, capability)) forbidden();
  return ctx;
}
