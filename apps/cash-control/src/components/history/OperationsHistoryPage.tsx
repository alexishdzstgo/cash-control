"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useOperationsHistory } from "@/hooks/useOperationsHistory";
import type { Operation } from "@/types/operation";
import { HistoryFilters } from "./HistoryFilters";
import { mockOperations } from "./mockOperations";
import { OperationDetailsModal } from "./OperationDetailsModal";
import { OperationsTable } from "./OperationsTable";

export function OperationsHistoryPage() {
const [operationToDeliver, setOperationToDeliver] =
useState<Operation | null>(null);

const {
search,
dateFrom,
dateTo,
statusFilter,
typeFilter,
currentPage,
selectedOperation,

filteredOperations,
paginatedOperations,
totalPages,
pageSize,

setCurrentPage,
setSelectedOperation,

updateSearch,
updateDateFrom,
updateDateTo,
updateStatusFilter,
updateTypeFilter,
clearFilters,
markAsDelivered,


} = useOperationsHistory(mockOperations);

return ( <div className="space-y-6"> <div> <p className="text-sm font-medium text-emerald-600">Sprint 3</p>


    <h1 className="text-2xl font-bold text-slate-900">
      Historial de operaciones
    </h1>

    <p className="mt-1 text-sm text-slate-500">
      Consulta depósitos, transferencias y retiros registrados.
    </p>
  </div>

  <HistoryFilters
    search={search}
    dateFrom={dateFrom}
    dateTo={dateTo}
    statusFilter={statusFilter}
    typeFilter={typeFilter}
    onSearchChange={updateSearch}
    onDateFromChange={updateDateFrom}
    onDateToChange={updateDateTo}
    onStatusFilterChange={updateStatusFilter}
    onTypeFilterChange={updateTypeFilter}
    onClearFilters={clearFilters}
  />

  <OperationsTable
    operations={paginatedOperations}
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={filteredOperations.length}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onViewDetails={setSelectedOperation}
    onMarkAsDelivered={(operation) => {
      setOperationToDeliver(operation);
    }}
  />

  <OperationDetailsModal
    operation={selectedOperation}
    onClose={() => setSelectedOperation(null)}
  />

  <ConfirmDialog
    isOpen={operationToDeliver !== null}
    title="Marcar operación como entregada"
    description={
      operationToDeliver
        ? `La operación con folio ${operationToDeliver.bankFolio} cambiará de pendiente a entregada. Este movimiento quedará registrado posteriormente en la auditoría.`
        : ""
    }
    confirmLabel="Marcar como entregada"
    onCancel={() => setOperationToDeliver(null)}
    onConfirm={() => {
      if (!operationToDeliver) {
        return;
      }

      markAsDelivered(operationToDeliver.id);
      setOperationToDeliver(null);
    }}
  />
</div>


);
}
