import type { MemberRole } from "@/types/database";

// Mirror of the database rules (private.is_admin, private.can_view_finances,
// private.can_manage_clients). These decide what the UI offers and are
// re-checked in server actions; RLS remains the final authority.

export interface Permissions {
  role: MemberRole;
  isAdmin: boolean;
  canViewFinances: boolean;
  canManageClients: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
}

export function derivePermissions(membership: {
  role: MemberRole;
  can_view_finances: boolean;
  can_manage_clients: boolean;
}): Permissions {
  const isAdmin = membership.role === "admin";
  return {
    role: membership.role,
    isAdmin,
    canViewFinances: isAdmin || membership.can_view_finances,
    canManageClients: isAdmin || membership.can_manage_clients,
    canManageTeam: isAdmin,
    canManageSettings: isAdmin,
  };
}

export type Capability = "finances" | "clients:manage" | "team" | "settings";

export function can(permissions: Permissions, capability: Capability) {
  switch (capability) {
    case "finances":
      return permissions.canViewFinances;
    case "clients:manage":
      return permissions.canManageClients;
    case "team":
      return permissions.canManageTeam;
    case "settings":
      return permissions.canManageSettings;
  }
}

/** Project-level management: admins, or the project's owner. */
export function canManageProject(permissions: Permissions, userId: string, project: { owner_id: string | null }) {
  return permissions.isAdmin || project.owner_id === userId;
}
