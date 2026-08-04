import { Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CashBalance } from "@/types/balance";

type CashBalanceCardProps = {
  cash: CashBalance;
  onViewReserved: () => void;
};

export function CashBalanceCard({
  cash,
  onViewReserved,
}: CashBalanceCardProps) {
  const reservedBalance = cash.reservedOperations.reduce(
    (sum, op) => sum + op.amount,
    0,
  );
  const available = cash.physicalBalance - reservedBalance;
  const withdrawalCount = cash.reservedOperations.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Banknote className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-500">
            Efectivo en caja
          </h3>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Saldo físico
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
            {formatCurrency(cash.physicalBalance)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Reservado
          </p>
          <p className="mt-1 text-lg font-semibold text-amber-700 tabular-nums">
            {formatCurrency(reservedBalance)}
          </p>
          {reservedBalance > 0 && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              Comprometido en retiros pendientes
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Disponible
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-700 tabular-nums">
            {formatCurrency(available)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>
          Turno actual:{" "}
          <span className="font-medium text-slate-700">
            {cash.shiftName}
          </span>
        </span>
        <span>
          Responsable:{" "}
          <span className="font-medium text-slate-700">
            {cash.responsibleName}
          </span>
        </span>
        <span>
          Última actualización:{" "}
          <span className="font-medium text-slate-700">
            {cash.updatedAt}
          </span>
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        {withdrawalCount > 0 ? (
          <>
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                {withdrawalCount}
              </span>{" "}
              {withdrawalCount === 1 ? "retiro pendiente" : "retiros pendientes"}
            </p>
            <button
              type="button"
              onClick={onViewReserved}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Ver retiros pendientes
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400">Sin fondos reservados</p>
        )}
      </div>
    </div>
  );
}