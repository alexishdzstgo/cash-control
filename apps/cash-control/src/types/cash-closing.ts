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
  | "cash_commission"
  | "bank_commission"
  | "delivered_withdrawal"
  | "business_fund_income"
  | "business_fund_withdrawal";

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
  sourceType?: "operation" | "administrative_movement" | "reserved_withdrawal";
  sourceId?: string;
  bankName?: string;
  customerName?: string;
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

export type CashMovementCategorySummary = {
  category: CashMovementCategory;
  label: string;
  helperText: string;
  total: number;
  count: number;
  direction: CashMovementDirection;
  movements: CashMovement[];
};

export type CommissionLocationBreakdownItem = {
  id: string;
  label: string;
  amount: number;
  count: number;
  movements: CashMovement[];
};

export type ShiftCommissionProfitSummary = {
  totalCommissionProfit: number;
  cashCommissionProfit: number;
  bankCommissionProfit: number;
  depositCommissionProfit: number;
  withdrawalCommissionProfit: number;
  bankBreakdown: CommissionLocationBreakdownItem[];
  cashMovements: CashMovement[];
  bankMovements: CashMovement[];
};

export type ReservedCashSummary = {
  total: number;
  movements: CashMovement[];
};

export type CashClosingStory = {
  openingBalance: number;
  entries: CashMovementCategorySummary[];
  outputs: CashMovementCategorySummary[];
  allMovements: CashMovement[];
  totalEntries: number;
  totalOutputs: number;
  expectedCash: number;
  reservedCash: ReservedCashSummary;
  availableCash: number;
  commissionProfit: ShiftCommissionProfitSummary;
};
