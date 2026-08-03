"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Clock3,
  Gauge,
  History,
  Landmark,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationGroups = [
  {
    label: null,
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: Gauge,
        enabled: true,
      },
    ],
  },
  {
    label: "Dinero",
    items: [
      {
        label: "Caja y bancos",
        href: "/balances",
        icon: Landmark,
        enabled: true,
      },
      {
        label: "Historial",
        href: "/history",
        icon: History,
        enabled: true,
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      {
        label: "Retiros",
        href: "/withdrawals",
        icon: ArrowUpFromLine,
        enabled: true,
      },
      {
        label: "Retiros pendientes",
        href: "/pending-withdrawals",
        icon: Clock3,
        enabled: true,
      },
      {
        label: "Depósitos",
        href: "/deposits",
        icon: ArrowDownToLine,
        enabled: true,
      },
    ],
  },
  {
    label: "Turno",
    items: [
      {
        label: "Turnos",
        href: "/shifts",
        icon: Users,
        enabled: true,
      },
      {
        label: "Corte de caja",
        href: "/cash-closing",
        icon: Building2,
        enabled: true,
      },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Configuración",
        href: "/settings",
        icon: Settings,
        enabled: false,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-stone-800 bg-stone-900 text-white">
      <div className="flex items-center gap-3 border-b border-stone-800 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary">
          <span className="text-sm font-bold">CC</span>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Cash Control
          </h2>
          <p className="text-xs text-stone-400">
            Xolobit
          </p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-6">
          {navigationGroups.map((group, groupIndex) => (
            <li key={groupIndex}>
              {group.label && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  {group.label}
                </p>
              )}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (!item.enabled) {
                    return (
                      <li key={item.href}>
                        <div
                          title="Disponible próximamente"
                          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600"
                        >
                          <Icon className="h-4 w-4 shrink-0" />

                          <span className="flex-1">
                            {item.label}
                          </span>

                          <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Próximamente
                          </span>
                        </div>
                      </li>
                    );
                  }

                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(
                          `${item.href}/`,
                        );

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? "bg-brand-primary text-white"
                            : "text-stone-300 hover:bg-stone-800 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />

                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}