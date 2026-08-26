export type WithdrawalCommissionMode = "deposited" | "cash" | "deducted";
export type WithdrawalMode = "delivered" | "pending";

export type WithdrawalPendingReason =
  | "customer_later"
  | "insufficient_cash"
  | "operational_limit"
  | "other";

export type WithdrawalFormData = {
  bankFolio: string;
  amount: string;
  bank: string;
  senderName: string;
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
  senderName: "",
  receiverName: "",
  commissionMode: "",
  pendingReason: "",
  pendingReasonDetails: "",
  observations: "",
};
