export type CommissionOperationType = "deposito" | "retiro";

export type CommissionCalculationType = "fixed";

export type CommissionRuleStatus =
  | "active"
  | "inactive"
  | "scheduled"
  | "expired";

export type CommissionLocation = "cash" | "bank" | "pending";

export type CommissionStatus =
  | "realized"
  | "reserved"
  | "pending"
  | "pending_location";

export type CommissionRule = {
  id: string;
  operationType: CommissionOperationType;
  minAmountCents: number;
  maxAmountCents: number | null;
  calculationType: "fixed";
  fixedAmountCents: number;
  status: CommissionRuleStatus;
  version: number;
  validFrom: string;
  validTo?: string;
  createdBy: string;
  updatedBy?: string;
  replacedByRuleId?: string;
  hasBeenApplied?: boolean;
};

export type CommissionCalculation = {
  operationAmountCents: number;
  commissionAmountCents: number;
  ruleId: string;
  ruleVersion: number;
  calculationType: "fixed";
};

export type AppliedCommissionSnapshot = {
  operationAmountCents: number;
  calculatedCommissionCents: number;
  finalCommissionCents: number;
  ruleId: string;
  ruleVersion: number;
  calculationType: "fixed";
  location: CommissionLocation;
  appliedAt: string;
};
