import {
  ArrowRight,
  ArrowUpFromLine,
  Clock3,
  History,
} from "lucide-react";
import Link from "next/link";

const quickActions = [
  {
    title: "Nuevo retiro",
    description:
      "Registrar la entrega de efectivo al cliente.",
    href: "/withdrawals",
    icon: ArrowUpFromLine,
    accentClass:
      "bg-withdrawal-600",
    iconClass:
      "bg-withdrawal-100 text-withdrawal-700",
    hoverClass:
      "hover:border-withdrawal-200 hover:bg-withdrawal-50/30",
  },
  {
    title: "Retiros pendientes",
    description:
      "Consultar retiros cuyo efectivo todavía no ha sido entregado.",
    href: "/pending-withdrawals",
    icon: Clock3,
    accentClass: "bg-pending-600",
    iconClass:
      "bg-pending-100 text-pending-700",
    hoverClass:
      "hover:border-pending-200 hover:bg-pending-50/30",
  },
  {
    title: "Historial de operaciones",
    description:
      "Buscar depósitos y retiros registrados.",
    href: "/history",
    icon: History,
    accentClass: "bg-slate-600",
    iconClass:
      "bg-slate-100 text-slate-700",
    hoverClass:
      "hover:border-slate-300 hover:bg-slate-50",
  },
];

export function QuickActions() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Acciones rápidas
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Accede a las operaciones más
          utilizadas del sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${action.hoverClass}`}
            >
              <span
                className={`absolute left-0 top-1/2 h-12 w-1 -translate-y-1/2 rounded-r-full ${action.accentClass}`}
              />

              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.iconClass}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500" />
              </div>

              <p className="mt-5 text-lg font-semibold text-slate-900">
                {action.title}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}