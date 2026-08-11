export type BankOption = {
  value: string;
  label: string;
};

export const bankOptions: BankOption[] = [
  { value: "bank-azteca", label: "Banco Azteca" },
  { value: "bank-bbva", label: "BBVA" },
  { value: "mercado-pago", label: "Mercado Pago" },
  { value: "banamex", label: "Banamex" },
  { value: "banorte", label: "Banorte" },
  { value: "santander", label: "Santander" },
  { value: "otro", label: "Otro banco" },
];

export function getBankLabel(value: string): string {
  const legacyLabels: Record<string, string> = {
    "banco-azteca": "Banco Azteca",
    bbva: "BBVA",
  };

  return (
    bankOptions.find((bank) => bank.value === value)?.label ??
    legacyLabels[value] ??
    "Sin seleccionar"
  );
}
