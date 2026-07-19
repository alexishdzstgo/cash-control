"use client";

import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { mockOperations } from "@/components/history/mockOperations";
import { OperationDetailsModal } from "@/components/history/OperationDetailsModal";
import { OperationStatusBadge } from "@/components/history/OperationStatusBadge";
import { OperationTypeBadge } from "@/components/history/OperationTypeBadge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";

const MAX_RECENT_OPERATIONS = 5;

export function ActivityFeed() {
const [selectedOperation, setSelectedOperation] =
useState<Operation | null>(null);

const recentOperations = useMemo(() => {
return [...mockOperations]
.sort(
(firstOperation, secondOperation) =>
new Date(secondOperation.createdAt).getTime() -
new Date(firstOperation.createdAt).getTime(),
)
.slice(0, MAX_RECENT_OPERATIONS);
}, []);

return (
<> <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"> <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"> <div> <h2 className="text-lg font-semibold text-slate-950">
Actividad reciente </h2>


        <p className="mt-1 text-sm text-slate-500">
          Últimos movimientos registrados en el negocio.
        </p>
      </div>

      <Link
        href="/history"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
      >
        Ver historial completo
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>

    <div className="divide-y divide-slate-100">
      {recentOperations.map((operation) => (
        <article
          key={operation.id}
          className="group px-6 py-5 transition hover:bg-slate-50/70"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <OperationTypeBadge type={operation.type} />

                <OperationStatusBadge status={operation.status} />

                {operation.edited && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                    <Pencil className="h-3.5 w-3.5" />
                    Editado
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ActivityDetail
                  label="Folio"
                  value={operation.bankFolio}
                  mono
                />

                <ActivityDetail
                  label="Monto"
                  value={formatCurrency(operation.amount)}
                />

                <ActivityDetail
                  label="Registró"
                  value={operation.createdBy}
                />

                <ActivityDetail
                  label="Fecha"
                  value={formatDateTime(operation.createdAt)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedOperation(operation)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Ver detalle
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </article>
      ))}

      {recentOperations.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="font-medium text-slate-700">
            No hay actividad reciente
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Los movimientos registrados aparecerán en esta sección.
          </p>
        </div>
      )}
    </div>
  </section>

  <OperationDetailsModal
    operation={selectedOperation}
    onClose={() => setSelectedOperation(null)}
  />
</>


);
}

type ActivityDetailProps = {
label: string;
value: string;
mono?: boolean;
};

function ActivityDetail({
label,
value,
mono = false,
}: ActivityDetailProps) {
return ( <div className="min-w-0"> <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
{label} </p>


  <p
    className={`mt-1 truncate text-sm font-semibold text-slate-800 ${
      mono ? "font-mono" : ""
    }`}
    title={value}
  >
    {value}
  </p>
</div>


);
}
