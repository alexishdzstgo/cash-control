/**
 * SUITE DE PRUEBAS DE REGRESIÓN DE SEGURIDAD — CASH-CONTROL V2
 *
 * Demuestra formalmente los 6 controles de seguridad exigidos:
 * 1. Un usuario no autenticado no puede abrir, relevar ni cerrar turnos.
 * 2. Un usuario autenticado no puede operar sobre otra empresa (aislamiento multi-inquilino).
 * 3. Un cliente no puede elegir libremente el claim de identidad del dueño (anti-forgery).
 * 4. El rol restringido cash_control_app no puede modificar directamente los libros mayores ni los saldos.
 * 5. Las operaciones autorizadas de apertura, relevo y cierre continúan funcionando normalmente.
 * 6. La configuración de producción no puede activar una conexión remota accidental.
 */

import { Pool } from "pg";
import { POST as closeRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as joinRoute } from "../../src/app/api/v2/shift/join/route";
import { POST as openRoute } from "../../src/app/api/v2/shift/open/route";
import { createOwnerSessionToken } from "../../src/lib/api-v2/server/auth";
import {
  assertLocalTarget,
  executeV2Rpc,
  getV2LocalPool,
} from "../../src/lib/api-v2/server/db";
import type { OpenShiftResult } from "../../src/lib/api-v2/types";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runSecurityRegressionSuite() {
  console.log(
    "================================================================================",
  );
  console.log(
    "CASH-CONTROL V2: SUITE DE REGRESIÓN DE SEGURIDAD (POSTGRESQL LOCAL)",
  );
  console.log(
    "================================================================================",
  );

  // Fixtures maestras locales
  const BIZ_A = "b9000000-0000-0000-0000-000000000001";
  const OWNER_A = "a9000000-0000-0000-0000-000000000001";
  const WORKSTATION_A = "ca900000-0000-0000-0000-000000000001";
  const OPERATOR_A1 = "ba900000-0000-0000-0000-000000000001"; // Dueño como operador / PIN 0000
  const OPERATOR_A2 = "ba900000-0000-0000-0000-000000000002"; // Cajero / PIN 1111

  const BIZ_B = "b9000000-0000-0000-0000-000000000002";
  const OWNER_B = "a9000000-0000-0000-0000-000000000002";

  // Tokens firmados por el servidor
  const tokenOwnerA = createOwnerSessionToken({
    ownerUserId: OWNER_A,
    businessId: BIZ_A,
  });
  const tokenOwnerB = createOwnerSessionToken({
    ownerUserId: OWNER_B,
    businessId: BIZ_B,
  });

  // Conexión administrativa temporal solo para cleanup determinista
  const adminCleanup = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });
  await adminCleanup.query(
    "UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE status = 'open';",
  );
  await adminCleanup.query(
    "UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'TEST_RESET' WHERE revoked_at IS NULL;",
  );
  await adminCleanup.end();

  // ---------------------------------------------------------------------------
  // CONTROL 1: Usuario no autenticado no puede abrir, relevar ni cerrar turnos
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 1] Verificando que peticiones no autenticadas son bloqueadas...",
  );

  // 1.1 Intento de apertura sin sesión
  const resOpenNoAuth = await openRoute(
    new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
      }),
    }),
  );
  assert(
    resOpenNoAuth.status === 401,
    "Apertura no autenticada debe retornar 401",
  );
  const jsonOpenNoAuth = await resOpenNoAuth.json();
  assert(
    jsonOpenNoAuth.code === "UNAUTHORIZED",
    "Código debe ser UNAUTHORIZED",
  );
  console.log("  ✓ 1.1 Apertura sin sesión rechazada con 401 UNAUTHORIZED.");

  // 1.2 Intento de relevo sin sesión
  const resJoinNoAuth = await joinRoute(
    new Request("http://localhost/api/v2/shift/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A2,
        pin: "1111",
      }),
    }),
  );
  assert(
    resJoinNoAuth.status === 401,
    "Relevo no autenticado debe retornar 401",
  );
  const jsonJoinNoAuth = await resJoinNoAuth.json();
  assert(
    jsonJoinNoAuth.code === "UNAUTHORIZED",
    "Código debe ser UNAUTHORIZED",
  );
  console.log("  ✓ 1.2 Relevo sin sesión rechazado con 401 UNAUTHORIZED.");

  // 1.3 Intento de cierre sin sesión
  const resCloseNoAuth = await closeRoute(
    new Request("http://localhost/api/v2/shift/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
      }),
    }),
  );
  assert(
    resCloseNoAuth.status === 401,
    "Cierre no autenticado debe retornar 401",
  );
  const jsonCloseNoAuth = await resCloseNoAuth.json();
  assert(
    jsonCloseNoAuth.code === "UNAUTHORIZED",
    "Código debe ser UNAUTHORIZED",
  );
  console.log("  ✓ 1.3 Cierre sin sesión rechazado con 401 UNAUTHORIZED.");

  // 1.4 Intento directo en PostgreSQL sin claim (auth.uid() = NULL)
  const directSqlNoAuth = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_A, WORKSTATION_A, OPERATOR_A1, "0000", "TEST-NO-AUTH"],
    // Sin authenticatedUserId => auth.uid() es NULL
  );
  assert(!directSqlNoAuth.ok, "Direct SQL sin auth.uid() debe fallar");
  assert(
    directSqlNoAuth.code === "FORBIDDEN_BUSINESS_ACCESS",
    "PostgreSQL debe rechazar con FORBIDDEN_BUSINESS_ACCESS si auth.uid() es NULL",
  );
  console.log(
    "  ✓ 1.4 Invocación SQL sin auth.uid() rechazada por la función rpc_open_shift.",
  );

  // ---------------------------------------------------------------------------
  // CONTROL 2: Usuario autenticado no puede operar sobre otra empresa
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 2] Verificando aislamiento multi-inquilino (Dueño B sobre Empresa A)...",
  );

  // 2.1 Dueño B intentando abrir turno en Empresa A
  const resCrossBiz = await openRoute(
    new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerB}`, // Sesión legítima pero de Empresa B
      },
      body: JSON.stringify({
        businessId: BIZ_A, // Petición apuntando a Empresa A
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
      }),
    }),
  );
  assert(
    resCrossBiz.status === 403,
    "Operación inter-empresa debe retornar 403",
  );
  const jsonCrossBiz = await resCrossBiz.json();
  assert(
    jsonCrossBiz.code === "FORBIDDEN_BUSINESS_ACCESS",
    "Código debe ser FORBIDDEN_BUSINESS_ACCESS",
  );
  console.log(
    "  ✓ 2.1 Intento de apertura sobre otra empresa bloqueado con 403 FORBIDDEN_BUSINESS_ACCESS.",
  );

  // 2.2 Direct SQL con auth.uid() de Dueño B sobre Empresa A
  const directSqlCrossBiz = await executeV2Rpc<OpenShiftResult>(
    "rpc_open_shift",
    [BIZ_A, WORKSTATION_A, OPERATOR_A1, "0000", "TEST-CROSS-BIZ"],
    { authenticatedUserId: OWNER_B }, // Dueño B
  );
  assert(
    !directSqlCrossBiz.ok,
    "PostgreSQL debe rechazar si auth.uid() no es dueño de BIZ_A",
  );
  assert(
    directSqlCrossBiz.code === "FORBIDDEN_BUSINESS_ACCESS",
    "Código SQL debe ser FORBIDDEN_BUSINESS_ACCESS",
  );
  console.log(
    "  ✓ 2.2 PostgreSQL valida en el motor que auth.uid() coincida con businesses.owner_user_id.",
  );

  // ---------------------------------------------------------------------------
  // CONTROL 3: Un cliente no puede elegir libremente el claim de identidad
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 3] Verificando que clientes no pueden falsificar la identidad del dueño...",
  );

  // 3.1 Petición inyectando "userId", "ownerUserId", "authenticatedUserId" en el body
  const resForgedBody = await openRoute(
    new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
        userId: OWNER_A, // Claim falsificado en el JSON
        ownerUserId: OWNER_A,
        authenticatedUserId: OWNER_A,
      }),
    }),
  );
  assert(
    resForgedBody.status === 401,
    "El servidor DEBE ignorar claims en el body y exigir sesión criptográfica firmada",
  );
  console.log(
    "  ✓ 3.1 Claims de identidad en el cuerpo JSON son totalmente ignorados (401 UNAUTHORIZED).",
  );

  // 3.2 Token con firma HMAC manipulada/inválida
  const tamperedToken =
    tokenOwnerA.substring(0, tokenOwnerA.lastIndexOf(".") + 1) +
    "invalidsignature123";
  const resTamperedToken = await openRoute(
    new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tamperedToken}`,
      },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
      }),
    }),
  );
  assert(
    resTamperedToken.status === 401,
    "Token manipulado debe ser rechazado con 401",
  );
  console.log(
    "  ✓ 3.2 Token manipulado rechazado por verificación de firma HMAC-SHA256.",
  );

  // ---------------------------------------------------------------------------
  // CONTROL 4: Rol restringido (cash_control_app) no puede alterar ledgers ni saldos
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 4] Verificando principio de mínimo privilegio en PostgreSQL...",
  );
  const pool = getV2LocalPool();

  // 4.1 Intento de INSERT directo en financial_ledger_entries
  let ledgerInsertBlocked = false;
  try {
    await pool.query(`
      INSERT INTO public.financial_ledger_entries (
        id, business_id, journal_entry_id, resource_id, entry_sequence,
        amount_cents, direction, balance_after_cents
      ) VALUES (
        gen_random_uuid(), '${BIZ_A}', gen_random_uuid(),
        gen_random_uuid(), 9999, 100000, 'INFLOW', 100000
      );
    `);
  } catch (err: any) {
    ledgerInsertBlocked = true;
    assert(
      err.message.includes("permission denied"),
      `Se esperaba 'permission denied', recibido: ${err.message}`,
    );
  }
  assert(
    ledgerInsertBlocked,
    "INSERT directo en financial_ledger_entries DEBE ser denegado",
  );
  console.log(
    "  ✓ 4.1 INSERT directo en financial_ledger_entries bloqueado por PostgreSQL (permission denied).",
  );

  // 4.2 Intento de UPDATE directo en saldos de treasury_resources
  let balanceUpdateBlocked = false;
  try {
    await pool.query(`
      UPDATE public.treasury_resources
      SET current_balance_cents = 999999999
      WHERE business_id = '${BIZ_A}';
    `);
  } catch (err: any) {
    balanceUpdateBlocked = true;
    assert(
      err.message.includes("permission denied"),
      `Se esperaba 'permission denied', recibido: ${err.message}`,
    );
  }
  assert(balanceUpdateBlocked, "UPDATE directo en saldos DEBE ser denegado");
  console.log(
    "  ✓ 4.2 UPDATE directo sobre saldos de treasury_resources bloqueado (permission denied).",
  );

  // 4.3 Intento de INSERT directo en journal_entries
  let journalInsertBlocked = false;
  try {
    await pool.query(`
      INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type,
        source_entity, concept, occurred_at
      ) VALUES (
        gen_random_uuid(), '${BIZ_A}', gen_random_uuid(), 999,
        'customer_operation', 'manual', 'intento ilegal', now()
      );
    `);
  } catch (err: any) {
    journalInsertBlocked = true;
    assert(
      err.message.includes("permission denied"),
      `Se esperaba 'permission denied', recibido: ${err.message}`,
    );
  }
  assert(
    journalInsertBlocked,
    "INSERT directo en journal_entries DEBE ser denegado",
  );
  console.log(
    "  ✓ 4.3 INSERT directo en journal_entries bloqueado (permission denied).",
  );

  // ---------------------------------------------------------------------------
  // CONTROL 5: Operaciones autorizadas continúan funcionando al 100%
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 5] Verificando ciclo completo legítimo (apertura, relevo, cierre)...",
  );

  // 5.1 Apertura legítima con sesión de Dueño A
  const resOpenLegit = await openRoute(
    new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A1,
        pin: "0000",
        folio: `FOLIO-REGRESSION-${Date.now()}`,
      }),
    }),
  );
  assert(resOpenLegit.status === 200, "Apertura legítima debe devolver 200");
  const jsonOpenLegit = await resOpenLegit.json();
  assert(jsonOpenLegit.ok === true, "Apertura debe ser exitosa");
  const tokenOp1 = jsonOpenLegit.data.session_token;
  console.log(
    `  ✓ 5.1 Turno abierto exitosamente. Token emitido: ${tokenOp1.substring(0, 12)}...`,
  );

  // 5.2 Relevo legítimo
  const resJoinLegit = await joinRoute(
    new Request("http://localhost/api/v2/shift/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A2,
        pin: "1111",
      }),
    }),
  );
  assert(resJoinLegit.status === 200, "Relevo debe responder 200");
  const jsonJoinLegit = await resJoinLegit.json();
  assert(jsonJoinLegit.ok === true, "Relevo debe ser exitoso");
  console.log("  ✓ 5.2 Relevo de cajero completado exitosamente.");

  // 5.3 Cierre legítimo
  const resCloseLegit = await closeRoute(
    new Request("http://localhost/api/v2/shift/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_A,
        workstationId: WORKSTATION_A,
        operatorMemberId: OPERATOR_A2,
        pin: "1111",
      }),
    }),
  );
  assert(resCloseLegit.status === 200, "Cierre debe responder 200");
  const jsonCloseLegit = await resCloseLegit.json();
  assert(jsonCloseLegit.ok === true, "Cierre debe ser exitoso");
  console.log(
    "  ✓ 5.3 Turno cerrado exitosamente y sesiones de terminal revocadas.",
  );

  // ---------------------------------------------------------------------------
  // CONTROL 6: Imposibilidad de conexión remota accidental
  // ---------------------------------------------------------------------------
  console.log(
    "\n[CONTROL 6] Verificando protección contra conexiones remotas o producción...",
  );

  let supabaseBlocked = false;
  try {
    assertLocalTarget(
      "https://lnzhxntfzjvblnmangzp.supabase.co",
      "cash_control_test",
    );
  } catch (err: any) {
    supabaseBlocked = true;
    assert(
      err.message.includes("FATAL SECURITY VIOLATION"),
      "Debe arrojar violación fatal",
    );
  }
  assert(supabaseBlocked, "Conexión a Supabase Cloud debe ser abortada");
  console.log("  ✓ 6.1 Intento hacia Supabase Cloud abortado antes de socket.");

  let remoteHostBlocked = false;
  try {
    assertLocalTarget("db.production.corporate.com", "cash_control_test");
  } catch (err: any) {
    remoteHostBlocked = true;
    assert(
      err.message.includes("FATAL SECURITY VIOLATION"),
      "Debe arrojar violación fatal",
    );
  }
  assert(
    remoteHostBlocked,
    "Conexión a host remoto corporativo debe ser abortada",
  );
  console.log("  ✓ 6.2 Host remoto no local abortado antes de socket.");

  let nonTestDbBlocked = false;
  try {
    assertLocalTarget("127.0.0.1", "production_live_db");
  } catch (err: any) {
    nonTestDbBlocked = true;
    assert(
      err.message.includes("FATAL SECURITY VIOLATION"),
      "Debe arrojar violación fatal",
    );
  }
  assert(
    nonTestDbBlocked,
    "Conexión a base distinta a cash_control_test debe ser abortada",
  );
  console.log(
    "  ✓ 6.3 Base de datos distinta a cash_control_test abortada antes de socket.",
  );

  console.log(
    "\n================================================================================",
  );
  console.log(
    "✓ RESULTADO: LOS 6 CONTROLES DE REGRESIÓN DE SEGURIDAD PASARON AL 100%.",
  );
  console.log(
    "================================================================================",
  );
}

runSecurityRegressionSuite().catch((err) => {
  console.error("FATAL ERROR EN SUITE DE SEGURIDAD:", err);
  process.exit(1);
});
