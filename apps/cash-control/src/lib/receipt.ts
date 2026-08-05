import type { Operation } from "@/types/operation";
import type { ReceiptData, ReceiptStatus } from "@/types/receipt";

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
    bankName: bankName || "No disponible",
    senderName: operation.senderName || "No disponible",
    receiverName: operation.receiverName || "No disponible",
    beneficiaryName:
      operation.receiverName || operation.senderName || "No disponible",
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

function mapReceiptStatus(operation: Operation): ReceiptStatus {
  if (operation.status === "pendiente") {
    return "pending";
  }
  if (operation.type === "retiro") {
    return "delivered";
  }
  return "completed";
}
