import {
  centsToPesos,
  formatCentsToCurrency,
  pesosToCents,
} from "../../src/lib/api-v2/currency";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function assertThrows(fn: () => void, expectedMsgPart: string) {
  let threw = false;
  try {
    fn();
  } catch (err: unknown) {
    threw = true;
    const msg = err instanceof Error ? err.message : String(err);
    if (expectedMsgPart && !msg.includes(expectedMsgPart)) {
      throw new Error(
        `Expected error containing "${expectedMsgPart}", but got: "${msg}"`,
      );
    }
  }
  if (!threw) {
    throw new Error(
      `Expected function to throw "${expectedMsgPart}", but it did not throw.`,
    );
  }
}

console.log("--- INICIANDO PRUEBAS UNITARIAS DE CONVERSIÓN MONETARIA ---");

// 1. Conversiones estándar
assert(pesosToCents(100) === 10000, "100 pesos deben ser 10000 centavos");
assert(pesosToCents(100.5) === 10050, "100.50 pesos deben ser 10050 centavos");
assert(pesosToCents(19.99) === 1999, "19.99 pesos deben ser 1999 centavos");
assert(pesosToCents(0.01) === 1, "0.01 pesos debe ser 1 centavo");
assert(pesosToCents(0) === 0, "0 pesos deben ser 0 centavos");

// 2. Precisión de punto flotante de IEEE 754
const trickySum = 0.1 + 0.2; // 0.30000000000000004
assert(
  pesosToCents(trickySum) === 30,
  "0.1 + 0.2 debe convertirse exactamente a 30 centavos",
);

assert(
  pesosToCents(1.15) === 115,
  "1.15 pesos debe convertirse exactamente a 115 centavos",
);

// 3. Negativos
assertThrows(
  () => pesosToCents(-10),
  "No se permiten importes monetarios negativos",
);
assert(
  pesosToCents(-10.5, true) === -1050,
  "Negativo permitido debe ser -1050",
);

// 4. Invalid numbers
assertThrows(() => pesosToCents(NaN), "finito válido");
assertThrows(() => pesosToCents(Infinity), "finito válido");
assertThrows(() => pesosToCents(-Infinity), "finito válido");

// 5. Cents to Pesos
assert(centsToPesos(10000) === 100, "10000 centavos deben ser 100 pesos");
assert(centsToPesos(10050) === 100.5, "10050 centavos deben ser 100.5 pesos");
assert(centsToPesos(1999) === 19.99, "1999 centavos deben ser 19.99 pesos");
assert(centsToPesos(1) === 0.01, "1 centavo debe ser 0.01 pesos");
assert(centsToPesos(0) === 0, "0 centavos deben ser 0 pesos");

// 6. Cents to Pesos rejects non-integers
assertThrows(() => centsToPesos(100.5), "debe ser un entero finito");
assertThrows(() => centsToPesos(NaN), "debe ser un entero finito");

// 7. Format
const formatted = formatCentsToCurrency(15050);
assert(
  formatted.includes("150.50"),
  `Formato debe incluir 150.50, recibido: ${formatted}`,
);

console.log(
  "✓ TODAS LAS 14 ASERCIONES DE CONVERSIÓN MONETARIA PASARON CON ÉXITO.",
);
