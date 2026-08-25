"use client";

import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { formatDateTime } from "@/lib/formatters";

export function AuditSummary() {
  const { operations } = useBusinessFunds();
  const editedOperations = operations.filter(
    (operation) => operation.isEdited === true,
  );
  const latestEdit =
    editedOperations.length > 0
      ? [...editedOperations].sort(
          (a, b) =>
            new Date(b.editedAt ?? b.createdAt).getTime() -
            new Date(a.editedAt ?? a.createdAt).getTime(),
        )[0]
      : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Correcciones y auditoría
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Operaciones que fueron modificadas durante el turno
          </p>
        </div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Ver historial
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5">
        {editedOperations.length === 0 ? (
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Sin correcciones</p>
              <p className="mt-1 text-sm text-slate-500">
                No hay operaciones modificadas registradas en el turno.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {editedOperations.length}
                  </span>{" "}
                  operación{editedOperations.length === 1 ? "" : "es"} editada
                  {editedOperations.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {latestEdit && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Última corrección
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  Folio {latestEdit.bankFolio} ·{" "}
                  {latestEdit.type === "deposito" ? "Depósito" : "Retiro"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {latestEdit.editedBy ?? latestEdit.createdBy} ·{" "}
                  {latestEdit.editedAt
                    ? formatDateTime(latestEdit.editedAt)
                    : formatDateTime(latestEdit.createdAt)}
                </p>
                {latestEdit.observations && (
                  <p className="mt-2 text-sm text-slate-600">
                    {latestEdit.observations}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
