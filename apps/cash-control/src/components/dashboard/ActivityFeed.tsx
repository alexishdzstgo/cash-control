"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { OperationDetailsModal } from "@/components/history/OperationDetailsModal";
import { OperationStatusBadge } from "@/components/history/OperationStatusBadge";
import { OperationTypeBadge } from "@/components/history/OperationTypeBadge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";

const MAX_RECENT_OPERATIONS = 3;

const operationTypeConfig = {
  deposito: {
    icon: ArrowDownToLine,
    accent: "bg-[#2563EB]",
    iconBg: "bg-[#EFF6FF]",
    iconText: "text-[#1D4ED8]",
  },
  retiro: {
    icon: ArrowUpFromLine,
    accent: "bg-slate-500",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
  },
} as const;

type OperationType = keyof typeof operationTypeConfig;

export function ActivityFeed() {
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );
  const { operations } = useBusinessFunds();

  const recentOperations = useMemo(() => {
    return [...operations]
      .sort(
        (firstOperation, secondOperation) =>
          new Date(secondOperation.createdAt).getTime() -
          new Date(firstOperation.createdAt).getTime(),
      )
      .slice(0, MAX_RECENT_OPERATIONS);
  }, [operations]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Actividad reciente
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Últimos movimientos registrados en el negocio.
          </p>
        </div>

        <Link
          href="/history"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
        >
          Ver historial completo
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {recentOperations.map((operation) => {
          const typeConfig =
            operationTypeConfig[operation.type as OperationType];
          const TypeIcon = typeConfig.icon;

          return (
            <article
              key={operation.id}
              className="group relative overflow-hidden px-6 py-5 transition-colors duration-200 hover:bg-slate-50/70"
            >
              <div
                className={`absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full ${typeConfig.accent}`}
              />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center justify-center rounded-lg p-1.5 ${typeConfig.iconBg} ${typeConfig.iconText}`}
                    >
                      <TypeIcon className="h-4 w-4" aria-hidden="true" />
                    </div>

                    <OperationTypeBadge type={operation.type} />

                    <OperationStatusBadge status={operation.status} />

                    {operation.isEdited && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Editado
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-lg font-bold tracking-tight text-slate-950 tabular-nums">
                      {formatCurrency(operation.amount)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <span className="font-mono tabular-nums">
                      Folio {operation.bankFolio}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span>Registró {operation.createdBy}</span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span>{formatDateTime(operation.createdAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOperation(operation)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
                >
                  Ver detalle
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </article>
          );
        })}

        {recentOperations.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Activity className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-medium text-slate-700">
              No hay actividad reciente
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Los movimientos registrados aparecerán en esta sección.
            </p>
          </div>
        )}
      </div>

      <OperationDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />
    </section>
  );
}
