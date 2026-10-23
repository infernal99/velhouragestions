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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requires?: Capability;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Inicio", icon: Home },
      { href: "/tareas", label: "Tareas", icon: CheckSquare },
      { href: "/calendario", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
      { href: "/webs", label: "Webs en desarrollo", icon: Globe },
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/documentos", label: "Documentos", icon: FileText },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/finanzas", label: "Resumen", icon: Wallet, requires: "finances" },
      { href: "/finanzas/presupuestos", label: "Presupuestos", icon: FileText, requires: "finances" },
      { href: "/finanzas/cobros", label: "Cobros", icon: Receipt, requires: "finances" },
      { href: "/finanzas/gastos", label: "Gastos", icon: Receipt, requires: "finances" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { href: "/equipo", label: "Equipo", icon: Users },
      { href: "/actividad", label: "Actividad", icon: Activity },
      { href: "/ajustes", label: "Ajustes", icon: Settings, requires: "settings" },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/finanzas") return pathname === "/finanzas";
  return pathname === href || pathname.startsWith(`${href}/`);
}
