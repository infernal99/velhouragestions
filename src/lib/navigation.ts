import {
  Building2,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  Globe,
  Home,
  Receipt,
  Settings,
  Users,
  Wallet,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/permissions";
import type { Accent } from "@/lib/accents";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  requires?: Capability;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Inicio", icon: Home, accent: "brand" },
      { href: "/tareas", label: "Tareas", icon: CheckSquare, accent: "sky" },
      { href: "/calendario", label: "Calendario", icon: CalendarDays, accent: "rose" },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { href: "/proyectos", label: "Proyectos", icon: FolderKanban, accent: "violet" },
      { href: "/webs", label: "Webs en desarrollo", icon: Globe, accent: "teal" },
      { href: "/clientes", label: "Clientes", icon: Building2, accent: "orange" },
      { href: "/documentos", label: "Documentos", icon: FileText, accent: "amber" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/finanzas", label: "Resumen", icon: Wallet, accent: "emerald", requires: "finances" },
      { href: "/finanzas/presupuestos", label: "Presupuestos", icon: FileText, accent: "emerald", requires: "finances" },
      { href: "/finanzas/cobros", label: "Cobros", icon: Receipt, accent: "emerald", requires: "finances" },
      { href: "/finanzas/gastos", label: "Gastos", icon: Receipt, accent: "rose", requires: "finances" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { href: "/equipo", label: "Equipo", icon: Users, accent: "sky" },
      { href: "/actividad", label: "Actividad", icon: Activity, accent: "violet" },
      { href: "/ajustes", label: "Ajustes", icon: Settings, accent: "brand", requires: "settings" },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/finanzas") return pathname === "/finanzas";
  return pathname === href || pathname.startsWith(`${href}/`);
}
