import type { BankAccountBalance, CashBalance } from "@/types/balance";

export const cashBalance: CashBalance = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Caja física",
  physicalBalance: 0,
  lowBalanceThreshold: 3000,
  criticalBalanceThreshold: 1000,
  reservedOperations: [],
  shiftName: "Turno matutino",
  responsibleName: "Ana López",
  updatedAt: "Día 1",
};

export const bankAccounts: BankAccountBalance[] = [
  {
    id: "bank-azteca",
    bankName: "Banco Azteca",
    accountName: "Cuenta principal",
    realBalance: 0,
    reservedOperations: [],
    status: "available",
    visibleMovementTrackingEnabled: true,
    visibleMovementLimit: 60,
    visibleMovementsUsed: 0,
    movementWarningThreshold: 0.8,
    lowBalanceThreshold: 5000,
    criticalBalanceThreshold: 2000,
    rawAccountName: "Cuenta principal",
    rawAccountLastDigits: "0000",
  },
  {
    id: "bank-bbva",
    bankName: "BBVA",
    accountName: "Cuenta principal",
    realBalance: 0,
    reservedOperations: [],
    status: "available",
    lowBalanceThreshold: 3000,
    criticalBalanceThreshold: 1000,
    rawAccountName: "Cuenta principal",
    rawAccountLastDigits: "0000",
  },
  {
    id: "mercado-pago",
    bankName: "Mercado Pago",
    accountName: "Cuenta principal",
    realBalance: 0,
    reservedOperations: [],
    status: "available",
    rawAccountName: "Cuenta principal",
    rawAccountLastDigits: "0000",
  },
];

export function buildInitialZeroCash(): CashBalance {
  return {
    ...cashBalance,
    physicalBalance: 0,
    reservedOperations: [],
    updatedAt: "Día 1",
  };
}

export function buildInitialZeroBanks(): BankAccountBalance[] {
  return bankAccounts.map((bank) => ({
    ...bank,
    realBalance: 0,
    reservedOperations: [],
    visibleMovementsUsed: bank.visibleMovementTrackingEnabled
      ? 0
      : bank.visibleMovementsUsed,
  }));
}
