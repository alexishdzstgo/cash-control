"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Gauge,
  History,
  Landmark,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SIDEBAR_STORAGE_KEY = "cash-control:sidebar-collapsed";

const navigationGroups = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/", icon: Gauge, enabled: true },
    ],
  },
  {
    label: "Dinero",
    items: [
      { label: "Caja y bancos", href: "/balances", icon: Landmark, enabled: true },
      { label: "Historial", href: "/history", icon: History, enabled: true },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { label: "Retiros", href: "/withdrawals", icon: ArrowUpFromLine, enabled: true },
      { label: "Retiros pendientes", href: "/pending-withdrawals", icon: Clock3, enabled: true },
      { label: "Depósitos", href: "/deposits", icon: ArrowDownToLine, enabled: true },
    ],
  },
  {
    label: "Turno",
    items: [
      { label: "Turnos", href: "/shifts", icon: Users, enabled: true },
      { label: "Corte de caja", href: "/cash-closing", icon: Building2, enabled: true },
    ],
  },
  {
    label: null,
    items: [
      { label: "Configuración", href: "/settings", icon: Settings, enabled: false },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      // localStorage no disponible
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage no disponible
      }
      return next;
    });
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-[#0F172A] text-slate-100 transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-[272px]"
      }`}
      style={{ borderRight: "1px solid #334155" }}
    >
      <div className={`flex items-center border-b border-slate-800 px-4 py-5 ${collapsed ? "justify-center" : "gap-3"}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]">
          <span className="text-sm font-bold text-white">CC</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-slate-50">Cash Control</h2>
            <p className="truncate text-xs text-slate-400">Xolobit</p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-6">
          {navigationGroups.map((group, groupIndex) => (
            <li key={groupIndex}>
              {group.label && !collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  if (!item.enabled) {
                    return (
                      <li key={item.href}>
                        <div title="Disponible próximamente" className="flex cursor-not-allowed items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!collapsed && (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Próximamente</span>
                          )}
                        </div>
                      </li>
                    );
                  }
                  const isActive =
                    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors duration-150 ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-[#2563EB] text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir panel" : "Contraer panel"}
          aria-label={collapsed ? "Expandir panel" : "Contraer panel"}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Contraer</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}