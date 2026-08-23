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
  /** Configuración por cuenta para controlar límites de movimientos visibles. */
  visibleMovementTrackingEnabled?: boolean;
  /** Límite de movimientos visibles permitidos por el banco */
  visibleMovementLimit?: number;
  /** Movimientos visibles utilizados en el mes */
  visibleMovementsUsed?: number;
  /** Umbral (0-1) para alertar cuando se acerca al límite */
  movementWarningThreshold?: number;
  /** Umbral de saldo bajo (disponible) */
  lowBalanceThreshold?: number;
  /** Umbral de saldo crítico (disponible) */
  criticalBalanceThreshold?: number;
};

export type CashBalance = {
  physicalBalance: number;
  reservedOperations: ReservedOperation[];
  shiftName: string;
  responsibleName: string;
  updatedAt: string;
  /** Umbral de saldo bajo (disponible) */
  lowBalanceThreshold?: number;
  /** Umbral de saldo crítico (disponible) */
  criticalBalanceThreshold?: number;
};
