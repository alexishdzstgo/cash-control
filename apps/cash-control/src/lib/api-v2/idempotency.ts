/**
 * Generador y gestor de claves de idempotencia para Cash-Control v2.
 *
 * REGLAS:
 * 1. Cada operación lógica (ej. enviar formulario de depósito) genera exactamente UNA clave UUID v4.
 * 2. Si ocurre un fallo de red o timeout y el cliente reintenta la misma operación lógica,
 *    debe REENVIAR la misma clave para que PostgreSQL devuelva la respuesta original sin duplicar el asiento.
 * 3. Si el usuario cancela o inicia una operación distinta, se descarta y genera una nueva.
 */

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback seguro si crypto.randomUUID no está disponible en entornos antiguos
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gestor de reintentos con preservación de clave de idempotencia.
 */
export class IdempotentOperation {
  private key: string;
  private attemptCount = 0;

  constructor(existingKey?: string) {
    this.key = existingKey || generateIdempotencyKey();
  }

  public getKey(): string {
    return this.key;
  }

  public registerAttempt(): number {
    this.attemptCount += 1;
    return this.attemptCount;
  }

  public getAttempts(): number {
    return this.attemptCount;
  }

  public reset(): string {
    this.key = generateIdempotencyKey();
    this.attemptCount = 0;
    return this.key;
  }
}
