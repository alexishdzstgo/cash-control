export type WithdrawalCommissionMode = "deposited" | "cash" | "deducted";
export type WithdrawalMode = "delivered" | "pending";

export type WithdrawalPendingReason = "visible_movement_limit" | "other";

export type WithdrawalFormData = {
  bankFolio: string;
  amount: string;
  bank: string;
  receiverName: string;
  commissionMode: WithdrawalCommissionMode | "";
  pendingReason: WithdrawalPendingReason | "";
  pendingReasonDetails: string;
  observations: string;
};

export const initialWithdrawalFormData: WithdrawalFormData = {
  bankFolio: "",
  amount: "",
  bank: "",
  receiverName: "",
  commissionMode: "",
  pendingReason: "",
  pendingReasonDetails: "",
  observations: "",
};
