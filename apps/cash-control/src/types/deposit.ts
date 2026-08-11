export type DepositStatus = "completado";

export type DepositFormData = {
  bankFolio: string;
  amount: string;
  receiverName: string;
  emissionBank: string;
  destinationAccountLast4: string;
  observations: string;
};

export const initialDepositFormData: DepositFormData = {
  bankFolio: "",
  amount: "",
  receiverName: "",
  emissionBank: "",
  destinationAccountLast4: "",
  observations: "",
};
