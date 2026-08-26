"use client";

import { useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import { useOperationsHistory } from "@/hooks/useOperationsHistory";
import { formatCurrency } from "@/lib/formatters";
import { focusFirstInvalidField } from "@/lib/formValidationFocus";
import type { Operation } from "@/types/operation";
import { HistoryFilters } from "./HistoryFilters";
import { OperationDetailsModal } from "./OperationDetailsModal";
import { OperationsTable } from "./OperationsTable";

export function OperationsHistoryPage() {
  const [operationToDeliver, setOperationToDeliver] =
    useState<Operation | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const { operations, deliverPendingWithdrawal } = useBusinessFunds();
  const { authenticatedUser } = useMockSession();

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
  } = useOperationsHistory(operations);

  function closeDeliveryDialog() {
    if (isDelivering) return;
    setOperationToDeliver(null);
    setReceiverName("");
    setDeliveryError(null);
  }

  function confirmDelivery() {
    if (!operationToDeliver || isDelivering) return;

    if (receiverName.trim() === "") {
      setDeliveryError("Captura el nombre de quien recibe.");
      focusFirstInvalidField({
        errors: { receiverName: "Captura el nombre de quien recibe." },
        fieldOrder: ["receiverName"],
        fieldSelector: {
          receiverName: "#history-delivery-receiver",
        },
      });
      return;
    }

    setIsDelivering(true);
    const result = deliverPendingWithdrawal({
      operationId: operationToDeliver.id,
      receiverName,
      deliveredBy: authenticatedUser?.userName ?? "Usuario no disponible",
    });

    if (!result.success) {
      setDeliveryError(result.error ?? "No se pudo confirmar la entrega.");
      setIsDelivering(false);
      return;
    }

    setOperationToDeliver(null);
    setReceiverName("");
    setDeliveryError(null);
    setIsDelivering(false);
  }

  return (
    <div className="space-y-6">
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
          setReceiverName("");
          setDeliveryError(null);
        }}
      />

      <OperationDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />

      <DeliveryDialog
        operation={operationToDeliver}
        receiverName={receiverName}
        error={deliveryError}
        isDelivering={isDelivering}
        inputId="history-delivery-receiver"
        onReceiverNameChange={(value) => {
          setReceiverName(value);
          setDeliveryError(null);
        }}
        onClose={closeDeliveryDialog}
        onConfirm={confirmDelivery}
      />
    </div>
  );
}

function DeliveryDialog({
  operation,
  receiverName,
  error,
  isDelivering,
  inputId,
  onReceiverNameChange,
  onClose,
  onConfirm,
}: {
  operation: Operation | null;
  receiverName: string;
  error: string | null;
  isDelivering: boolean;
  inputId: string;
  onReceiverNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!operation) return null;

  return (
    <ModalShell
      title="Confirmar entrega de efectivo"
      description="Registra la entrega física del efectivo apartado para este retiro."
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDelivering}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={isDelivering}
          >
            {isDelivering ? "Confirmando..." : "Confirmar entrega"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection>
          <div className="grid gap-3 md:grid-cols-2">
            <ModalInfoItem
              label="Folio/referencia"
              value={operation.bankFolio}
            />
            <ModalInfoItem
              label="Banco"
              value={operation.bankFrom ?? "Banco no disponible"}
            />
            <ModalInfoItem
              label="Monto"
              value={formatCurrency(operation.amount)}
            />
            <ModalInfoItem
              label="Persona que envió"
              value={operation.senderName}
            />
          </div>
        </ModalSection>

        <div>
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Persona que recibe
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id={inputId}
            type="text"
            value={receiverName}
            onChange={(event) => onReceiverNameChange(event.target.value)}
            className="field-input px-4 py-3"
            placeholder="Nombre completo"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {error && (
            <p
              id={`${inputId}-error`}
              className="mt-2 text-sm font-medium text-red-600"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
