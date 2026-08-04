import { AlertTriangle, Clock3 } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { mockOperations } from "@/components/history/mockOperations";

export function HealthAlerts() {
  const pendingWithdrawals = mockOperations.filter(
    (operation) => operation.type === "retiro" && operation.status === "pendiente",
  );

  const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
    (total, operation) => total + operation.amount,
    0,
  );

  if (pendingWithdrawals.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div>
            <p className="font-semibold text-amber-900">
              Tienes {pendingWithdrawals.length}{" "}
              {pendingWithdrawals.length === 1 ? "retiro pendiente" : "retiros pendientes"}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {formatCurrency(pendingWithdrawalsAmount)} por entregar.
            </p>
          </div>
        </div>

        <Link
          href="/pending-withdrawals"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
        >
          <Clock3 className="h-4 w-4" />
          Ver retiros pendientes
        </Link>
      </div>
    </section>
  );
}