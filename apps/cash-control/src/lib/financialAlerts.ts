import type {
  BalanceHealthStatus,
  BankMovementAlert,
  FinancialResourceStatus,
  FinancialTotals,
} from "@/lib/finance";
import type { BankAccountBalance, CashBalance } from "@/types/balance";

export type FinancialAlertSeverity = "warning" | "critical";

export type FinancialAlertType =
  | "low_balance"
  | "critical_balance"
  | "movement_limit_warning"
  | "movement_limit_reached";

export type FinancialAlert = {
  resourceId: string;
  resourceName: string;
  resourceType: "cash" | "bank";
  type: FinancialAlertType;
  severity: FinancialAlertSeverity;
  available: number;
  threshold?: number;
  remainingVisibleMovements?: number;
  reason: string;
};

export type FinancialResourceView = {
  id: string;
  name: string;
  type: "cash" | "bank";
  available: number;
  reserved: number;
  realBalance: number;
  lowBalanceThreshold?: number;
  criticalBalanceThreshold?: number;
  balanceStatus: BalanceHealthStatus;
  status: FinancialResourceStatus;
  visibleMovementLimit?: number;
  visibleMovementsUsed?: number;
  remainingVisibleMovements?: number;
  alerts: FinancialAlert[];
};

export type FinancialAlertsOverview = {
  resources: FinancialResourceView[];
  alerts: FinancialAlert[];
  normalResources: number;
  warningResources: number;
  criticalResources: number;
  activeAlerts: number;
};

export function getFinancialAlertsOverview({
  cash,
  banks,
  totals,
  movementAlerts,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  totals: FinancialTotals;
  movementAlerts: BankMovementAlert[];
}): FinancialAlertsOverview {
  const cashStatus: FinancialResourceStatus = totals.cashIsCritical
    ? "critical"
    : totals.cashIsLow
      ? "warning"
      : "normal";

  const resources: FinancialResourceView[] = [
    {
      id: "cash",
      name: "Caja física",
      type: "cash",
      available: totals.cashAvailable,
      reserved: totals.cashReserved,
      realBalance: totals.cashPhysical,
      lowBalanceThreshold: cash.lowBalanceThreshold,
      criticalBalanceThreshold: cash.criticalBalanceThreshold,
      balanceStatus: totals.cashBalanceStatus,
      status: cashStatus,
      alerts: [],
    },
    ...totals.bankBreakdown.map((bank) => {
      const account = banks.find((item) => item.id === bank.bankId);
      const movementAlert = movementAlerts.find(
        (alert) => alert.bankId === bank.bankId,
      );

      return {
        id: bank.bankId,
        name: bank.bankName,
        type: "bank" as const,
        available: bank.available,
        reserved: bank.reserved,
        realBalance: bank.realBalance,
        lowBalanceThreshold: bank.lowBalanceThreshold,
        criticalBalanceThreshold: bank.criticalBalanceThreshold,
        balanceStatus: bank.balanceStatus,
        status: bank.resourceStatus,
        visibleMovementLimit: account?.visibleMovementLimit,
        visibleMovementsUsed: account?.visibleMovementsUsed,
        remainingVisibleMovements:
          movementAlert?.remainingVisibleMovements ??
          getRemainingMovements(account),
        alerts: [],
      };
    }),
  ];

  const alerts = resources.flatMap((resource) =>
    getAlertsForResource(resource, movementAlerts),
  );

  const resourcesWithAlerts = resources.map((resource) => ({
    ...resource,
    alerts: alerts.filter((alert) => alert.resourceId === resource.id),
  }));

  return {
    resources: resourcesWithAlerts,
    alerts,
    normalResources: resourcesWithAlerts.filter(
      (resource) => resource.status === "normal",
    ).length,
    warningResources: resourcesWithAlerts.filter(
      (resource) => resource.status === "warning",
    ).length,
    criticalResources: resourcesWithAlerts.filter(
      (resource) => resource.status === "critical",
    ).length,
    activeAlerts: alerts.length,
  };
}

function getAlertsForResource(
  resource: FinancialResourceView,
  movementAlerts: BankMovementAlert[],
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];

  if (
    resource.balanceStatus === "critical" &&
    resource.criticalBalanceThreshold !== undefined
  ) {
    alerts.push({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      type: "critical_balance",
      severity: "critical",
      available: resource.available,
      threshold: resource.criticalBalanceThreshold,
      reason: "Saldo crítico.",
    });
  } else if (
    resource.balanceStatus === "warning" &&
    resource.lowBalanceThreshold !== undefined
  ) {
    alerts.push({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      type: "low_balance",
      severity: "warning",
      available: resource.available,
      threshold: resource.lowBalanceThreshold,
      reason: "Saldo disponible bajo.",
    });
  }

  const movementAlert = movementAlerts.find(
    (alert) => alert.bankId === resource.id,
  );

  if (movementAlert?.isAtLimit) {
    alerts.push({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      type: "movement_limit_reached",
      severity: "critical",
      available: resource.available,
      remainingVisibleMovements: movementAlert.remainingVisibleMovements,
      reason: "Límite de movimientos alcanzado.",
    });
  } else if (movementAlert?.isNearLimit) {
    alerts.push({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      type: "movement_limit_warning",
      severity: "warning",
      available: resource.available,
      remainingVisibleMovements: movementAlert.remainingVisibleMovements,
      reason: `${movementAlert.remainingVisibleMovements} movimientos visibles restantes.`,
    });
  }

  return alerts;
}

function getRemainingMovements(account?: BankAccountBalance): number | undefined {
  if (
    account?.visibleMovementLimit === undefined ||
    account.visibleMovementsUsed === undefined
  ) {
    return undefined;
  }

  return Math.max(0, account.visibleMovementLimit - account.visibleMovementsUsed);
}
