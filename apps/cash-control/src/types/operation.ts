import type {
  AppliedCommissionSnapshot,
  CommissionLocation,
  CommissionStatus,
} from "@/types/commission";

export type OperationType =
  | "deposito"
  | "retiro";

export type OperationStatus =
  | "completado"
  | "pendiente"
  | "entregado"
  | "cancelado";

export type Operation = {
  id: string;
  type: OperationType;
  status: OperationStatus;

  bankFolio: string;
  amount: number;
  commission: number;
  total: number;
  appliedCommissionSnapshot?: AppliedCommissionSnapshot;
  commissionLocation?: CommissionLocation;
  commissionStatus?: CommissionStatus;

  senderName: string;
  receiverName: string;

  bankFrom?: string;
  bankTo?: string;

  destinationReference?: string;
  deliveryMethod?:
    | "bank-transfer"
    | "cash-deposit";

  pendingReason?: string;
  pendingReasonDetails?: string;

  observations?: string;

  createdAt: string;
  createdBy: string;

  isEdited?: boolean;
  editedAt?: string;
  editedBy?: string;
};
