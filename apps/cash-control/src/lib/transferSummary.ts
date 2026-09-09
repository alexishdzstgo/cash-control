import type { Participant } from "@/components/workstation/types";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { Operation } from "@/types/operation";
import type { Shift } from "@/types/shift";

export type TransferSummary = {
  shiftFolio: string;
  currentResponsibleName: string;
  transferTime: string;
  cashOnHand: number;
  bankBalances: Array<{ bankId: string; bank: string; balance: number }>;
  pendingWithdrawals: { count: number; total: number };
  pendingDeposits: { count: number; total: number };
  editedOperations: number;
  operationsInShift: number;
};

export function buildTransferSummary({
  currentShift,
  cash,
  banks,
  operations,
  participants,
  now = new Date(),
}: {
  currentShift: Shift | null;
  cash: CashBalance;
  banks: BankAccountBalance[];
  operations: Operation[];
  participants: Participant[];
  now?: Date;
}): TransferSummary | null {
  if (!currentShift) return null;
  const pending = (type: Operation["type"]) => {
    const records = operations.filter(
      (operation) =>
        operation.type === type && operation.status === "pendiente",
    );
    return {
      count: records.length,
      total: records.reduce((sum, operation) => sum + operation.amount, 0),
    };
  };
  return {
    shiftFolio: currentShift.folio,
    currentResponsibleName:
      participants.find(
        (participant) =>
          participant.status === "active" &&
          participant.participationType === "responsible",
      )?.userName ?? "Sin responsable activo",
    transferTime: now.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashOnHand: cash.physicalBalance,
    bankBalances: banks.map((bank) => ({
      bankId: bank.id,
      bank: bank.bankName,
      balance: bank.realBalance,
    })),
    pendingWithdrawals: pending("retiro"),
    pendingDeposits: pending("deposito"),
    editedOperations: operations
      .flatMap((operation) => operation.corrections ?? [])
      .filter((correction) => correction.shiftId === currentShift.id).length,
    operationsInShift: operations.filter(
      (operation) => operation.shiftId === currentShift.id,
    ).length,
  };
}
