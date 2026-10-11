"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  History,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMockSession } from "@/components/session/MockSessionContext";
import { ACTION_BUTTON_CARD_CLASSES } from "@/components/shared/actionButtonStyles";
import { useShift } from "@/components/shifts/ShiftContext";

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
  const { currentShift } = useShift();
  const { hasActiveParticipation, authenticatedUser } = useMockSession();
  const userHasActiveParticipation = authenticatedUser
    ? hasActiveParticipation(authenticatedUser.userId)
    : false;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Acciones rápidas
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Accede a las tareas más utilizadas.
        </p>
      </div>

      {!currentShift && (
        <p className="mb-3 text-sm text-slate-500">
          Inicia un turno para registrar operaciones.
        </p>
      )}
      {!userHasActiveParticipation && (
        <p className="mb-3 text-sm text-slate-500">
          Activa tu participación para registrar operaciones.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          const disabled =
            action.href !== "/history" &&
            (!userHasActiveParticipation || currentShift?.status !== "open");
          const content = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-primary-blue-soft group-hover:text-primary-blue">
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
            </>
          );
          return disabled ? (
            <div
              key={action.href}
              aria-disabled="true"
              className={ACTION_BUTTON_CARD_CLASSES.disabled}
            >
              {content}
            </div>
          ) : (
            <Link
              key={action.href}
              href={action.href}
              className={ACTION_BUTTON_CARD_CLASSES.interactive}
            >
              <span
                className={ACTION_BUTTON_CARD_CLASSES.leftIndicator}
                aria-hidden="true"
              />
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
