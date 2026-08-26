const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const editableCurrencyFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function normalizeCurrencyInputValue(value: string): string {
  return value.replace(/[$,\s]/g, "");
}

export function sanitizeCurrencyInputValue(value: string): string {
  const normalizedValue = normalizeCurrencyInputValue(value);
  const [integerPart = "", ...decimalParts] = normalizedValue
    .replace(/[^\d.]/g, "")
    .split(".");
  const decimalPart = decimalParts.join("").slice(0, 2);

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalPart}`;
}

export function formatCurrencyInputValue(value: string): string {
  const normalizedValue = normalizeCurrencyInputValue(value);
  if (normalizedValue === "" || !/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
    return value;
  }

  return editableCurrencyFormatter.format(Number(normalizedValue));
}

export function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return dateTimeFormatter.format(date);
}
