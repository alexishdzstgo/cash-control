export type WithdrawalMode = "delivered" | "pending";

export type WithdrawalFormData = {
  bankFolio: string;
  amount: string;
  bank: string;
  senderName: string;
  receiverName: string;
  pendingReason: string;
  pendingReasonDetails: string;
  observations: string;
};

export const initialWithdrawalFormData: WithdrawalFormData = {
  bankFolio: "",
  amount: "",
  bank: "banco-azteca",
  senderName: "",
  receiverName: "",
  pendingReason: "bank-movement-limit",
  pendingReasonDetails: "",
  observations: "",
};