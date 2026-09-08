import type { Participant } from "@/components/workstation/types";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { CloseShiftInput, Shift, ShiftClosing } from "@/types/shift";
import { computeFinancialTotalsFromBalances } from "./finance";

export function createInitialShift({
  id,
  openedAt,
  responsible,
  cash,
  banks,
}: {
  id: string;
  openedAt: string;
  responsible: Pick<Participant, "userId" | "userName">;
  cash: CashBalance;
  banks: BankAccountBalance[];
}): Shift {
  const totals = computeFinancialTotalsFromBalances({ cash, banks });
  return {
    id,
    folio: "TUR-000001",
    status: "open",
    openedAt,
    responsibleUserId: responsible.userId,
    responsibleUserName: responsible.userName,
    openingBalances: {
      cashPhysical: totals.cashPhysical,
      cashReserved: totals.cashReserved,
      banks: banks.map((bank) => ({
        bankId: bank.id,
        bankName: bank.bankName,
        balance: bank.realBalance,
      })),
    },
  };
}

export function getShiftResponsible(participants: Participant[]) {
  return participants.find(
    (participant) =>
      participant.status === "active" &&
      participant.participationType === "responsible",
  );
}

export function canCloseShift(
  shift: Shift | null,
  userId: string | undefined,
  participants: Participant[],
): boolean {
  return Boolean(
    shift?.status === "open" &&
      userId &&
      participants.some(
        (participant) =>
          participant.userId === userId &&
          participant.status === "active" &&
          participant.participationType === "responsible",
      ),
  );
}

export function formatShiftDuration(openedAt: string, endedAt: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(endedAt) - Date.parse(openedAt)) / 60000),
  );
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function buildShiftClosing(
  input: CloseShiftInput,
  actor: { userId: string; userName: string },
  closedAt: string,
):
  | { closing: ShiftClosing; error?: never }
  | { closing?: never; error: string } {
  const amounts = [
    input.expectedCashPhysical,
    input.countedCashPhysical,
    input.expectedReservedCash,
    input.countedReservedCash,
    ...input.banks.flatMap((bank) => [
      bank.expectedBalance,
      bank.countedBalance,
    ]),
  ];
  if (
    amounts.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    input.countedReservedCash > input.countedCashPhysical
  ) {
    return {
      error:
        "Captura importes válidos. El apartado es parte del efectivo físico contado.",
    };
  }
  if (
    new Set(input.banks.map((bank) => bank.bankId)).size !== input.banks.length
  ) {
    return { error: "Un banco no puede aparecer más de una vez en el corte." };
  }
  const round = (amount: number) => Math.round(amount * 100) / 100;
  const banks = input.banks.map((bank) => ({
    ...bank,
    difference: round(bank.countedBalance - bank.expectedBalance),
  }));
  const cashDifference = round(
    input.countedCashPhysical - input.expectedCashPhysical,
  );
  const reservedDifference = round(
    input.countedReservedCash - input.expectedReservedCash,
  );
  // Reserved cash is already included in physical cash; never add its difference twice.
  const totalDifference = round(
    cashDifference + banks.reduce((sum, bank) => sum + bank.difference, 0),
  );
  const differences = [
    cashDifference,
    reservedDifference,
    ...banks.map((bank) => bank.difference),
  ];
  const status = differences.every((difference) => difference === 0)
    ? "balanced"
    : totalDifference < 0
      ? "shortage"
      : totalDifference > 0
        ? "surplus"
        : differences.some((difference) => difference < 0)
          ? "shortage"
          : "surplus";
  return {
    closing: {
      status,
      closedAt,
      closedByUserId: actor.userId,
      closedByUserName: actor.userName,
      expectedCashPhysical: input.expectedCashPhysical,
      countedCashPhysical: input.countedCashPhysical,
      expectedReservedCash: input.expectedReservedCash,
      countedReservedCash: input.countedReservedCash,
      banks,
      totalDifference,
      observations: input.observations?.trim() || undefined,
    },
  };
}
