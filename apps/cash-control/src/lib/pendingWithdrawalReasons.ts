import type { WithdrawalPendingReason } from "@/types/withdrawal";

export const pendingWithdrawalReasonOptions: Array<{
  value: WithdrawalPendingReason;
  label: string;
}> = [
  {
    value: "visible_movement_limit",
    label: "Límite de movimientos visibles en la app bancaria",
  },
  { value: "other", label: "Otro" },
];

const pendingWithdrawalReasonLabels: Record<WithdrawalPendingReason, string> =
  Object.fromEntries(
    pendingWithdrawalReasonOptions.map((option) => [
      option.value,
      option.label,
    ]),
  ) as Record<WithdrawalPendingReason, string>;

export function getPendingWithdrawalReasonLabel(operation: {
  pendingReason?: string;
  pendingReasonDetails?: string;
}): string {
  if (operation.pendingReason === "other") {
    return operation.pendingReasonDetails || "Otro";
  }

  return operation.pendingReason
    ? (pendingWithdrawalReasonLabels[
        operation.pendingReason as WithdrawalPendingReason
      ] ?? "Motivo no reconocido")
    : "Sin motivo registrado";
}
