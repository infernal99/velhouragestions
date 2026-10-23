"use client";

import { createContext, useContext } from "react";
import type { Permissions } from "@/lib/permissions";
import type { TeamMember } from "@/lib/auth/context";
import { projectStatusMapWith } from "@/lib/labels";
import type { ProjectStatus } from "@/types/database";

export interface ClientAppContext {
  userId: string;
  userName: string;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
    currency: string;
    projectTypes: string[];
    defaultTaxRate: number;
    statusLabels: Partial<Record<ProjectStatus, string>>;
  };
  permissions: Permissions;
  team: TeamMember[];
  companies: { id: string; name: string }[];
}

const AppContext = createContext<ClientAppContext | null>(null);

export function AppProvider({ value, children }: { value: ClientAppContext; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** UI-only view of the session (permissions are re-checked on the server). */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Project status options/labels including the company's custom names. */
export function useProjectStatus() {
  const { company } = useApp();
  const map = projectStatusMapWith(company.statusLabels);
  return { map, options: Object.values(map) };
}

export function useMemberName() {
  const { team } = useApp();
  return (id: string | null | undefined) => {
    if (!id) return null;
    const m = team.find((t) => t.id === id);
    return m ? m.full_name || m.email : "Antiguo miembro";
  };
}
