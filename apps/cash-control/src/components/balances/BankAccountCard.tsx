import { Landmark, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { BankAccountBalance, BalanceStatus } from "@/types/balance";

type BankAccountCardProps = {
  account: BankAccountBalance;
  onViewReserved: (account: BankAccountBalance) => void;
};

const statusConfig: Record<
  BalanceStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  available: {
    label: "Disponible",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
  low: {
    label: "Saldo bajo",
    dotClass: "bg-amber-400",
    textClass: "text-amber-700",
  },
  unavailable: {
    label: "Sin disponibilidad",
    dotClass: "bg-red-400",
    textClass: "text-red-700",
  },
  inconsistent: {
    label: "Revisión requerida",
    dotClass: "bg-orange-400",
    textClass: "text-orange-700",
  },
};

export function BankAccountCard({
  account,
  onViewReserved,
}: BankAccountCardProps) {
  const reservedBalance = account.reservedOperations.reduce(
    (sum, op) => sum + op.amount,
    0
  );
  const availableBalance =
    account.realBalance - reservedBalance;
  const operationCount = account.reservedOperations.length;
  const status = statusConfig[account.status];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {account.bankName}
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.textClass} bg-white ring-1 ring-inset ring-slate-200`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                  aria-hidden="true"
                />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {account.accountName}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Saldo real
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
            {formatCurrency(account.realBalance)}
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
              Comprometido en depósitos pendientes
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Disponible
          </p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              availableBalance <= 0
                ? "text-red-600"
                : "text-emerald-700"
            }`}
          >
            {formatCurrency(availableBalance)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        {operationCount > 0 ? (
          <>
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                {operationCount}
              </span>{" "}
              {operationCount === 1
                ? "depósito pendiente"
                : "depósitos pendientes"}
            </p>
            <button
              type="button"
              onClick={() => onViewReserved(account)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Ver depósitos pendientes
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Sin fondos reservados
          </p>
        )}
      </div>
    </div>
  );
}