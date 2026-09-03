import type {
  AppliedCommissionSnapshot,
  CommissionLocation,
  CommissionStatus,
} from "@/types/commission";
import type { WithdrawalCommissionMode } from "@/types/withdrawal";

export type OperationType = "deposito" | "retiro";

export type OperationStatus =
  | "completado"
  | "pendiente"
  | "entregado"
  | "cancelado";

export type OperationClarification = {
  id: string;
  reason: string;
  note: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
};

export type OperationCorrectionSnapshot = {
  amount: number;
  commission: number;
  total: number;
  bankFolio: string;
  bankResourceId?: string;
  bankFrom?: string;
  bankTo?: string;
  destinationAccountLast4?: string;
  destinationReference?: string;
  receiverName: string;
  withdrawalCommissionMode?: WithdrawalCommissionMode;
  customerCashReceived?: number;
  bankMovementAmount?: number;
  appliedCommissionSnapshot?: AppliedCommissionSnapshot;
};

export type OperationCorrection = {
  id: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  before: OperationCorrectionSnapshot;
  after: OperationCorrectionSnapshot;
};

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
  bankResourceId?: string;

  destinationReference?: string;
  destinationAccountLast4?: string;
  deliveryMethod?: "bank-transfer" | "cash-deposit";
  withdrawalCommissionMode?: WithdrawalCommissionMode;
  customerCashReceived?: number;
  bankMovementAmount?: number;

  pendingReason?: string;
  pendingReasonDetails?: string;

  observations?: string;

  createdAt: string;
  createdBy: string;

  isEdited?: boolean;
  editedAt?: string;
  editedBy?: string;
  clarifications?: OperationClarification[];
  corrections?: OperationCorrection[];
};
