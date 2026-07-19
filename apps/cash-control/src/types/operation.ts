export type OperationStatus = "pendiente" | "entregado";

export type OperationType = "deposito" | "retiro";

export type Operation = {
  id: string;
  type: OperationType;
  amount: number;
  commission: number;
  bankFrom: string;
  bankTo: string;
  bankFolio: string;
  senderName: string;
  receiverName: string;
  status: OperationStatus;
  createdBy: string;
  createdAt: string;
  edited: boolean;
};