/**
 * Conversión monetaria centralizada para Cash-Control v2.
 *
 * REGLAS CONTABLES:
 * 1. Toda persistencia contable en la base de datos se realiza en CENTAVOS ENTEROS (BIGINT).
 * 2. La interfaz de usuario muestra y captura PESOS con hasta 2 decimales.
 * 3. Las conversiones deben evitar imprecisiones de coma flotante de IEEE 754 (ej. 0.1 + 0.2 = 0.30000000000000004).
 * 4. Toda conversión hacia centavos redondea al entero más próximo (Math.round).
 * 5. Se rechazan valores no finitos (NaN, Infinity), negativos (a menos que se indique explícitamente)
 *    o que excedan el límite seguro de enteros (Number.MAX_SAFE_INTEGER).
 */

export class CurrencyConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrencyConversionError";
  }
}

/**
 * Convierte un importe en pesos (ej. 150.50) a centavos enteros (15050).
 *
 * @param pesos Importe en pesos a convertir.
 * @param allowNegative Si se permiten importes negativos (por defecto false).
 * @returns Centavos enteros exactos.
 */
export function pesosToCents(pesos: number, allowNegative = false): number {
  if (typeof pesos !== "number" || !Number.isFinite(pesos)) {
    throw new CurrencyConversionError(
      `El importe en pesos debe ser un número finito válido. Recibido: ${pesos}`,
    );
  }

  if (Number.isNaN(pesos)) {
    throw new CurrencyConversionError("El importe en pesos no puede ser NaN.");
  }

  if (!allowNegative && pesos < 0) {
    throw new CurrencyConversionError(
      `No se permiten importes monetarios negativos. Recibido: ${pesos}`,
    );
  }

  // Multiplicamos por 100 y redondeamos para eliminar artefactos flotantes
  const cents = Math.round(pesos * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new CurrencyConversionError(
      `El importe en centavos resultante excede el límite seguro: ${cents}`,
    );
  }

  // Prevenir -0 en JavaScript
  return cents === 0 ? 0 : cents;
}

/**
 * Convierte centavos enteros (ej. 15050) a pesos (150.50).
 *
 * @param cents Centavos enteros a convertir.
 * @returns Importe en pesos con hasta 2 decimales.
 */
export function centsToPesos(cents: number): number {
  if (
    typeof cents !== "number" ||
    !Number.isFinite(cents) ||
    !Number.isInteger(cents)
  ) {
    throw new CurrencyConversionError(
      `El valor en centavos debe ser un entero finito válido. Recibido: ${cents}`,
    );
  }

  return cents / 100;
}

/**
 * Formatea un importe en centavos enteros como moneda nacional (MXN).
 *
 * @param cents Centavos enteros.
 * @returns Cadena con formato "$1,234.56 MXN".
 */
export function formatCentsToCurrency(cents: number): string {
  const pesos = centsToPesos(cents);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}
