export type BalanceStatus =
  | "available"
  | "low"
  | "unavailable"
  | "inconsistent";

export type ReservedOperationType = "deposito" | "retiro";

export type ReservedOperation = {
  id: string;
  folio: string;
  type: ReservedOperationType;
  customerName: string;
  amount: number;
  registeredAt: string;
  registeredBy: string;
  status: "pending";
};

export type BankAccountBalance = {
  id: string;
  bankName: string;
  accountName: string;
  realBalance: number;
  reservedOperations: ReservedOperation[];
  status: BalanceStatus;
};

export type CashBalance = {
  physicalBalance: number;
  reservedOperations: ReservedOperation[];
  shiftName: string;
  responsibleName: string;
  updatedAt: string;
};