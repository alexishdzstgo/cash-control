"use client";

import { Banknote, CheckCircle2, Eye, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { OperationDetailsModal } from "@/components/history/OperationDetailsModal";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { getPendingWithdrawalReasonLabel } from "@/lib/pendingWithdrawalReasons";
import type { Operation } from "@/types/operation";
import { PendingWithdrawalDeliveryDialog } from "./PendingWithdrawalDeliveryDialog";

export function PendingWithdrawalsPage() {
  const { operations, canDeliverPendingWithdrawal } = useBusinessFunds();

  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const [operationToDeliver, setOperationToDeliver] =
    useState<Operation | null>(null);
  const pendingWithdrawals = useMemo(() => {
    return operations
      .filter(
        (operation) =>
          operation.type === "retiro" && operation.status === "pendiente",
      )
      .sort(
        (firstOperation, secondOperation) =>
          new Date(secondOperation.createdAt).getTime() -
          new Date(firstOperation.createdAt).getTime(),
      );
  }, [operations]);

  const pendingAmount = useMemo(() => {
    return pendingWithdrawals.reduce(
      (total, operation) => total + operation.amount,
      0,
    );
  }, [pendingWithdrawals]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Retiros pendientes"
          value={String(pendingWithdrawals.length)}
          description="Operaciones por entregar"
          icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
        />

        <SummaryCard
          title="Efectivo pendiente"
          value={formatCurrency(pendingAmount)}
          description="Monto todavía no entregado"
          icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-semibold tracking-wide">
              <tr>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Registró</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pendingWithdrawals.map((operation) => (
                <tr
                  key={operation.id}
                  className="bg-white transition-colors duration-200 hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3 font-mono font-medium tabular-nums text-slate-800">
                    {operation.bankFolio}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatCurrency(operation.amount)}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {operation.bankFrom}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {getPendingWithdrawalReasonLabel(operation)}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {operation.createdBy}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(operation.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Ver detalle"
                        aria-label={`Ver detalle de la operación ${operation.bankFolio}`}
                        onClick={() => setSelectedOperation(operation)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (canDeliverPendingWithdrawal())
                            setOperationToDeliver(operation);
                        }}
                        disabled={!canDeliverPendingWithdrawal()}
                        className="btn-primary h-9 shrink-0 whitespace-nowrap px-3"
                      >
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        Confirmar entrega
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {pendingWithdrawals.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No hay retiros pendientes de entrega.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OperationDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />

      <PendingWithdrawalDeliveryDialog
        operation={operationToDeliver}
        onClose={() => setOperationToDeliver(null)}
      />
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
};

function SummaryCard({ title, value, description, icon }: SummaryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </article>
  );
}
