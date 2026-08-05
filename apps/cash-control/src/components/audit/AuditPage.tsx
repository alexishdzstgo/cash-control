"use client";

import { useMemo, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  type AuditFilters as AuditFilterState,
  filterAuditOperations,
  getAuditSummary,
} from "@/lib/audit";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Operation } from "@/types/operation";
import { AuditDetailsModal } from "./AuditDetailsModal";
import { AuditFilters } from "./AuditFilters";
import { AuditSummaryCards } from "./AuditSummaryCards";
import { AuditTable } from "./AuditTable";

const defaultFilters: AuditFilterState = {
  search: "",
  user: "todos",
  operationType: "todos",
  reason: "todos",
  date: "",
};

type AuditPageProps = {
  operations: Operation[];
  initialUserFilter?: string;
};

export function AuditPage({ operations, initialUserFilter }: AuditPageProps) {
  const { movements } = useBusinessFunds();
  const [filters, setFilters] = useState<AuditFilterState>({
    ...defaultFilters,
    user: initialUserFilter ?? "todos",
  });
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const summary = useMemo(() => getAuditSummary(operations), [operations]);
  const filteredOperations = useMemo(
    () => filterAuditOperations(operations, filters),
    [operations, filters],
  );
  const correctedAdministrativeMovements = movements.filter(
    (movement) =>
      movement.isEdited &&
      (filters.user === "todos" || movement.editedByUserName === filters.user),
  );

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Consulta las operaciones modificadas durante los turnos."
      />

      <div className="space-y-6">
        <AuditSummaryCards summary={summary} />

        <AuditFilters
          filters={filters}
          users={summary.correctionUsers}
          reasons={summary.correctionReasons}
          operationTypes={summary.operationTypes}
          dates={summary.availableDates}
          onChange={setFilters}
          onClear={() => setFilters(defaultFilters)}
        />

        <AuditTable
          operations={filteredOperations}
          onViewDetails={setSelectedOperation}
        />

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Movimientos administrativos
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Correcciones de fondos del negocio, separadas de operaciones de
              cliente.
            </p>
          </div>

          {correctedAdministrativeMovements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Sin correcciones administrativas con los filtros actuales.
            </p>
          ) : (
            <div className="space-y-3">
              {correctedAdministrativeMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="grid gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-4 text-sm md:grid-cols-5"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Tipo
                    </p>
                    <p className="font-semibold text-slate-900">
                      Movimiento administrativo
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Recurso
                    </p>
                    <p className="font-semibold text-slate-900">
                      {movement.resourceName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Monto
                    </p>
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(movement.amountCents / 100)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Actor
                    </p>
                    <p className="font-semibold text-slate-900">
                      {movement.editedByUserName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Fecha
                    </p>
                    <p className="font-semibold text-slate-900">
                      {movement.editedAt
                        ? formatDateTime(movement.editedAt)
                        : "No disponible"}
                    </p>
                  </div>
                  <p className="md:col-span-5 text-slate-600">
                    Motivo: {movement.editReason ?? "Sin motivo registrado"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AuditDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />
    </div>
  );
}
