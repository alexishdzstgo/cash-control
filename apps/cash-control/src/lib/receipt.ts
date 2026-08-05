import type { Operation } from "@/types/operation";
import type {
  ReceiptData,
  ReceiptFieldVisibility,
  ReceiptOperationType,
  ReceiptPreferences,
  ReceiptStatus,
} from "@/types/receipt";

export function buildReceiptData({
  operation,
  registeredUser,
  deliveredBy,
  responsibleUser,
}: {
  operation: Operation;
  registeredUser?: string;
  deliveredBy?: string;
  responsibleUser?: string;
}): ReceiptData {
  const isDeposit = operation.type === "deposito";
  const status = mapReceiptStatus(operation);
  const bankName = isDeposit ? operation.bankTo : operation.bankFrom;

  return {
    receiptId: operation.id,
    operationId: operation.id,
    folio: operation.bankFolio,
    operationType: isDeposit ? "deposit" : "withdrawal",
    status,
    createdAt: operation.createdAt,
    completedAt:
      status === "completed" || status === "delivered"
        ? (operation.editedAt ?? operation.createdAt)
        : undefined,
    amount: operation.amount,
    commission: operation.commission,
    total: operation.total,
    bankName,
    senderName: operation.senderName || undefined,
    receiverName: operation.receiverName || undefined,
    beneficiaryName:
      operation.receiverName || operation.senderName || undefined,
    registeredBy: registeredUser ?? operation.createdBy ?? "No disponible",
    deliveredBy:
      deliveredBy ??
      (operation.status === "entregado" ? operation.createdBy : undefined),
    responsibleUser,
    wasEdited: operation.isEdited === true,
    lastEditedAt: operation.editedAt,
    observations: operation.observations,
    hasReceiptSnapshot: false,
  };
}

export function getReceiptFieldVisibility(
  preferences: ReceiptPreferences,
  operationType?: ReceiptOperationType,
): ReceiptFieldVisibility {
  if (!operationType) {
    return preferences.fieldVisibility;
  }

  return {
    ...preferences.fieldVisibility,
    ...preferences.operationTypeOverrides?.[operationType],
  };
}

export function getReceiptConfigurationWarnings(
  visibility: ReceiptFieldVisibility,
): string[] {
  const warnings: string[] = [];

  if (!visibility.showFolio && !visibility.showOperationId) {
    warnings.push(
      "Este comprobante podría ser difícil de localizar posteriormente porque no contiene un folio ni un identificador.",
    );
  }

  if (!visibility.showAmount) {
    warnings.push("El comprobante no mostrará la cantidad de la operación.");
  }

  if (!visibility.showDate) {
    warnings.push("El comprobante no mostrará cuándo se realizó la operación.");
  }

  if (!visibility.showBusinessName) {
    warnings.push(
      "El comprobante se imprimirá sin identificar el establecimiento.",
    );
  }

  return warnings;
}

function mapReceiptStatus(operation: Operation): ReceiptStatus {
  if (operation.status === "pendiente") {
    return "pending";
  }
  if (operation.type === "retiro") {
    return "delivered";
  }
  return "completed";
}
