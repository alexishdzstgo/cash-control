import type { BankAccountBalance } from "@/types/balance";

export type ShiftReconciliationInput = {
  countedCashPhysical: number;
  banks: Array<{ bankId: string; countedBalance: number }>;
};

export function validateShiftReconciliation(
  input: ShiftReconciliationInput,
  banks: BankAccountBalance[],
): string | null {
  if (
    [
      input.countedCashPhysical,
      ...input.banks.map((bank) => bank.countedBalance),
    ].some((amount) => !Number.isFinite(amount) || amount < 0)
  )
    return "Captura saldos contados finitos y no negativos.";
  const ids = new Set(input.banks.map((bank) => bank.bankId));
  if (
    ids.size !== input.banks.length ||
    input.banks.length !== banks.length ||
    banks.some((bank) => !ids.has(bank.id))
  )
    return "El conteo debe incluir exactamente una vez cada banco existente.";
  return null;
}
