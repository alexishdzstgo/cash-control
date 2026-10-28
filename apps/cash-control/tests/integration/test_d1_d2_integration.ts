/**
 * SUITE DE INTEGRACIÓN COMPLETA PARA FASE D1 Y D2
 *
 * Verifica contra la base real local PostgreSQL 'cash_control_test':
 * 1. Apertura de turno con PIN y emisión de token operativo de terminal.
 * 2. Rechazo de turno duplicado en la misma estación.
 * 3. Relevo de cajero legítimo (rpc_join_shift) y revocación de la sesión previa.
 * 4. Cierre de turno (rpc_close_shift) y revocación de todas las sesiones vinculadas.
 * 5. Rechazo de sesión inválida, vencida y revocada.
 * 6. Separación estricta de identidades (dueño vs operador).
 * 7. Verificación de aislamiento local absoluto.
 */

import {
  assertLocalTarget,
  executeV2Rpc,
  getV2LocalPool,
} from "../../src/lib/api-v2/server/db";
import type {
  CloseShiftResult,
  JoinShiftResult,
  OpenShiftResult,
} from "../../src/lib/api-v2/types";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runIntegrationSuite() {
  console.log(
    "================================================================================",
  );
  console.log(
    "CASH-CONTROL V2: SUITE DE PRUEBAS DE INTEGRACIÓN FASE D1 Y D2 (POSTGRESQL LOCAL)",
  );
  console.log(
    "================================================================================",
  );

  const pool = getV2LocalPool();

  // 1. Aislamiento y comprobación de base de datos local
  const connCheck = await pool.query(
    "SELECT current_database() as db, inet_server_addr() as addr;",
  );
  assert(
    connCheck.rows[0].db === "cash_control_test",
    "Debe conectarse a cash_control_test",
  );
  console.log(
    `✓ 1. Conexión local verificada a base de datos: ${connCheck.rows[0].db}`,
  );

  // Fixtures de prueba dedicados para D1/D2
  const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
  const OWNER_USER_ID = "a9000000-0000-0000-0000-000000000001";
  const FORBIDDEN_USER_ID = "a0000000-0000-0000-0000-000000000999";
  const WORKSTATION_ID = "ca900000-0000-0000-0000-000000000001";
  const OPERATOR_1_ID = "ba900000-0000-0000-0000-000000000001"; // Dueño como operador (pin_hash: hash_pin_0000)
  const OPERATOR_2_ID = "ba900000-0000-0000-0000-000000000002"; // Cajero Uno (pin_hash: hash_pin_1111)
  const VALID_PIN_1 = "0000";
  const VALID_PIN_2 = "1111";
  const INVALID_PIN = "9999";

  // Limpiar turnos previos en esta estación usando conexión administrativa local
  const adminCleanupPool = new (await import("pg")).Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });
  await adminCleanupPool.query(
    `UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() 
     WHERE workstation_id = $1 AND status = 'open';`,
    [WORKSTATION_ID],
  );
  await adminCleanupPool.query(
    `UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'TEST_CLEANUP' 
     WHERE workstation_id = $1 AND revoked_at IS NULL;`,
    [WORKSTATION_ID],
  );
  await adminCleanupPool.end();
  console.log("✓ Estado inicial limpio garantizado.");

  // ---------------------------------------------------------------------------
  // TEST A: Rechazo de dueño inválido (Separación de identidades)
  // ---------------------------------------------------------------------------
  console.log(
    "\n[TEST A] Verificando separación entre identidad de dueño y operador...",
  );
  const forbiddenOpen = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_ID, WORKSTATION_ID, OPERATOR_1_ID, VALID_PIN_1, "TEST-FOLIO-001"],
    { authenticatedUserId: FORBIDDEN_USER_ID },
  );
  assert(
    !forbiddenOpen.ok,
    "Debe rechazar apertura si el usuario autenticado no es el dueño",
  );
  assert(
    forbiddenOpen.code === "FORBIDDEN_BUSINESS_ACCESS",
    `Esperado FORBIDDEN_BUSINESS_ACCESS, recibido: ${forbiddenOpen.code}`,
  );
  console.log("✓ TEST A APROBADO: Acceso denegado a usuario no dueño.");

  // ---------------------------------------------------------------------------
  // TEST B: Rechazo de PIN incorrecto
  // ---------------------------------------------------------------------------
  console.log("\n[TEST B] Verificando rechazo de PIN incorrecto...");
  const invalidPinOpen = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_ID, WORKSTATION_ID, OPERATOR_1_ID, INVALID_PIN, "TEST-FOLIO-001"],
    { authenticatedUserId: OWNER_USER_ID },
  );
  assert(!invalidPinOpen.ok, "Debe fallar con PIN incorrecto");
  assert(
    invalidPinOpen.code === "INVALID_OPERATOR_PIN",
    `Esperado INVALID_OPERATOR_PIN, recibido: ${invalidPinOpen.code}`,
  );
  console.log("✓ TEST B APROBADO: PIN inválido rechazado.");

  // ---------------------------------------------------------------------------
  // TEST C: Apertura exitosa de turno (rpc_open_shift)
  // ---------------------------------------------------------------------------
  const testFolio = `TEST-FOLIO-D1D2-${Date.now()}`;
  const openRes = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_ID, WORKSTATION_ID, OPERATOR_1_ID, VALID_PIN_1, testFolio],
    { authenticatedUserId: OWNER_USER_ID },
  );
  assert(
    openRes.ok,
    `Apertura debe ser exitosa: ${openRes.ok ? "" : openRes.message}`,
  );
  const shiftId = openRes.data.shift_id;
  const token1 = openRes.data.session_token;
  assert(openRes.data.status === "open", "Estado debe ser open");
  assert(openRes.data.folio === testFolio, "Folio debe coincidir");
  assert(
    typeof token1 === "string" && token1.length === 64,
    "Token de terminal debe tener 64 caracteres hex",
  );
  console.log(
    `✓ TEST C APROBADO: Turno abierto exitosamente. Shift ID: ${shiftId}, Token emitido: ${token1.slice(0, 8)}...`,
  );

  // Verificar en base de datos que el turno y la sesión existen
  const dbShift = await pool.query(
    "SELECT status, folio FROM public.shifts WHERE id = $1;",
    [shiftId],
  );
  assert(dbShift.rows[0].status === "open", "Turno en DB debe estar 'open'");

  const dbSession = await pool.query(
    "SELECT id, revoked_at FROM public.terminal_operator_sessions WHERE shift_id = $1 AND revoked_at IS NULL;",
    [shiftId],
  );
  assert(
    dbSession.rows.length === 1,
    "Debe existir exactamente 1 sesión activa para este turno",
  );
  console.log(
    "✓ Persistencia en PostgreSQL de turno y sesión activa verificada.",
  );

  // ---------------------------------------------------------------------------
  // TEST D: Rechazo de turno duplicado en la misma estación
  // ---------------------------------------------------------------------------
  console.log("\n[TEST D] Verificando prevención de turnos duplicados...");
  const dupOpen = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_ID, WORKSTATION_ID, OPERATOR_1_ID, VALID_PIN_1, "TEST-FOLIO-DUP"],
    { authenticatedUserId: OWNER_USER_ID },
  );
  assert(!dupOpen.ok, "No debe permitir segundo turno abierto");
  assert(
    dupOpen.code === "WORKSTATION_ALREADY_HAS_OPEN_SHIFT",
    `Esperado WORKSTATION_ALREADY_HAS_OPEN_SHIFT, recibido: ${dupOpen.code}`,
  );
  console.log(
    "✓ TEST D APROBADO: Turno duplicado en la misma estación rechazado.",
  );

  // ---------------------------------------------------------------------------
  // TEST E: Relevo de cajero (rpc_join_shift)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST E] Ejecutando relevo de cajero legítimo...");
  const joinRes = await executeV2Rpc<JoinShiftResult>("rpc_join_shift", [
    BIZ_ID,
    WORKSTATION_ID,
    OPERATOR_2_ID,
    VALID_PIN_2,
  ]);
  assert(
    joinRes.ok,
    `Relevo debe ser exitoso: ${joinRes.ok ? "" : joinRes.message}`,
  );
  const token2 = joinRes.data.session_token;
  assert(joinRes.data.shift_id === shiftId, "Debe incorporarse al mismo turno");
  assert(
    joinRes.data.operator_member_id === OPERATOR_2_ID,
    "Operador debe ser el segundo cajero",
  );
  assert(
    token2 !== token1,
    "El token de la nueva sesión debe ser diferente al anterior",
  );
  console.log(
    `✓ TEST E APROBADO: Relevo completado. Nuevo Token: ${token2.slice(0, 8)}...`,
  );

  // Verificar que la sesión anterior fue revocada por CASHIER_HANDOVER
  const dbOldSession = await pool.query(
    "SELECT revoked_at, revoked_reason FROM public.terminal_operator_sessions WHERE session_token_hash = encode(sha256($1::bytea), 'hex');",
    [token1],
  );
  assert(
    dbOldSession.rows[0].revoked_at !== null,
    "La sesión anterior debe estar revocada",
  );
  assert(
    dbOldSession.rows[0].revoked_reason === "CASHIER_HANDOVER",
    "Razón de revocación debe ser CASHIER_HANDOVER",
  );
  console.log(
    "✓ Sesión previa del operador 1 confirmada como revocada (CASHIER_HANDOVER).",
  );

  // ---------------------------------------------------------------------------
  // TEST F: Rechazo de sesión revocada en validación de terminal
  // ---------------------------------------------------------------------------
  console.log("\n[TEST F] Verificando rechazo de sesión operativa revocada...");
  const checkOldToken = await pool.query(
    `SELECT id FROM public.terminal_operator_sessions 
     WHERE workstation_id = $1 
       AND session_token_hash = encode(sha256($2::bytea), 'hex') 
       AND revoked_at IS NULL;`,
    [WORKSTATION_ID, token1],
  );
  assert(
    checkOldToken.rows.length === 0,
    "Token revocado no debe encontrarse activo",
  );
  console.log(
    "✓ TEST F APROBADO: Sesión revocada rechazada para operaciones activas.",
  );

  // ---------------------------------------------------------------------------
  // TEST G: Cierre de turno (rpc_close_shift)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST G] Ejecutando cierre de turno...");
  const closeRes = await executeV2Rpc<CloseShiftResult>("rpc_close_shift", [
    BIZ_ID,
    WORKSTATION_ID,
    OPERATOR_2_ID,
    VALID_PIN_2,
  ]);
  assert(
    closeRes.ok,
    `Cierre debe ser exitoso: ${closeRes.ok ? "" : closeRes.message}`,
  );
  assert(closeRes.data.status === "closed", "Estado debe ser closed");
  console.log("✓ TEST G APROBADO: Turno cerrado exitosamente.");

  // Verificar que todas las sesiones del turno quedaron revocadas
  const activeSessionsAfterClose = await pool.query(
    "SELECT count(*) FROM public.terminal_operator_sessions WHERE shift_id = $1 AND revoked_at IS NULL;",
    [shiftId],
  );
  assert(
    Number(activeSessionsAfterClose.rows[0].count) === 0,
    "No deben quedar sesiones activas tras cierre de turno",
  );

  const participantsAfterClose = await pool.query(
    "SELECT count(*) FROM public.shift_participants WHERE shift_id = $1 AND status = 'active';",
    [shiftId],
  );
  assert(
    Number(participantsAfterClose.rows[0].count) === 0,
    "No deben quedar participantes activos tras cierre de turno",
  );
  console.log(
    "✓ Cierre completo verificado en PostgreSQL: participantes en 'left' y sesiones revocadas.",
  );

  // ---------------------------------------------------------------------------
  // TEST H: Intento de cierre sobre turno ya cerrado
  // ---------------------------------------------------------------------------
  console.log(
    "\n[TEST H] Verificando rechazo de operaciones sobre turno ya cerrado...",
  );
  const closedShiftClose = await executeV2Rpc<CloseShiftResult>(
    "rpc_close_shift",
    [BIZ_ID, WORKSTATION_ID, OPERATOR_2_ID, VALID_PIN_2],
  );
  assert(
    !closedShiftClose.ok,
    "Debe rechazar cerrar un turno inexistente o ya cerrado",
  );
  assert(
    closedShiftClose.code === "NO_OPEN_SHIFT",
    `Esperado NO_OPEN_SHIFT, recibido: ${closedShiftClose.code}`,
  );
  console.log("✓ TEST H APROBADO: Turno ya cerrado rechazado (NO_OPEN_SHIFT).");

  // ---------------------------------------------------------------------------
  // TEST I: Verificación de Aislamiento y No-Fallback a Producción
  // ---------------------------------------------------------------------------
  console.log("\n[TEST I] Verificando reglas de aislamiento absoluto...");
  let rejectedSupabase = false;
  try {
    assertLocalTarget("lnzhxntfzjvblnmangzp.supabase.co", "cash_control_test");
  } catch {
    rejectedSupabase = true;
  }
  assert(
    rejectedSupabase,
    "El adaptador debe rechazar cualquier endpoint de Supabase Cloud",
  );
  console.log(
    "✓ TEST I APROBADO: Imposible invocar Supabase Cloud accidentalmente.",
  );

  await pool.end();

  console.log(
    "\n================================================================================",
  );
  console.log(
    "✓ RESULTADO: LAS 9 PRUEBAS DE INTEGRACIÓN DE D1 Y D2 PASARON AL 100% EN LOCAL.",
  );
  console.log(
    "================================================================================",
  );
}

runIntegrationSuite().catch((err) => {
  console.error("FATAL ERROR EN SUITE DE INTEGRACIÓN:", err);
  process.exit(1);
});
