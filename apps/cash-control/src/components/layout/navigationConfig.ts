import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeDollarSign,
  BellRing,
  Calculator,
  ChartColumn,
  Clock3,
  FileSearch,
  History,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UserCog,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import type { SystemRole } from "@/components/workstation/types";

export type NavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  enabled: boolean;
  roles: SystemRole[];
};

export type NavigationGroup = {
  label?: string;
  items: NavigationItem[];
};

/**
 * Configuración única de navegación del Sidebar.
 * Se filtra por rol en tiempo de render.
 * No duplicar arrays por rol: definir una vez y filtrar.
 */
export const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        label: "Centro de Control",
        href: "/",
        icon: LayoutDashboard,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Inicio",
        href: "/",
        icon: LayoutDashboard,
        enabled: true,
        roles: ["employee"],
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        label: "Depósitos",
        href: "/deposits",
        icon: ArrowDownToLine,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Retiros",
        href: "/withdrawals",
        icon: ArrowUpFromLine,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Retiros pendientes",
        href: "/pending-withdrawals",
        icon: Clock3,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Historial",
        href: "/history",
        icon: History,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Fondos del negocio",
        href: "/business-funds",
        icon: WalletCards,
        enabled: true,
        roles: ["employee"],
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        label: "Caja y bancos",
        href: "/balances",
        icon: Landmark,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Bancos y alertas",
        href: "/bank-alerts",
        icon: BellRing,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Turno actual",
        href: "/shifts",
        icon: UserRoundCheck,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Corte de caja",
        href: "/cash-closing",
        icon: Calculator,
        enabled: true,
        roles: ["owner", "employee"],
      },
      {
        label: "Auditoría",
        href: "/audit",
        icon: FileSearch,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Personal",
        href: "/staff",
        icon: Users,
        enabled: true,
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        label: "Usuarios",
        href: "/users",
        icon: UserCog,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Fondos del negocio",
        href: "/business-funds",
        icon: WalletCards,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Comisiones",
        href: "/commissions",
        icon: BadgeDollarSign,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Comprobantes",
        href: "/receipts",
        icon: ReceiptText,
        enabled: true,
        roles: ["owner"],
      },
      {
        label: "Configuración",
        href: "/settings",
        icon: Settings,
        enabled: true,
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      {
        label: "Ganancias y reportes",
        icon: ChartColumn,
        enabled: false,
        roles: ["owner"],
      },
    ],
  },
];

/**
 * Filtra la navegación por rol, conservando el orden y la estructura de grupos.
 * Un grupo sin items visibles para el rol se omite completamente.
 */
export function getNavigationForRole(role: SystemRole): NavigationGroup[] {
  const groups: NavigationGroup[] = [];
  for (const group of navigationGroups) {
    const items = group.items.filter((item) => item.roles.includes(role));
    if (items.length > 0) {
      groups.push({ label: group.label, items });
    }
  }
  return groups;
}
