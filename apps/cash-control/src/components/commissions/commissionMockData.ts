import type {
  CommissionOperationType,
  CommissionRule,
} from "@/types/commission";

const approvedRanges = [
  [1500, 5099, 500],
  [5100, 10099, 800],
  [10100, 50099, 1000],
  [50100, 100099, 1200],
  [100100, 300099, 1500],
  [300100, 400099, 1800],
  [400100, 500099, 2000],
  [500100, 700099, 2400],
  [700100, 900099, 2700],
  [900100, 1100099, 3800],
  [1100100, 1300099, 4500],
  [1300100, 1500099, 4800],
  [1500100, 1700099, 5800],
  [1700100, 1900099, 6500],
  [1900100, 2100099, 7000],
  [2100100, 2300099, 8000],
  [2300100, 2500000, 9000],
] as const;

export const commissionCoverageNotice =
  "Actualmente no hay comisión configurada para montos menores a $15.00 ni mayores a $25,000.00.";

export const demoAppliedCommissionRuleIds = new Set<string>([
  "deposito-commission-v1-1",
  "retiro-commission-v1-1",
]);

export function createInitialCommissionRules(): CommissionRule[] {
  return [
    ...createRulesForOperationType("deposito"),
    ...createRulesForOperationType("retiro"),
  ];
}

function createRulesForOperationType(
  operationType: CommissionOperationType,
): CommissionRule[] {
  return approvedRanges.map(([min, max, commission], index) => ({
    id: `${operationType}-commission-v1-${index + 1}`,
    operationType,
    minAmountCents: min,
    maxAmountCents: max,
    calculationType: "fixed",
    fixedAmountCents: commission,
    status: "active",
    version: 1,
    validFrom: "2026-08-04T00:00:00.000Z",
    createdBy: "Sistema",
  }));
}
