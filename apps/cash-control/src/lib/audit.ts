import type {
  Operation,
  OperationClarification,
  OperationCorrection,
  OperationCorrectionSnapshot,
  OperationType,
} from "@/types/operation";

export type AuditEventKind = "correction" | "clarification";

export type AuditFilters = {
  search: string;
  user: string;
  operationType: "todos" | OperationType;
  reason: string;
  date: string;
};

export type OperationAuditEvent = {
  id: string;
  kind: AuditEventKind;
  operation: Operation;
  reason: string;
  createdAt: string;
  createdBy: string;
  correction?: OperationCorrection;
  clarification?: OperationClarification;
};

export type AuditSummary = {
  totalEdited: number;
  totalClarifications: number;
  latestCorrection: OperationAuditEvent | null;
  correctionUsers: string[];
  correctionReasons: string[];
  operationTypes: OperationType[];
  availableDates: string[];
};

export function getCorrectionDate(event: OperationAuditEvent): string {
  return event.createdAt;
}

export function getCorrectionUser(event: OperationAuditEvent): string {
  return event.createdBy;
}

export function getCorrectionReason(event: OperationAuditEvent): string {
  return event.reason || "Sin motivo registrado";
}

export function getAuditEvents(operations: Operation[]): OperationAuditEvent[] {
  return operations
    .flatMap((operation) => [
      ...(operation.corrections ?? []).map((correction) =>
        buildCorrectionEvent(operation, correction),
      ),
      ...(operation.clarifications ?? []).map((clarification) =>
        buildClarificationEvent(operation, clarification),
      ),
      ...buildLegacyCorrectionEvents(operation),
    ])
    .sort(
      (firstEvent, secondEvent) =>
        new Date(secondEvent.createdAt).getTime() -
        new Date(firstEvent.createdAt).getTime(),
    );
}

export function getEditedOperations(
  operations: Operation[],
): OperationAuditEvent[] {
  return getAuditEvents(operations).filter(
    (event) => event.kind === "correction",
  );
}

export function getAuditSummary(operations: Operation[]): AuditSummary {
  const auditEvents = getAuditEvents(operations);
  const correctionEvents = auditEvents.filter(
    (event) => event.kind === "correction",
  );

  return {
    totalEdited: correctionEvents.length,
    totalClarifications: auditEvents.filter(
      (event) => event.kind === "clarification",
    ).length,
    latestCorrection: correctionEvents[0] ?? null,
    correctionUsers: uniqueSorted(auditEvents.map(getCorrectionUser)),
    correctionReasons: uniqueSorted(auditEvents.map(getCorrectionReason)),
    operationTypes: uniqueSorted(
      auditEvents.map((event) => event.operation.type),
    ),
    availableDates: uniqueSorted(
      auditEvents
        .map((event) => getDateInputValue(getCorrectionDate(event)))
        .filter(Boolean),
    ),
  };
}

export function filterAuditOperations(
  operations: Operation[],
  filters: AuditFilters,
): OperationAuditEvent[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return getAuditEvents(operations).filter((event) => {
    const correctionUser = getCorrectionUser(event);
    const correctionReason = getCorrectionReason(event);
    const correctionDate = getDateInputValue(getCorrectionDate(event));

    const matchesSearch =
      normalizedSearch === "" ||
      event.operation.bankFolio.toLowerCase().includes(normalizedSearch) ||
      event.operation.createdBy.toLowerCase().includes(normalizedSearch) ||
      correctionUser.toLowerCase().includes(normalizedSearch);

    const matchesUser =
      filters.user === "todos" || correctionUser === filters.user;

    const matchesType =
      filters.operationType === "todos" ||
      event.operation.type === filters.operationType;

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

export function getCorrectionSnapshotChanges({
  before,
  after,
}: {
  before: OperationCorrectionSnapshot;
  after: OperationCorrectionSnapshot;
}) {
  return correctionSnapshotFields.flatMap((field) => {
    const beforeValue = before[field.key];
    const afterValue = after[field.key];
    if (beforeValue === afterValue) return [];

    return [
      {
        label: field.label,
        before: field.format(beforeValue),
        after: field.format(afterValue),
      },
    ];
  });
}

function buildCorrectionEvent(
  operation: Operation,
  correction: OperationCorrection,
): OperationAuditEvent {
  return {
    id: `${operation.id}:${correction.id}`,
    kind: "correction",
    operation,
    reason: correction.reason,
    createdAt: correction.createdAt,
    createdBy: correction.createdBy,
    correction,
  };
}

function buildClarificationEvent(
  operation: Operation,
  clarification: OperationClarification,
): OperationAuditEvent {
  return {
    id: `${operation.id}:${clarification.id}`,
    kind: "clarification",
    operation,
    reason: clarification.reason,
    createdAt: clarification.createdAt,
    createdBy: clarification.createdBy,
    clarification,
  };
}

function buildLegacyCorrectionEvents(
  operation: Operation,
): OperationAuditEvent[] {
  if (!operation.isEdited || (operation.corrections?.length ?? 0) > 0) {
    return [];
  }

  return [
    {
      id: `${operation.id}:legacy-correction`,
      kind: "correction",
      operation,
      reason:
        operation.observations ??
        operation.pendingReasonDetails ??
        operation.pendingReason ??
        "Sin motivo registrado",
      createdAt: operation.editedAt ?? operation.createdAt,
      createdBy: operation.editedBy ?? operation.createdBy,
    },
  ];
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

const correctionSnapshotFields: Array<{
  key: keyof OperationCorrectionSnapshot;
  label: string;
  format: (
    value: OperationCorrectionSnapshot[keyof OperationCorrectionSnapshot],
  ) => string;
}> = [
  { key: "amount", label: "Monto", format: formatMoneyValue },
  { key: "commission", label: "Comisión", format: formatMoneyValue },
  { key: "total", label: "Total", format: formatMoneyValue },
  { key: "bankFolio", label: "Folio/referencia", format: formatTextValue },
  { key: "bankFrom", label: "Banco origen", format: formatTextValue },
  { key: "bankTo", label: "Banco destino", format: formatTextValue },
  {
    key: "destinationAccountLast4",
    label: "Cuenta destino",
    format: formatTextValue,
  },
  {
    key: "destinationReference",
    label: "Referencia destino",
    format: formatTextValue,
  },
  { key: "receiverName", label: "Quien recibe", format: formatTextValue },
  {
    key: "withdrawalCommissionMode",
    label: "Forma comisión",
    format: formatTextValue,
  },
  {
    key: "customerCashReceived",
    label: "Efectivo cliente",
    format: formatMoneyValue,
  },
  {
    key: "bankMovementAmount",
    label: "Movimiento banco",
    format: formatMoneyValue,
  },
];

function formatMoneyValue(
  value: OperationCorrectionSnapshot[keyof OperationCorrectionSnapshot],
): string {
  return typeof value === "number"
    ? new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    : formatTextValue(value);
}

function formatTextValue(
  value: OperationCorrectionSnapshot[keyof OperationCorrectionSnapshot],
): string {
  return value === undefined || value === "" ? "No registrado" : String(value);
}
