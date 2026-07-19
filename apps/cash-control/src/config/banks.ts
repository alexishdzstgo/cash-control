export type BankOption = {
  value: string;
  label: string;
};

export const bankOptions: BankOption[] = [
  { value: "banco-azteca", label: "Banco Azteca" },
  { value: "bbva", label: "BBVA" },
  { value: "banamex", label: "Banamex" },
  { value: "banorte", label: "Banorte" },
  { value: "santander", label: "Santander" },
  { value: "otro", label: "Otro banco" },
];

export function getBankLabel(value: string): string {
  return (
    bankOptions.find((bank) => bank.value === value)?.label ??
    "Sin seleccionar"
  );
}