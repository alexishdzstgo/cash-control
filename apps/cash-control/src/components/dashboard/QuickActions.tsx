"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  History,
  Lock,
  WalletCards,
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
    title: "Nuevo movimiento de fondos",
    description: "Ingreso o retiro del negocio",
    href: "/business-funds",
    icon: WalletCards,
  },
  {
    title: "Historial",
    description: "Buscar operación",
    href: "/history",
    icon: History,
  },
];

export function QuickActions() {
  const { hasActiveParticipation, authenticatedUser } = useMockSession();
  const userHasActiveParticipation = authenticatedUser
    ? hasActiveParticipation(authenticatedUser.userId)
    : false;

  if (!userHasActiveParticipation) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Acciones rápidas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Accede a las tareas más utilizadas.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600">
            Activa tu participación para registrar operaciones. Puedes hacerlo
            desde el menú de usuario en la parte superior derecha.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Acciones rápidas
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Accede a las tareas más utilizadas.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>
    </section>
  );
}
