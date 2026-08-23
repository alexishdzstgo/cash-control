import type {
  BalanceHealthStatus,
  BankMovementAlert,
  FinancialResourceStatus,
  FinancialTotals,
} from "@/lib/finance";
import { getBalanceHealth } from "@/lib/finance";
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
  movementWarningRemaining?: number;
  visibleMovementTrackingEnabled?: boolean;
  alerts: FinancialAlert[];
};

export type AlertResourceConfig = {
  lowBalanceThreshold?: number;
  criticalBalanceThreshold?: number;
  visibleMovementLimit?: number;
  visibleMovementsUsed?: number;
  movementWarningRemaining?: number;
  visibleMovementTrackingEnabled?: boolean;
};

export type FinancialAlertConfig = {
  cash: AlertResourceConfig;
  banks: Record<string, AlertResourceConfig>;
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
  config,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  totals: FinancialTotals;
  movementAlerts: BankMovementAlert[];
  config?: FinancialAlertConfig;
}): FinancialAlertsOverview {
  const cashLowBalanceThreshold =
    config?.cash.lowBalanceThreshold ?? cash.lowBalanceThreshold;
  const cashCriticalBalanceThreshold =
    config?.cash.criticalBalanceThreshold ?? cash.criticalBalanceThreshold;
  const cashHealth = getBalanceHealth({
    available: totals.cashAvailable,
    lowBalanceThreshold: cashLowBalanceThreshold,
    criticalBalanceThreshold: cashCriticalBalanceThreshold,
  });
  const cashStatus: FinancialResourceStatus = cashHealth.isCritical
    ? "critical"
    : cashHealth.isLow
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
      lowBalanceThreshold: cashLowBalanceThreshold,
      criticalBalanceThreshold: cashCriticalBalanceThreshold,
      balanceStatus: cashHealth.status,
      status: cashStatus,
      alerts: [],
    },
    ...totals.bankBreakdown.map((bank) => {
      const account = banks.find((item) => item.id === bank.bankId);
      const bankConfig = config?.banks[bank.bankId] ?? {};
      const visibleMovementTrackingEnabled =
        bankConfig.visibleMovementTrackingEnabled ??
        account?.visibleMovementTrackingEnabled === true;
      const lowBalanceThreshold =
        bankConfig.lowBalanceThreshold ?? bank.lowBalanceThreshold;
      const criticalBalanceThreshold =
        bankConfig.criticalBalanceThreshold ?? bank.criticalBalanceThreshold;
      const visibleMovementLimit = visibleMovementTrackingEnabled
        ? (bankConfig.visibleMovementLimit ?? account?.visibleMovementLimit)
        : undefined;
      const visibleMovementsUsed = visibleMovementTrackingEnabled
        ? (bankConfig.visibleMovementsUsed ?? account?.visibleMovementsUsed)
        : undefined;
      const movementWarningRemaining = visibleMovementTrackingEnabled
        ? bankConfig.movementWarningRemaining
        : undefined;
      const balanceHealth = getBalanceHealth({
        available: bank.available,
        lowBalanceThreshold,
        criticalBalanceThreshold,
      });
      const remainingVisibleMovements = getRemainingMovements({
        visibleMovementLimit,
        visibleMovementsUsed,
      });
      const movementStatus = getMovementStatus({
        remainingVisibleMovements,
        visibleMovementLimit,
        visibleMovementsUsed,
        movementWarningRemaining,
      });
      const status = mergeStatuses(balanceHealth.status, movementStatus);

      return {
        id: bank.bankId,
        name: bank.bankName,
        type: "bank" as const,
        available: bank.available,
        reserved: bank.reserved,
        realBalance: bank.realBalance,
        lowBalanceThreshold,
        criticalBalanceThreshold,
        balanceStatus: balanceHealth.status,
        status,
        visibleMovementLimit,
        visibleMovementsUsed,
        remainingVisibleMovements,
        movementWarningRemaining,
        visibleMovementTrackingEnabled,
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

  const movementAlert =
    movementAlerts.find((alert) => alert.bankId === resource.id) ??
    getMovementAlertForResource(resource);

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

function getRemainingMovements({
  visibleMovementLimit,
  visibleMovementsUsed,
}: {
  visibleMovementLimit?: number;
  visibleMovementsUsed?: number;
}): number | undefined {
  if (
    visibleMovementLimit === undefined ||
    visibleMovementsUsed === undefined
  ) {
    return undefined;
  }

  return Math.max(0, visibleMovementLimit - visibleMovementsUsed);
}

function getMovementStatus({
  remainingVisibleMovements,
  visibleMovementLimit,
  visibleMovementsUsed,
  movementWarningRemaining,
}: {
  remainingVisibleMovements?: number;
  visibleMovementLimit?: number;
  visibleMovementsUsed?: number;
  movementWarningRemaining?: number;
}): FinancialResourceStatus {
  if (
    remainingVisibleMovements === undefined ||
    visibleMovementLimit === undefined ||
    visibleMovementsUsed === undefined
  ) {
    return "normal";
  }

  if (remainingVisibleMovements <= 0) return "critical";

  if (movementWarningRemaining !== undefined) {
    return remainingVisibleMovements <= movementWarningRemaining
      ? "warning"
      : "normal";
  }

  return visibleMovementLimit > 0 &&
    visibleMovementsUsed / visibleMovementLimit >= 0.8
    ? "warning"
    : "normal";
}

function getMovementAlertForResource(
  resource: FinancialResourceView,
): BankMovementAlert | undefined {
  if (
    resource.type !== "bank" ||
    !resource.visibleMovementTrackingEnabled ||
    resource.remainingVisibleMovements === undefined
  ) {
    return undefined;
  }

  return {
    bankId: resource.id,
    bankName: resource.name,
    remainingVisibleMovements: resource.remainingVisibleMovements,
    isAtLimit: resource.remainingVisibleMovements <= 0,
    isNearLimit:
      resource.remainingVisibleMovements > 0 &&
      resource.movementWarningRemaining !== undefined &&
      resource.remainingVisibleMovements <= resource.movementWarningRemaining,
  };
}

function mergeStatuses(
  balanceStatus: BalanceHealthStatus,
  movementStatus: FinancialResourceStatus,
): FinancialResourceStatus {
  if (balanceStatus === "critical" || movementStatus === "critical") {
    return "critical";
  }
  if (balanceStatus === "warning" || movementStatus === "warning") {
    return "warning";
  }
  return "normal";
}
