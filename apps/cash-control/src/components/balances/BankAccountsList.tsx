import { AlertTriangle, Landmark, Eye, Pencil, EyeOff, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { BankAccountBalance, BalanceStatus } from "@/types/balance";

type BankAccountsListProps = {
  accounts: BankAccountBalance[];
  onViewReserved: (account: BankAccountBalance) => void;
  onEdit: (account: BankAccountBalance) => void;
  onToggleStatus: (account: BankAccountBalance) => void;
  onDelete: (account: BankAccountBalance) => void;
};

const statusConfig: Record<
  BalanceStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  available: {
    label: "Activa",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
  low: {
    label: "Saldo bajo",
    dotClass: "bg-amber-400",
    textClass: "text-amber-700",
  },
  unavailable: {
    label: "Inactiva",
    dotClass: "bg-red-400",
    textClass: "text-red-700",
  },
  inconsistent: {
    label: "Revisión requerida",
    dotClass: "bg-orange-400",
    textClass: "text-orange-700",
  },
};

export function BankAccountsList({
  accounts,
  onViewReserved,
  onEdit,
  onToggleStatus,
  onDelete
}: BankAccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Landmark className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">
          Sin cuentas
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          No hay cuentas bancarias disponibles.
        </p>
        <p className="text-sm text-slate-500">
          Solicita al administrador que configure una cuenta.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Cuentas bancarias
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Consulta el saldo real, reservado y disponible de cada cuenta.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3 text-right">Saldo real</th>
                <th className="px-4 py-3 text-right">Reservado</th>
                <th className="px-4 py-3 text-right">Disponible</th>
                <th className="px-4 py-3 w-32 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const reservedBalance = account.reservedOperations.reduce(
                  (sum, op) => sum + op.amount,
                  0,
                );
                const availableBalance = account.realBalance - reservedBalance;
                const status = statusConfig[account.status];

                return (
                  <tr key={account.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Landmark className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <span className="font-semibold text-slate-900">
                          {account.bankName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs">
                      {account.accountName}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency(account.realBalance)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums text-amber-700">
                          {formatCurrency(reservedBalance)}
                        </span>
                        {reservedBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => onViewReserved(account)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                          >
                            <Eye className="h-3 w-3" />
                            Ver pendientes
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold tabular-nums ${availableBalance <= 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatCurrency(availableBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-4 w-32 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.textClass} bg-white ring-1 ring-inset ring-slate-200`}
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                          aria-hidden="true"
                        />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit(account)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          aria-label={`Editar ${account.bankName}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(account)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          aria-label={`Activar o desactivar ${account.bankName}`}
                          title={account.status === "available" ? "Desactivar cuenta" : "Activar cuenta"}
                        >
                          {account.status === "available" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(account)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                          aria-label={`Eliminar ${account.bankName}`}
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="divide-y divide-slate-100 lg:hidden">
          {accounts.map((account) => {
            const reservedBalance = account.reservedOperations.reduce(
              (sum, op) => sum + op.amount,
              0,
            );
            const availableBalance = account.realBalance - reservedBalance;
            const status = statusConfig[account.status];

            return (
              <div key={account.id} className="p-4 sm:p-6 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
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
                      <p className="font-mono text-xs text-slate-500 mt-0.5">
                        {account.accountName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(account)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      aria-label={`Editar ${account.bankName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(account)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      aria-label={`Activar o desactivar ${account.bankName}`}
                    >
                      {account.status === "available" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(account)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                      aria-label={`Eliminar ${account.bankName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 grid-cols-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Real
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(account.realBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Reservado
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-700 tabular-nums">
                      {formatCurrency(reservedBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Disponible
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold tabular-nums ${availableBalance <= 0 ? "text-red-600" : "text-emerald-700"}`}
                    >
                      {formatCurrency(availableBalance)}
                    </p>
                  </div>
                </div>

                {reservedBalance > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {account.reservedOperations.length}
                      </span>{" "}
                      pendientes
                    </p>
                    <button
                      type="button"
                      onClick={() => onViewReserved(account)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Ver
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}