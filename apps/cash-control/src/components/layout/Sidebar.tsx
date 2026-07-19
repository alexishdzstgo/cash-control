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

const navigationItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: Gauge,
    enabled: true,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
  {
    label: "Retiros",
    href: "/withdrawals",
    icon: ArrowUpFromLine,
    enabled: true,
    activeClass:
      "bg-withdrawal-600 text-white shadow-sm",
  },
  {
    label: "Retiros pendientes",
    href: "/pending-withdrawals",
    icon: Clock3,
    enabled: true,
    activeClass:
      "bg-pending-600 text-white shadow-sm",
  },
  {
    label: "Depósitos",
    href: "/deposits",
    icon: ArrowDownToLine,
    enabled: false,
    activeClass:
      "bg-deposit-600 text-white shadow-sm",
  },
  {
    label: "Bancos",
    href: "/banks",
    icon: Landmark,
    enabled: false,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
  {
    label: "Corte de caja",
    href: "/cash-closing",
    icon: Building2,
    enabled: false,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
  {
    label: "Turnos",
    href: "/shifts",
    icon: Users,
    enabled: false,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
  {
    label: "Historial",
    href: "/history",
    icon: History,
    enabled: true,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
  {
    label: "Configuración",
    href: "/settings",
    icon: Settings,
    enabled: false,
    activeClass:
      "bg-slate-700 text-white shadow-sm",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-white">
      <div className="border-b border-slate-800 p-6">
        <h2 className="text-lg font-bold">
          Xolobit
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Cash Control
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <div
                    title="Disponible próximamente"
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600"
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    <span className="flex-1">
                      {item.label}
                    </span>

                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? item.activeClass
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />

                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}