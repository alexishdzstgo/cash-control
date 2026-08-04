"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  getNavigationForRole,
  type NavigationItem,
} from "./navigationConfig";

const SIDEBAR_STORAGE_KEY = "cash-control:sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { authenticatedUser } = useMockSession();
  const [collapsed, setCollapsed] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      // localStorage no disponible
    }
    setHasHydrated(true);
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

  const role = authenticatedUser?.systemRole ?? "employee";
  const groups = getNavigationForRole(role);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-[#0F172A] text-slate-100 ${
        hasHydrated
          ? "transition-[width] duration-[240ms] ease-in-out"
          : "transition-none"
      } ${collapsed ? "w-20" : "w-[272px]"}`}
      style={{ borderRight: "1px solid #334155" }}
    >
      {/* Encabezado: monograma + título + botón de contraer (siempre en una fila) */}
      <div
        className={`flex min-h-[64px] flex-nowrap items-center overflow-hidden border-b border-slate-800 ${
          collapsed ? "justify-center gap-0 px-2 py-4" : "justify-between gap-3 px-4 py-4"
        }`}
      >
        {!collapsed && (
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#3B82F6] bg-[#1E40AF]"
          >
            <span className="text-sm font-bold text-white">CE</span>
          </div>
        )}

        <div
          className={`min-w-0 flex-1 overflow-hidden transition-all duration-200 ease-in-out ${
            collapsed
              ? "pointer-events-none max-w-0 opacity-0 delay-0 translate-x-[6px]"
              : "max-w-full opacity-100 delay-100 translate-x-0"
          }`}
        >
          <h2 className="truncate whitespace-nowrap text-sm font-semibold tracking-tight text-slate-50">
            Control de efectivo
          </h2>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-blue-300 transition-all duration-150 hover:scale-105 hover:border-slate-600 hover:bg-blue-900 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navegación */}
      <nav className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-5">
        <ul className="space-y-6">
          {groups.map((group, groupIndex) => (
            <li key={groupIndex}>
              {group.label && !collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item, itemIndex) => (
                  <SidebarNavItem
                    key={`${groupIndex}-${itemIndex}`}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SidebarNavItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  // Elemento deshabilitado: sin navegación, aria-disabled, "Próximamente" solo en expandido
  if (!item.enabled) {
    return (
      <li>
        <div
          title={collapsed ? `${item.label} — Próximamente` : undefined}
          aria-disabled="true"
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-600 ${
            collapsed ? "justify-center opacity-60" : "opacity-70"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
          <span
            className={`flex-1 truncate whitespace-nowrap transition-all duration-200 ease-in-out ${
              collapsed
                ? "pointer-events-none max-w-0 opacity-0 delay-0 translate-x-[6px]"
                : "max-w-full opacity-100 delay-100 translate-x-0"
            }`}
          >
            {item.label}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-all duration-200 ease-in-out ${
              collapsed
                ? "pointer-events-none max-w-0 opacity-0 delay-0 translate-x-[6px]"
                : "max-w-full opacity-100 delay-100 translate-x-0"
            }`}
          >
            Próximamente
          </span>
        </div>
      </li>
    );
  }

  const href = item.href ?? "/";
  const isActive =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <li>
      <Link
        href={href}
        title={collapsed ? item.label : undefined}
        className={`relative flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150 ${
          collapsed ? "justify-center" : ""
        } ${
          isActive
            ? "bg-[#1E40AF] text-white"
            : "text-slate-300 hover:bg-[#1E293B] hover:text-[#F8FAFC]"
        }`}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#3B82F6]"
            aria-hidden="true"
          />
        )}
        <Icon
          className={`h-4 w-4 shrink-0 ${
            isActive ? "text-white" : "text-slate-400"
          }`}
        />
        <span
          className={`truncate whitespace-nowrap transition-all duration-200 ease-in-out ${
            collapsed
              ? "pointer-events-none max-w-0 opacity-0 delay-0 translate-x-[6px]"
              : "max-w-full opacity-100 delay-100 translate-x-0"
          }`}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}
