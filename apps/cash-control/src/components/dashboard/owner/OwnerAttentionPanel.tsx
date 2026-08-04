"use client";

import { Clock3, Pencil, AlertTriangle, ArrowRight, AlertOctagon } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { computeFinancialTotals, computeBankMovementAlerts } from "@/lib/finance";
import { mockOperations } from "@/components/history/mockOperations";
import { editedOperations } from "./ownerDashboardMockData";

export function OwnerAttentionPanel() {
  const totals = computeFinancialTotals();
  const bankAlerts = computeBankMovementAlerts();

  const pendingWithdrawals = mockOperations.filter(
    (operation) => operation.type === "retiro" && operation.status === "pendiente",
  );
  const pendingDeposits = mockOperations.filter(
    (operation) => operation.type === "deposito" && operation.status === "pendiente",
  );
  const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
    (sum, op) => sum + op.amount,
    0,
  );
  const pendingDepositsAmount = pendingDeposits.reduce((sum, op) => sum + op.amount, 0);

  const items: Array<{
    id: string;
    icon: typeof Clock3;
    iconClass: string;
    title: string;
    detail: string;
    href: string;
  }> = [];

  if (pendingWithdrawals.length > 0) {
    items.push({
      id: "withdrawals",
      icon: Clock3,
      iconClass: "text-amber-600 bg-amber-50",
      title: `Retiros pendientes · ${pendingWithdrawals.length} operación${pendingWithdrawals.length === 1 ? "" : "es"}`,
      detail: `${formatCurrency(pendingWithdrawalsAmount)} reservados`,
      href: "/pending-withdrawals",
    });
  }

  if (pendingDeposits.length > 0) {
    items.push({
      id: "deposits",
      icon: Clock3,
      iconClass: "text-amber-600 bg-amber-50",
      title: `Depósitos pendientes · ${pendingDeposits.length} operación${pendingDeposits.length === 1 ? "" : "es"}`,
      detail: `${formatCurrency(pendingDepositsAmount)} por confirmar`,
      href: "/history",
    });
  }

  if (editedOperations.length > 0) {
    items.push({
      id: "edited",
      icon: Pencil,
      iconClass: "text-[#2563EB] bg-[#EFF6FF]",
      title: `Operaciones editadas · ${editedOperations.length} corrección${editedOperations.length === 1 ? "" : "es"}`,
      detail: "Revisar motivos",
      href: "/history",
    });
  }

  for (const alert of bankAlerts) {
    if (alert.isAtLimit) {
      items.push({
        id: `bank-limit-${alert.bankId}`,
        icon: AlertOctagon,
        iconClass: "text-red-600 bg-red-50",
        title: `${alert.bankName} alcanzó su límite`,
        detail: "Movimientos visibles agotados",
        href: "/balances",
      });
    } else if (alert.isNearLimit) {
      items.push({
        id: `bank-near-${alert.bankId}`,
        icon: AlertTriangle,
        iconClass: "text-amber-600 bg-amber-50",
        title: `${alert.bankName} cerca del límite`,
        detail: `${alert.remainingVisibleMovements} movimientos visibles restantes`,
        href: "/balances",
      });
    }
  }

  if (totals.cashIsCritical) {
    items.push({
      id: "cash-critical",
      icon: AlertOctagon,
      iconClass: "text-red-600 bg-red-50",
      title: "Caja física crítica",
      detail: `${formatCurrency(totals.cashAvailable)} disponibles`,
      href: "/balances",
    });
  }

  const criticalCount = items.filter((item) =>
    item.iconClass.includes("red-"),
  ).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Pendientes y situaciones por revisar
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Incidencias operativas que requieren tu atención
          </p>
        </div>
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
            {criticalCount} crítica{criticalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          No hay situaciones pendientes por revisar.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50/70"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-slate-500">{item.detail}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}