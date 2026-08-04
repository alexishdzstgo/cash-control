import {
  cashBalance,
  bankAccounts,
} from "@/components/balances/balanceMockData";
import type { BankAccountBalance } from "@/types/balance";

export type FinancialTotals = {
  totalControlled: number;
  totalReserved: number;
  totalAvailable: number;
  cashAvailable: number;
  cashReserved: number;
  cashPhysical: number;
  banksAvailable: number;
  banksReal: number;
  banksReserved: number;
};

export type BankMovementAlert = {
  bankId: string;
  bankName: string;
  remainingVisibleMovements: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
};

export function computeFinancialTotals(): FinancialTotals {
  const cashPhysical = cashBalance.physicalBalance;
  const cashReserved = cashBalance.reservedOperations.reduce(
    (sum, op) => sum + op.amount,
    0,
  );

  const banksReal = bankAccounts.reduce(
    (sum, bank) => sum + bank.realBalance,
    0,
  );
  const banksReserved = bankAccounts.reduce(
    (sum, bank) =>
      sum +
      bank.reservedOperations.reduce((ops, op) => ops + op.amount, 0),
    0,
  );

  const totalControlled = cashPhysical + banksReal;
  const totalReserved = cashReserved + banksReserved;
  const totalAvailable = totalControlled - totalReserved;

  return {
    totalControlled,
    totalReserved,
    totalAvailable,
    cashAvailable: cashPhysical - cashReserved,
    cashReserved,
    cashPhysical,
    banksAvailable: banksReal - banksReserved,
    banksReal,
    banksReserved,
  };
}

/** Calcula alertas de límite de movimientos visibles por banco */
export function computeBankMovementAlerts(): BankMovementAlert[] {
  return bankAccounts.flatMap((bank: BankAccountBalance) => {
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
          remaining > 0 &&
          ratio >= (bank.movementWarningThreshold ?? 0.8),
      },
    ];
  });
}