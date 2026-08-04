"use client";

import {
  ArrowRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Clock3,
  History,
  Lock,
  ShieldCheck,
  UserCog,
  Settings,
  Landmark,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import Link from "next/link";
import { useMockSession } from "@/components/session/MockSessionContext";

const quickActions = [
  {
    title: "Nuevo depósito",
    description: "Registrar depósito",
    href: "/deposits",
    icon: ArrowDownToLine,
  },
  {
    title: "Nuevo retiro",
    description: "Registrar retiro",
    href: "/withdrawals",
    icon: ArrowUpFromLine,
  },
  {
    title: "Retiros pendientes",
    description: "Entregar operaciones",
    href: "/pending-withdrawals",
    icon: Clock3,
  },
  {
    title: "Buscar operación",
    description: "Historial",
    href: "/history",
    icon: History,
  },
];

const adminActions = [
  {
    title: "Revisar cierre",
    description: "Revisar corte de caja",
    href: "/cash-closing",
    icon: ShieldCheck,
    enabled: true,
  },
  {
    title: "Registrar ingreso administrativo",
    description: "Se habilitará en la siguiente fase",
    href: null as string | null,
    icon: PlusCircle,
    enabled: false,
  },
  {
    title: "Registrar retiro administrativo",
    description: "Se habilitará en la siguiente fase",
    href: null as string | null,
    icon: MinusCircle,
    enabled: false,
  },
  {
    title: "Configurar comisiones",
    description: "Pendiente de configurar",
    href: null as string | null,
    icon: Settings,
    enabled: false,
  },
  {
    title: "Administrar bancos",
    description: "Se habilitará en la siguiente fase",
    href: null as string | null,
    icon: Landmark,
    enabled: false,
  },
];

export function OwnerQuickActions() {
  const { hasActiveParticipation, authenticatedUser } = useMockSession();
  const userHasActiveParticipation = authenticatedUser
    ? hasActiveParticipation(authenticatedUser.userId)
    : false;

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Acciones rápidas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Operaciones y tareas más utilizadas.
          </p>
        </div>

        {!userHasActiveParticipation ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Lock className="h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-600">
              Activa tu participación para registrar operaciones. Puedes hacerlo
              desde el menú de usuario en la parte superior derecha.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {action.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Acciones administrativas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Control y gestión del negocio.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {adminActions.map((action) => {
            const Icon = action.icon;

            if (action.enabled) {
              return (
                <Link
                  key={action.title}
                  href={action.href!}
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] transition-colors group-hover:bg-[#DBEAFE]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {action.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </Link>
              );
            }

            return (
              <div
                key={action.title}
                title={action.description}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3.5 opacity-80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-500">
                    {action.title}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {action.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Próximamente
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}