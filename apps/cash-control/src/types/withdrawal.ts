export type WithdrawalCommissionMode = "deposited" | "cash" | "deducted";

export type WithdrawalFormData = {
  bankFolio: string;
  amount: string;
  bank: string;
  receiverName: string;
  commissionMode: WithdrawalCommissionMode | "";
  observations: string;
};

export const initialWithdrawalFormData: WithdrawalFormData = {
  bankFolio: "",
  amount: "",
  bank: "",
  receiverName: "",
  commissionMode: "",
  observations: "",
};
