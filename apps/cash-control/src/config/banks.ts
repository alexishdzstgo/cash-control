export type BankOption = {
  value: string;
  label: string;
};

export function getBankLabel(
  banks: { id: string; bankName: string }[],
  value: string,
): string {
  const legacyLabels: Record<string, string> = {
    "banco-azteca": "Banco Azteca",
    bbva: "BBVA",
    "bank-azteca": "Banco Azteca",
    "bank-bbva": "BBVA",
    "mercado-pago": "Mercado Pago",
    banamex: "Banamex",
    banorte: "Banorte",
    santander: "Santander",
    otro: "Otro banco",
  };

  const dbBank = banks.find((bank) => bank.id === value);
  if (dbBank) {
    return dbBank.bankName;
  }

  return legacyLabels[value] ?? "Sin seleccionar";
}
