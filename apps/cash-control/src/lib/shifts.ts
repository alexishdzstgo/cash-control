import type { Participant } from "@/components/workstation/types";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { Shift } from "@/types/shift";
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
