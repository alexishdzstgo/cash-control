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

export type BankClosingMovementDirection = "in" | "out";

export type BankClosingMovement = {
  id: string;
  folio: string;
  bankId: string;
  bankName: string;
  direction: BankClosingMovementDirection;
  description: string;
  amount: number;
  registeredAt: string;
  registeredBy: string;
  sourceType?: "operation" | "administrative_movement";
  sourceId?: string;
  customerName?: string;
};

export type BankClosingStory = {
  bankId: string;
  bankName: string;
  accountName: string;
  openingBalance: number;
  entries: BankClosingMovement[];
  outputs: BankClosingMovement[];
  totalEntries: number;
  totalOutputs: number;
  expectedBalance: number;
};

export type FinancialTimelineImpact = {
  resourceId: string;
  resourceName: string;
  resourceType: "cash" | "reserved_cash" | "bank";
  before: number;
  amount: number;
  after: number;
  detail?: string;
};

export type FinancialTimelineEvent = {
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "reserved_cash_allocation"
    | "business_fund_income"
    | "business_fund_withdrawal";
  title: string;
  badge: string;
  occurredAt: string;
  actor: string;
  description: string;
  details: Array<{
    label: string;
    value: string;
  }>;
  impacts: FinancialTimelineImpact[];
  commissionInfo?: string;
  note?: string;
};

export type FinancialTimelineBankBalance = {
  bankId: string;
  bankName: string;
  accountName: string;
  initialBalance: number;
  finalBalance: number;
};

export type FinancialTimeline = {
  initialCash: number;
  initialReservedCash: number;
  initialAvailableCash: number;
  initialBanks: FinancialTimelineBankBalance[];
  events: FinancialTimelineEvent[];
  finalCash: number;
  finalReservedCash: number;
  finalAvailableCash: number;
  finalBanks: FinancialTimelineBankBalance[];
  totalBanks: number;
  totalControlled: number;
  reconstructionIssues: string[];
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
  bankStories: BankClosingStory[];
  timeline: FinancialTimeline;
  commissionProfit: ShiftCommissionProfitSummary;
};
