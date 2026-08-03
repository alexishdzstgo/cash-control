export type CashClosingStatus =
  | "pending"
  | "in_progress"
  | "balanced"
  | "shortage"
  | "surplus"
  | "review_required";

export type CashMovementCategory =
  | "opening_balance"
  | "cash_deposit"
  | "commission"
  | "delivered_withdrawal"
  | "owner_withdrawal"
  | "authorized_adjustment";

export type CashMovementDirection = "in" | "out";

export type CashMovement = {
  id: string;
  folio: string;
  category: CashMovementCategory;
  direction: CashMovementDirection;
  description: string;
  amount: number;
  registeredAt: string;
  registeredBy: string;
};

export type CashClosingShift = {
  id: string;
  name: string;
  responsibleName: string;
  startedAt: string;
  scheduledEndAt: string;
  currentDuration: string;
};

export type CashClosingData = {
  shift: CashClosingShift;
  openingBalance: number;
  movements: CashMovement[];
  reservedCash: number;
};