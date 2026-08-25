import {
  bankAccounts,
  cashBalance,
} from "@/components/balances/balanceMockData";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { Operation } from "@/types/operation";

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

export type OperationFinancialImpact = {
  cashDelta: number;
  bankDeltas: Array<{
    bankId: string;
    amount: number;
  }>;
};

const bankIdAliases: Record<string, string> = {
  "Banco Azteca": "bank-azteca",
  "banco-azteca": "bank-azteca",
  BBVA: "bank-bbva",
  bbva: "bank-bbva",
  "Mercado Pago": "mercado-pago",
};

export function getOperationFinancialImpact(
  operation: Operation,
): OperationFinancialImpact {
  const bankId = resolveOperationBankId(operation);
  const commission = operation.commission ?? 0;

  if (operation.type === "deposito") {
    return {
      cashDelta: operation.amount + commission,
      bankDeltas: bankId ? [{ bankId, amount: -operation.amount }] : [],
    };
  }

  if (operation.withdrawalCommissionMode === "cash") {
    return {
      cashDelta: -operation.amount + commission,
      bankDeltas: bankId ? [{ bankId, amount: operation.amount }] : [],
    };
  }

  if (operation.withdrawalCommissionMode === "deducted") {
    return {
      cashDelta: -(
        operation.customerCashReceived ?? operation.amount - commission
      ),
      bankDeltas: bankId ? [{ bankId, amount: operation.amount }] : [],
    };
  }

  return {
    cashDelta: -operation.amount,
    bankDeltas: bankId
      ? [{ bankId, amount: operation.amount + commission }]
      : [],
  };
}

export function applyOperationFinancialImpact({
  cash,
  banks,
  operation,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  operation: Operation;
}): { cash: CashBalance; banks: BankAccountBalance[] } {
  const impact = getOperationFinancialImpact(operation);

  return {
    cash: {
      ...cash,
      physicalBalance: cash.physicalBalance + impact.cashDelta,
    },
    banks: banks.map((bank) => {
      const bankDelta = impact.bankDeltas
        .filter((delta) => delta.bankId === bank.id)
        .reduce((sum, delta) => sum + delta.amount, 0);

      return bankDelta === 0
        ? bank
        : { ...bank, realBalance: bank.realBalance + bankDelta };
    }),
  };
}

export function validateOperationFinancialImpact({
  cash,
  banks,
  operation,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  operation: Operation;
}): string | null {
  const impact = getOperationFinancialImpact(operation);

  if (cash.physicalBalance + impact.cashDelta < 0) {
    return "No hay efectivo suficiente en caja para registrar esta operación.";
  }

  for (const delta of impact.bankDeltas) {
    const bank = banks.find((item) => item.id === delta.bankId);
    if (!bank) {
      return "Selecciona un banco disponible.";
    }

    if (bank.realBalance + delta.amount < 0) {
      return `No hay saldo suficiente en ${bank.bankName} para registrar esta operación.`;
    }
  }

  return null;
}

export function computeFinancialTotals(): FinancialTotals {
  return computeFinancialTotalsFromBalances({
    cash: cashBalance,
    banks: bankAccounts,
  });
}

function resolveOperationBankId(operation: Operation): string | null {
  const bankReference =
    operation.bankResourceId ??
    (operation.type === "deposito" ? operation.bankTo : operation.bankFrom) ??
    "";

  return bankIdAliases[bankReference] ?? (bankReference || null);
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
    if (
      bank.visibleMovementTrackingEnabled &&
      limit !== undefined &&
      used !== undefined
    ) {
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

    if (health.status === "critical") {
      resourceStatus = "critical";
      attentionReasons.push("critical_balance");
    } else if (health.status === "warning") {
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
  const status = getBalanceAlertStatus({
    available,
    lowBalanceThreshold,
    criticalBalanceThreshold,
  });

  return {
    status,
    isLow: status !== "normal",
    isCritical: status === "critical",
  };
}

export function getBalanceAlertStatus({
  available,
  lowBalanceThreshold,
  criticalBalanceThreshold,
}: {
  available: number;
  lowBalanceThreshold?: number;
  criticalBalanceThreshold?: number;
}): BalanceHealthStatus {
  if (
    criticalBalanceThreshold !== undefined &&
    available < criticalBalanceThreshold
  ) {
    return "critical";
  }
  if (lowBalanceThreshold !== undefined && available < lowBalanceThreshold) {
    return "warning";
  }
  return "normal";
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

    if (
      !bank.visibleMovementTrackingEnabled ||
      limit === undefined ||
      used === undefined
    ) {
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
