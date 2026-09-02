"use client";

import { useMemo, useState } from "react";
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

const clarificationReasons = [
  "Error de captura detectado",
  "Diferencia de monto detectada",
  "Referencia incorrecta",
  "Banco incorrecto",
  "Datos del cliente incorrectos",
  "Otro",
] as const;

type ClarificationField = "reason" | "note";
type ClarificationErrors = Partial<Record<ClarificationField, string>>;

export function OperationsHistoryPage() {
  const [operationToDeliver, setOperationToDeliver] =
    useState<Operation | null>(null);
  const [operationToClarify, setOperationToClarify] =
    useState<Operation | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [clarificationReason, setClarificationReason] = useState("");
  const [clarificationNote, setClarificationNote] = useState("");
  const [clarificationReference, setClarificationReference] = useState("");
  const [clarificationErrors, setClarificationErrors] =
    useState<ClarificationErrors>({});
  const [clarificationFormError, setClarificationFormError] = useState<
    string | null
  >(null);
  const [isSavingClarification, setIsSavingClarification] = useState(false);
  const { operations, deliverPendingWithdrawal, addOperationClarification } =
    useBusinessFunds();
  const { authenticatedUser } = useMockSession();

  const {
    search,
    dateFrom,
    dateTo,
    statusFilter,
    typeFilter,
    currentPage,
    selectedOperationId,
    filteredOperations,
    paginatedOperations,
    totalPages,
    pageSize,
    setCurrentPage,
    setSelectedOperationId,
    updateSearch,
    updateDateFrom,
    updateDateTo,
    updateStatusFilter,
    updateTypeFilter,
    clearFilters,
  } = useOperationsHistory(operations);

  const selectedOperation = useMemo(
    () =>
      selectedOperationId
        ? (operations.find(
            (operation) => operation.id === selectedOperationId,
          ) ?? null)
        : null,
    [operations, selectedOperationId],
  );

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

  function openClarificationDialog(operation: Operation) {
    setOperationToClarify(operation);
    setClarificationReason("");
    setClarificationNote("");
    setClarificationReference("");
    setClarificationErrors({});
    setClarificationFormError(null);
  }

  function closeClarificationDialog() {
    if (isSavingClarification) return;
    setOperationToClarify(null);
    setClarificationReason("");
    setClarificationNote("");
    setClarificationReference("");
    setClarificationErrors({});
    setClarificationFormError(null);
  }

  function saveClarification() {
    if (!operationToClarify || isSavingClarification) return;

    const nextErrors: ClarificationErrors = {};
    if (!clarificationReason.trim()) {
      nextErrors.reason = "Selecciona el motivo de la aclaración.";
    }
    if (!clarificationNote.trim()) {
      nextErrors.note = "Captura la nota de aclaración.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setClarificationErrors(nextErrors);
      setClarificationFormError("Revisa los campos obligatorios.");
      focusFirstInvalidField({
        errors: nextErrors,
        fieldOrder: ["reason", "note"],
        fieldSelector: {
          reason: "#history-clarification-reason",
          note: "#history-clarification-note",
        },
      });
      return;
    }

    setIsSavingClarification(true);
    const result = addOperationClarification({
      operationId: operationToClarify.id,
      reason: clarificationReason,
      note: clarificationNote,
      reference: clarificationReference,
      createdBy: authenticatedUser?.userName ?? "Usuario no disponible",
    });

    if (!result.success) {
      setClarificationFormError(
        result.error ?? "No se pudo guardar la aclaración.",
      );
      setIsSavingClarification(false);
      return;
    }

    setOperationToClarify(null);
    setClarificationReason("");
    setClarificationNote("");
    setClarificationReference("");
    setClarificationErrors({});
    setClarificationFormError(null);
    setIsSavingClarification(false);
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
        onViewDetails={(operation) => setSelectedOperationId(operation.id)}
        onAddClarification={openClarificationDialog}
        onMarkAsDelivered={(operation) => {
          setOperationToDeliver(operation);
          setReceiverName("");
          setDeliveryError(null);
        }}
      />

      <OperationDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperationId(null)}
      />

      <ClarificationDialog
        operation={operationToClarify}
        reason={clarificationReason}
        note={clarificationNote}
        reference={clarificationReference}
        errors={clarificationErrors}
        formError={clarificationFormError}
        isSaving={isSavingClarification}
        onReasonChange={(value) => {
          setClarificationReason(value);
          setClarificationErrors((current) => ({
            ...current,
            reason: undefined,
          }));
          setClarificationFormError(null);
        }}
        onNoteChange={(value) => {
          setClarificationNote(value);
          setClarificationErrors((current) => ({
            ...current,
            note: undefined,
          }));
          setClarificationFormError(null);
        }}
        onReferenceChange={setClarificationReference}
        onClose={closeClarificationDialog}
        onConfirm={saveClarification}
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

function ClarificationDialog({
  operation,
  reason,
  note,
  reference,
  errors,
  formError,
  isSaving,
  onReasonChange,
  onNoteChange,
  onReferenceChange,
  onClose,
  onConfirm,
}: {
  operation: Operation | null;
  reason: string;
  note: string;
  reference: string;
  errors: ClarificationErrors;
  formError: string | null;
  isSaving: boolean;
  onReasonChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!operation) return null;

  return (
    <ModalShell
      title="Agregar aclaración"
      description="Registra información adicional sobre esta operación sin modificar sus datos originales."
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar aclaración"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection>
          <div className="grid gap-3 md:grid-cols-2">
            <ModalInfoItem label="Folio" value={operation.bankFolio} />
            <ModalInfoItem label="Tipo" value={operation.type} />
            <ModalInfoItem
              label="Monto"
              value={formatCurrency(operation.amount)}
            />
            <ModalInfoItem
              label="Usuario que registró"
              value={operation.createdBy}
            />
          </div>
        </ModalSection>

        <div>
          <label
            htmlFor="history-clarification-reason"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Motivo de la aclaración
            <span className="ml-1 text-red-500">*</span>
          </label>
          <select
            id="history-clarification-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="field-input px-4 py-3"
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={
              errors.reason ? "history-clarification-reason-error" : undefined
            }
          >
            <option value="">Selecciona un motivo</option>
            {clarificationReasons.map((reasonOption) => (
              <option key={reasonOption} value={reasonOption}>
                {reasonOption}
              </option>
            ))}
          </select>
          {errors.reason && (
            <p
              id="history-clarification-reason-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.reason}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="history-clarification-note"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Nota de aclaración
            <span className="ml-1 text-red-500">*</span>
          </label>
          <textarea
            id="history-clarification-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className="field-input min-h-32 px-4 py-3"
            placeholder="Describe qué ocurrió y qué dato debería tomarse en cuenta al revisar esta operación."
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={
              errors.note ? "history-clarification-note-error" : undefined
            }
          />
          {errors.note && (
            <p
              id="history-clarification-note-error"
              className="mt-2 text-sm font-medium text-red-600"
            >
              {errors.note}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="history-clarification-reference"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Referencia adicional
          </label>
          <input
            id="history-clarification-reference"
            type="text"
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            className="field-input px-4 py-3"
            placeholder="Ej. folio correcto, número de ticket, referencia bancaria..."
          />
        </div>

        {formError && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {formError}
          </p>
        )}
      </div>
    </ModalShell>
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
          </div>
        </ModalSection>

        <div>
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Nombre de quien recibe
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
