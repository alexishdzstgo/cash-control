import type { BankAccountBalance } from "@/types/balance";
import { BankAccountCard } from "./BankAccountCard";

type BankAccountsListProps = {
  accounts: BankAccountBalance[];
  onViewReserved: (account: BankAccountBalance) => void;
};

export function BankAccountsList({
  accounts,
  onViewReserved,
}: BankAccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <LandmarkIcon className="h-6 w-6 text-slate-400" />
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
          Consulta el saldo real, reservado y disponible de
          cada cuenta.
        </p>
      </div>

      <div className="space-y-4">
        {accounts.map((account) => (
          <BankAccountCard
            key={account.id}
            account={account}
            onViewReserved={onViewReserved}
          />
        ))}
      </div>
    </section>
  );
}

function LandmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V7l-8-4" />
      <path d="M9 21V9" />
      <path d="M15 21V9" />
    </svg>
  );
}