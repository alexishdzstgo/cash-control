import type { Operation, OperationType } from "@/types/operation";

export type AuditFilters = {
  search: string;
  user: string;
  operationType: "todos" | OperationType;
  reason: string;
  date: string;
};

export type AuditSummary = {
  totalEdited: number;
  latestCorrection: Operation | null;
  correctionUsers: string[];
  correctionReasons: string[];
  operationTypes: OperationType[];
  availableDates: string[];
};

export function getCorrectionDate(operation: Operation): string {
  return operation.editedAt ?? operation.createdAt;
}

export function getCorrectionUser(operation: Operation): string {
  return operation.editedBy ?? operation.createdBy;
}

export function getCorrectionReason(operation: Operation): string {
  return (
    operation.observations ??
    operation.pendingReasonDetails ??
    operation.pendingReason ??
    "Sin motivo registrado"
  );
}

export function getEditedOperations(operations: Operation[]): Operation[] {
  return operations
    .filter((operation) => operation.isEdited === true)
    .sort(
      (firstOperation, secondOperation) =>
        new Date(getCorrectionDate(secondOperation)).getTime() -
        new Date(getCorrectionDate(firstOperation)).getTime(),
    );
}

export function getAuditSummary(operations: Operation[]): AuditSummary {
  const editedOperations = getEditedOperations(operations);

  return {
    totalEdited: editedOperations.length,
    latestCorrection: editedOperations[0] ?? null,
    correctionUsers: uniqueSorted(editedOperations.map(getCorrectionUser)),
    correctionReasons: uniqueSorted(editedOperations.map(getCorrectionReason)),
    operationTypes: uniqueSorted(
      editedOperations.map((operation) => operation.type),
    ),
    availableDates: uniqueSorted(
      editedOperations
        .map((operation) => getDateInputValue(getCorrectionDate(operation)))
        .filter(Boolean),
    ),
  };
}

export function filterAuditOperations(
  operations: Operation[],
  filters: AuditFilters,
): Operation[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return getEditedOperations(operations).filter((operation) => {
    const correctionUser = getCorrectionUser(operation);
    const correctionReason = getCorrectionReason(operation);
    const correctionDate = getDateInputValue(getCorrectionDate(operation));

    const matchesSearch =
      normalizedSearch === "" ||
      operation.bankFolio.toLowerCase().includes(normalizedSearch) ||
      operation.createdBy.toLowerCase().includes(normalizedSearch) ||
      correctionUser.toLowerCase().includes(normalizedSearch);

    const matchesUser =
      filters.user === "todos" || correctionUser === filters.user;

    const matchesType =
      filters.operationType === "todos" ||
      operation.type === filters.operationType;

    const matchesReason =
      filters.reason === "todos" || correctionReason === filters.reason;

    const matchesDate = filters.date === "" || correctionDate === filters.date;

    return (
      matchesSearch &&
      matchesUser &&
      matchesType &&
      matchesReason &&
      matchesDate
    );
  });
}

function getDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es-MX"),
  );
}
