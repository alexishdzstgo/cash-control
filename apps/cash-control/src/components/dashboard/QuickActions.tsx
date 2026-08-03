import {
  ArrowRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Clock3,
  History,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useMockSession } from "@/components/session/MockSessionContext";

const quickActions = [
  {
    title: "Nuevo depósito",
    description: "Registrar un depósito y controlar su entrega.",
    href: "/deposits",
    icon: ArrowDownToLine,
  },
  {
    title: "Nuevo retiro",
    description: "Registrar la entrega de efectivo al cliente.",
    href: "/withdrawals",
    icon: ArrowUpFromLine,
  },
  {
    title: "Retiros pendientes",
    description: "Consultar retiros cuyo efectivo todavía no ha sido entregado.",
    href: "/pending-withdrawals",
    icon: Clock3,
  },
  {
    title: "Historial de operaciones",
    description: "Buscar depósitos y retiros registrados.",
    href: "/history",
    icon: History,
  },
];

export function QuickActions() {
  const { hasActiveParticipation, authenticatedUser } = useMockSession();
  const userHasActiveParticipation = authenticatedUser ? hasActiveParticipation(authenticatedUser.userId) : false;

  if (!userHasActiveParticipation) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Acciones rápidas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Accede a las operaciones más utilizadas del sistema.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <Lock className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 font-medium text-slate-600">
            Acceso restringido
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Inicia tu participación para acceder a las acciones rápidas.
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
          Accede a las operaciones más utilizadas del sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-primary-soft group-hover:text-brand-primary">
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {action.title}
                </p>

                <p className="mt-0.5 text-sm leading-5 text-slate-500">
                  {action.description}
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}