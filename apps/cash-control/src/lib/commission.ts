export type CommissionRange = {
  min: number;
  max: number | null;
  commission: number;
};

export const defaultCommissionRanges: CommissionRange[] = [
  {
    min: 0.01,
    max: 50,
    commission: 5,
  },
  {
    min: 50.01,
    max: 100,
    commission: 8,
  },
  {
    min: 100.01,
    max: 500,
    commission: 10,
  },
  {
    min: 500.01,
    max: 1000,
    commission: 12,
  },
  {
    min: 1000.01,
    max: null,
    commission: 15,
  },
];

export function calculateCommission(
  amount: number,
  ranges: CommissionRange[] = defaultCommissionRanges,
): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  const matchingRange = ranges.find((range) => {
    const isAboveMinimum = amount >= range.min;
    const isBelowMaximum =
      range.max === null || amount <= range.max;

    return isAboveMinimum && isBelowMaximum;
  });

  return matchingRange?.commission ?? 0;
}