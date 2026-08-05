import {
  bankAccounts,
  cashBalance,
} from "@/components/balances/balanceMockData";
import type { BankAccountBalance, CashBalance } from "@/types/balance";

export type BalanceHealthStatus = "normal" | "warning" | "critical";

export type BalanceHealth = {
  status: BalanceHealthStatus;
  isLow: boolean;
  isCritical: boolean;
};

export type FinancialResourceStatus = "normal" | "warning" | "critical";

export type AttentionReason =
  | "low_balance"
  | "critical_balance"
  | "movement_limit_warning"
  | "movement_limit_reached";

export type BankBreakdownItem = {
  bankId: string;
  bankName: string;
  realBalance: number;
  reserved: number;
  available: number;
  lowBalanceThreshold?: number;
  criticalBalanceThreshold?: number;
  balanceStatus: BalanceHealthStatus;
  isLow: boolean;
  isCritical: boolean;
  /** Estado visual combinado (saldo + movimientos) */
  resourceStatus: FinancialResourceStatus;
  /** Motivos de atención visual */
  attentionReasons: AttentionReason[];
};

export type FinancialTotals = {
  totalControlled: number;
  totalReserved: number;
  totalAvailable: number;
  cashAvailable: number;
  cashReserved: number;
  cashPhysical: number;
  cashBalanceStatus: BalanceHealthStatus;
  cashIsLow: boolean;
  cashIsCritical: boolean;
  banksAvailable: number;
  banksReal: number;
  banksReserved: number;
  banksAvailableTotal: number;
  banksReservedTotal: number;
  bankBreakdown: BankBreakdownItem[];
};

export type BankMovementAlert = {
  bankId: string;
  bankName: string;
  remainingVisibleMovements: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
};

export function computeFinancialTotals(): FinancialTotals {
  return computeFinancialTotalsFromBalances({
    cash: cashBalance,
    banks: bankAccounts,
  });
}

export function computeFinancialTotalsFromBalances({
  cash,
  banks,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
}): FinancialTotals {
  const cashPhysical = cash.physicalBalance;
  const cashReserved = cash.reservedOperations.reduce(
    (sum, op) => sum + op.amount,
    0,
  );
  const cashAvailable = cashPhysical - cashReserved;
  const cashHealth = getBalanceHealth({
    available: cashAvailable,
    lowBalanceThreshold: cash.lowBalanceThreshold,
    criticalBalanceThreshold: cash.criticalBalanceThreshold,
  });

  const bankBreakdown: BankBreakdownItem[] = banks.map((bank) => {
    const reserved = bank.reservedOperations.reduce(
      (ops, op) => ops + op.amount,
      0,
    );
    const available = bank.realBalance - reserved;
    const health = getBalanceHealth({
      available,
      lowBalanceThreshold: bank.lowBalanceThreshold,
      criticalBalanceThreshold: bank.criticalBalanceThreshold,
    });

    // Movement limit state
    const limit = bank.visibleMovementLimit;
    const used = bank.visibleMovementsUsed;
    let movementStatus: FinancialResourceStatus = "normal";
    let movementReason: AttentionReason | null = null;
    if (limit !== undefined && used !== undefined) {
      const remaining = Math.max(0, limit - used);
      const ratio = limit > 0 ? used / limit : 0;
      if (remaining <= 0) {
        movementStatus = "critical";
        movementReason = "movement_limit_reached";
      } else if (ratio >= (bank.movementWarningThreshold ?? 0.8)) {
        movementStatus = "warning";
        movementReason = "movement_limit_warning";
      }
    }

    // Combined status: critical > warning > normal
    const attentionReasons: AttentionReason[] = [];
    let resourceStatus: FinancialResourceStatus = "normal";

    if (health.isCritical) {
      resourceStatus = "critical";
      attentionReasons.push("critical_balance");
    } else if (health.isLow) {
      resourceStatus = "warning";
      attentionReasons.push("low_balance");
    }

    if (movementStatus === "critical") {
      resourceStatus = "critical";
      if (movementReason) attentionReasons.push(movementReason);
    } else if (movementStatus === "warning") {
      if (resourceStatus !== "critical") resourceStatus = "warning";
      if (movementReason) attentionReasons.push(movementReason);
    }

    return {
      bankId: bank.id,
      bankName: bank.bankName,
      realBalance: bank.realBalance,
      reserved,
      available,
      lowBalanceThreshold: bank.lowBalanceThreshold,
      criticalBalanceThreshold: bank.criticalBalanceThreshold,
      balanceStatus: health.status,
      isLow: health.isLow,
      isCritical: health.isCritical,
      resourceStatus,
      attentionReasons,
    };
  });

  const banksReal = bankBreakdown.reduce(
    (sum, bank) => sum + bank.realBalance,
    0,
  );
  const banksReserved = bankBreakdown.reduce(
    (sum, bank) => sum + bank.reserved,
    0,
  );

  const totalControlled = cashPhysical + banksReal;
  const totalReserved = cashReserved + banksReserved;
  const totalAvailable = totalControlled - totalReserved;

  return {
    totalControlled,
    totalReserved,
    totalAvailable,
    cashAvailable,
    cashReserved,
    cashPhysical,
    cashBalanceStatus: cashHealth.status,
    cashIsLow: cashHealth.isLow,
    cashIsCritical: cashHealth.isCritical,
    banksAvailable: banksReal - banksReserved,
    banksReal,
    banksReserved,
    banksAvailableTotal: banksReal - banksReserved,
    banksReservedTotal: banksReserved,
    bankBreakdown,
  };
}

export function getBalanceHealth({
  available,
  lowBalanceThreshold,
  criticalBalanceThreshold,
}: {
  available: number;
  lowBalanceThreshold?: number;
  criticalBalanceThreshold?: number;
}): BalanceHealth {
  if (
    criticalBalanceThreshold !== undefined &&
    available <= criticalBalanceThreshold
  ) {
    return { status: "critical", isLow: true, isCritical: true };
  }
  if (lowBalanceThreshold !== undefined && available <= lowBalanceThreshold) {
    return { status: "warning", isLow: true, isCritical: false };
  }
  return { status: "normal", isLow: false, isCritical: false };
}

/** Calcula alertas de límite de movimientos visibles por banco */
export function computeBankMovementAlerts(): BankMovementAlert[] {
  return computeBankMovementAlertsFromBanks(bankAccounts);
}

export function computeBankMovementAlertsFromBanks(
  banks: BankAccountBalance[],
): BankMovementAlert[] {
  return banks.flatMap((bank: BankAccountBalance) => {
    const limit = bank.visibleMovementLimit;
    const used = bank.visibleMovementsUsed;

    if (limit === undefined || used === undefined) {
      return [];
    }

    const remaining = Math.max(0, limit - used);
    const ratio = limit > 0 ? used / limit : 0;

    return [
      {
        bankId: bank.id,
        bankName: bank.bankName,
        remainingVisibleMovements: remaining,
        isAtLimit: remaining <= 0,
        isNearLimit:
          remaining > 0 && ratio >= (bank.movementWarningThreshold ?? 0.8),
      },
    ];
  });
}
