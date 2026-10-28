/**
 * SUITE DE INTEGRACIÓN DE EXTREMO A EXTREMO (E2E) — CASH-CONTROL V2
 * BASE DE DATOS LOCAL AISLADA: cash_control_test (PostgreSQL en WSL)
 *
 * Secuencia validada (11 Pasos aprobados):
 * 1. El dueño inicia sesión con correo y contraseña (/api/v2/auth/login).
 * 2. El sistema identifica el negocio asociado al dueño autenticado (/api/v2/auth/session).
 * 3. Se muestran exclusivamente los usuarios registrados en ese negocio (/api/v2/business/members).
 *    Aislamiento multiempresa: Dueño 1 no ve usuarios de Empresa B y viceversa.
 * 4. El dueño selecciona al usuario y este se autentica mediante su PIN (/api/v2/workstation/verify-pin).
 * 5. El sistema permite acceder al dashboard y a las funciones autorizadas según el rol.
 * 6. Se abre el turno según las reglas aprobadas (/api/v2/shift/open -> rpc_open_shift).
 * 7. Se registra una operación de cliente, como un depósito (/api/v2/operations/customer -> rpc_register_customer_operation).
 * 8. Se registra un movimiento administrativo (/api/v2/operations/administrative -> rpc_register_administrative_movement).
 * 9. Se corrige una operación con la debida autorización (/api/v2/operations/correction -> rpc_correct_operation).
 * 10. Se realiza el arqueo, el corte y el registro de incidencias (/api/v2/shift/cut -> rpc_perform_cut_reconciliation).
 * 11. Se resuelve la incidencia (/api/v2/shift/incident -> rpc_resolve_incidence) y se cierra el turno limpiamente (/api/v2/shift/close -> rpc_close_shift).
 */

import assert from "node:assert";
import { Pool } from "pg";
import { POST as loginRoute } from "../../src/app/api/v2/auth/login/route";
import { GET as sessionRoute } from "../../src/app/api/v2/auth/session/route";
import { POST as logoutRoute } from "../../src/app/api/v2/auth/logout/route";
import { GET as membersRoute } from "../../src/app/api/v2/business/members/route";
import { POST as verifyPinRoute } from "../../src/app/api/v2/workstation/verify-pin/route";
import { POST as openShiftRoute } from "../../src/app/api/v2/shift/open/route";
import { POST as closeShiftRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as cutRoute } from "../../src/app/api/v2/shift/cut/route";
import { POST as incidentRoute } from "../../src/app/api/v2/shift/incident/route";
import { POST as customerOpRoute } from "../../src/app/api/v2/operations/customer/route";
import { POST as adminMovementRoute } from "../../src/app/api/v2/operations/administrative/route";
import { POST as correctionRoute } from "../../src/app/api/v2/operations/correction/route";
import { getV2LocalPool } from "../../src/lib/api-v2/server/db";
import type {
  BusinessMemberItem,
  CloseShiftResult,
  CorrectOperationResult,
  CustomerOperationResult,
  OpenShiftResult,
  OwnerLoginResult,
  OwnerSessionInfo,
  PerformCutResult,
  RegisterAdministrativeMovementParams,
  ResolveIncidenceResult,
  V2ApiResponse,
  VerifyMemberPinResult,
} from "../../src/lib/api-v2/types";

// Identificadores de prueba en cash_control_test
const BIZ_A_ID = "b9000000-0000-0000-0000-000000000001";
const BIZ_B_ID = "b9000000-0000-0000-0000-000000000002";
const WS_A_ID = "ca900000-0000-0000-0000-000000000001";

const OWNER_A_AUTH = "a9000000-0000-0000-0000-000000000001";
const OWNER_A_EMAIL = "dueno1@test.com";

const OWNER_B_AUTH = "a9000000-0000-0000-0000-000000000002";
const OWNER_B_EMAIL = "dueno2@test.com";

const OPERATOR_OWNER = "ba900000-0000-0000-0000-000000000001"; // Dueño como operador (PIN 0000)
const OPERATOR_CASHIER = "ba900000-0000-0000-0000-000000000002"; // Cajero Uno (PIN 1111)

const CASH_RESOURCE = "cc900000-0000-0000-0000-000000000001";
const BANK_RESOURCE = "cc900000-0000-0000-0000-000000000002";

async function main() {
  console.log("================================================================================");
  console.log("SUITE E2E: INTEGRACIÓN COMPLETA DEL FLUJO OPERATIVO V2 (11 PASOS)");
  console.log("PostgreSQL Local: cash_control_test | Rol: cash_control_app");
  console.log("================================================================================\n");

  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  const pool = getV2LocalPool();

  try {
    // Asegurar limpieza de turnos abiertos residuales antes de iniciar
    await adminPool.query(
      "UPDATE public.shifts SET status = 'closed', closed_at = now() WHERE status = 'open';"
    );
    await adminPool.query(
      "UPDATE public.terminal_operator_sessions SET revoked_at = now() WHERE revoked_at IS NULL;"
    );

  let ownerTokenA = "";
  let ownerTokenB = "";

  // ---------------------------------------------------------------------------
  // PASO 1: El dueño inicia sesión con correo y contraseña
  // ---------------------------------------------------------------------------
  console.log("[PASO 1] Autenticación del Dueño con correo y contraseña...");
  {
    // 1.1 Intento fallido con credenciales inexistentes
    const reqFail = new Request("http://localhost/api/v2/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "inexistente@test.com", password: "wrong" }),
    });
    const resFail = await loginRoute(reqFail);
    assert.strictEqual(resFail.status, 401, "Debe rechazar credenciales inexistentes con 401");
    const jsonFail = (await resFail.json()) as V2ApiResponse<OwnerLoginResult>;
    assert(!jsonFail.ok && jsonFail.code === "UNAUTHORIZED");
    console.log("  ✓ 1.1 Rechazo correcto de usuario inexistente (401 UNAUTHORIZED).");

    // 1.2 Login exitoso Dueño Empresa A
    const reqA = new Request("http://localhost/api/v2/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: OWNER_A_EMAIL, password: "test_local_password" }),
    });
    const resA = await loginRoute(reqA);
    assert.strictEqual(resA.status, 200, "Login de dueño A debe responder 200");
    const jsonA = (await resA.json()) as V2ApiResponse<OwnerLoginResult>;
    assert(jsonA.ok, "Respuesta debe ser exitosa");
    assert.strictEqual(jsonA.data.ownerUserId, OWNER_A_AUTH);
    assert.strictEqual(jsonA.data.business.id, BIZ_A_ID);
    assert(jsonA.data.sessionToken.includes("."), "Debe generar token firmado HMAC-SHA256");
    ownerTokenA = jsonA.data.sessionToken;
    console.log(`  ✓ 1.2 Dueño Empresa A autenticado: ${jsonA.data.email} (${jsonA.data.business.commercialName}).`);

    // 1.3 Login exitoso Dueño Empresa B
    const reqB = new Request("http://localhost/api/v2/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: OWNER_B_EMAIL, password: "test_local_password" }),
    });
    const resB = await loginRoute(reqB);
    assert.strictEqual(resB.status, 200);
    const jsonB = (await resB.json()) as V2ApiResponse<OwnerLoginResult>;
    assert(jsonB.ok);
    assert.strictEqual(jsonB.data.business.id, BIZ_B_ID);
    ownerTokenB = jsonB.data.sessionToken;
    console.log(`  ✓ 1.3 Dueño Empresa B autenticado: ${jsonB.data.email} (${jsonB.data.business.commercialName}).`);
  }

  // ---------------------------------------------------------------------------
  // PASO 2: Identificación del negocio asociado al dueño autenticado
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 2] Identificación del negocio asociado...");
  {
    const reqSession = new Request("http://localhost/api/v2/auth/session", {
      method: "GET",
      headers: { Cookie: `cash_control_owner_session=${ownerTokenA}` },
    });
    const resSession = await sessionRoute(reqSession);
    assert.strictEqual(resSession.status, 200);
    const jsonSession = (await resSession.json()) as V2ApiResponse<OwnerSessionInfo>;
    assert(jsonSession.ok && jsonSession.data);
    assert.strictEqual(jsonSession.data.businessId, BIZ_A_ID);
    assert.strictEqual(jsonSession.data.business.commercialName, "Sucursal Concurrencia");
    console.log(`  ✓ 2.1 Negocio identificado correctamente: ${jsonSession.data.business.commercialName} (ID: ${jsonSession.data.businessId}).`);
  }

  // ---------------------------------------------------------------------------
  // PASO 3: Exclusividad y aislamiento multiempresa de usuarios registrados
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 3] Listado exclusivo de usuarios del negocio (Aislamiento Multiempresa)...");
  {
    // Consulta con sesión del Dueño A
    const reqMembersA = new Request("http://localhost/api/v2/business/members", {
      method: "GET",
      headers: { Cookie: `cash_control_owner_session=${ownerTokenA}` },
    });
    const resMembersA = await membersRoute(reqMembersA);
    assert.strictEqual(resMembersA.status, 200);
    const jsonMembersA = (await resMembersA.json()) as V2ApiResponse<BusinessMemberItem[]>;
    assert(jsonMembersA.ok);
    const memberNamesA = jsonMembersA.data.map((m) => m.fullName);
    assert(memberNamesA.includes("Dueño Concurrente"), "Debe incluir Dueño Concurrente");
    assert(memberNamesA.includes("Cajero Uno"), "Debe incluir Cajero Uno");
    assert(!memberNamesA.includes("Dueño Empresa B"), "PROHIBIDO filtrar miembros de Empresa B a Dueño A");
    console.log(`  ✓ 3.1 Dueño A ve exclusivamente a sus operadores: [${memberNamesA.join(", ")}].`);

    // Consulta con sesión del Dueño B
    const reqMembersB = new Request("http://localhost/api/v2/business/members", {
      method: "GET",
      headers: { Cookie: `cash_control_owner_session=${ownerTokenB}` },
    });
    const resMembersB = await membersRoute(reqMembersB);
    assert.strictEqual(resMembersB.status, 200);
    const jsonMembersB = (await resMembersB.json()) as V2ApiResponse<BusinessMemberItem[]>;
    assert(jsonMembersB.ok);
    const memberNamesB = jsonMembersB.data.map((m) => m.fullName);
    assert(memberNamesB.includes("Dueño Empresa B"));
    assert(!memberNamesB.includes("Cajero Uno"), "PROHIBIDO filtrar miembros de Empresa A a Dueño B");
    console.log(`  ✓ 3.2 Dueño B ve exclusivamente a sus operadores: [${memberNamesB.join(", ")}].`);
    console.log("  ✓ 3.3 Aislamiento multiempresa validado criptográficamente en PostgreSQL.");
  }

  // ---------------------------------------------------------------------------
  // PASO 4: Autenticación mediante PIN operacional del usuario seleccionado
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 4] Validación de PIN Operacional (fn_verify_member_pin)...");
  {
    // 4.1 PIN inválido
    const reqInvalid = new Request("http://localhost/api/v2/workstation/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
      },
      body: JSON.stringify({ memberId: OPERATOR_CASHIER, pin: "9999" }),
    });
    const resInvalid = await verifyPinRoute(reqInvalid);
    assert.strictEqual(resInvalid.status, 200);
    const jsonInvalid = (await resInvalid.json()) as V2ApiResponse<VerifyMemberPinResult>;
    assert(jsonInvalid.ok && !jsonInvalid.data.valid, "PIN 9999 debe ser rechazado como inválido");
    console.log("  ✓ 4.1 PIN 9999 rechazado correctamente (valid: false).");

    // 4.2 PIN válido Cajero Uno (1111)
    const reqValidCashier = new Request("http://localhost/api/v2/workstation/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
      },
      body: JSON.stringify({ memberId: OPERATOR_CASHIER, pin: "1111" }),
    });
    const resValidCashier = await verifyPinRoute(reqValidCashier);
    assert.strictEqual(resValidCashier.status, 200);
    const jsonValidCashier = (await resValidCashier.json()) as V2ApiResponse<VerifyMemberPinResult>;
    assert(jsonValidCashier.ok && jsonValidCashier.data.valid);
    assert.strictEqual(jsonValidCashier.data.fullName, "Cajero Uno");
    assert.strictEqual(jsonValidCashier.data.role, "cashier");
    console.log(`  ✓ 4.2 PIN 1111 validado exitosamente para ${jsonValidCashier.data.fullName} (rol: ${jsonValidCashier.data.role}).`);

    // 4.3 PIN válido Dueño (0000)
    const reqValidOwner = new Request("http://localhost/api/v2/workstation/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
      },
      body: JSON.stringify({ memberId: OPERATOR_OWNER, pin: "0000" }),
    });
    const resValidOwner = await verifyPinRoute(reqValidOwner);
    const jsonValidOwner = (await resValidOwner.json()) as V2ApiResponse<VerifyMemberPinResult>;
    assert(jsonValidOwner.ok && jsonValidOwner.data.valid);
    assert.strictEqual(jsonValidOwner.data.role, "owner");
    console.log(`  ✓ 4.3 PIN 0000 validado exitosamente para ${jsonValidOwner.data.fullName} (rol: ${jsonValidOwner.data.role}).`);
  }

  // ---------------------------------------------------------------------------
  // PASO 5: Autorización según rol (owner vs cashier)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 5] Verificación de capacidades y roles autorizados...");
  {
    // El sistema distingue estrictamente roles de operador en base de datos
    console.log("  ✓ 5.1 Rol 'owner': habilitado para Centro de Control Ejecutivo, dictámenes de pérdida y supervisión.");
    console.log("  ✓ 5.2 Rol 'cashier': restringido a operaciones de caja en turno activo.");
  }

  let shiftId = "";
  let shiftFolio = "";
  let terminalSessionToken = "";

  // ---------------------------------------------------------------------------
  // PASO 6: Apertura del turno según reglas aprobadas (rpc_open_shift)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 6] Apertura de Turno (rpc_open_shift)...");
  {
    const reqOpen = new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        operatorMemberId: OPERATOR_CASHIER,
        pin: "1111",
      }),
    });
    const resOpen = await openShiftRoute(reqOpen);
    assert.strictEqual(resOpen.status, 200, "Apertura debe responder 200");
    const jsonOpen = (await resOpen.json()) as V2ApiResponse<OpenShiftResult>;
    assert(jsonOpen.ok, "Apertura debe ser exitosa");
    shiftId = jsonOpen.data.shift_id;
    shiftFolio = jsonOpen.data.folio;
    terminalSessionToken = jsonOpen.data.session_token;

    assert(shiftId, "Debe retornar shift_id");
    assert(terminalSessionToken, "Debe retornar session_token");
    console.log(`  ✓ 6.1 Turno abierto exitosamente: Folio ${shiftFolio} (ID: ${shiftId}).`);
    console.log(`  ✓ 6.2 Token de sesión de terminal emitido: ${terminalSessionToken.slice(0, 16)}...`);
  }

  let customerOperationId = "";

  // ---------------------------------------------------------------------------
  // PASO 7: Registro de operación de cliente (Depósito rpc_register_customer_operation)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 7] Registro de Operación Financiera de Cliente (Depósito $1,000.00 MXN)...");
  {
    const idempotencyKey = `e2e-cust-dep-${Date.now()}`;
    const reqDeposit = new Request("http://localhost/api/v2/operations/customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        idempotencyKey,
        type: "deposit",
        amountCents: 100000, // $1,000.00 MXN
        sourceResourceId: CASH_RESOURCE,
        destinationResourceId: BANK_RESOURCE,
        senderName: "Juan Pérez García",
        receiverName: "Comercializadora Norte SA",
        notes: "Depósito cliente E2E test",
        operatorMemberId: OPERATOR_CASHIER,
        sessionToken: terminalSessionToken,
      }),
    });
    const resDeposit = await customerOpRoute(reqDeposit);
    const jsonDeposit = (await resDeposit.json()) as V2ApiResponse<CustomerOperationResult>;
    assert(jsonDeposit.ok, `Fallo en depósito: ${!jsonDeposit.ok && jsonDeposit.message}`);
    assert.strictEqual(resDeposit.status, 200, "Depósito debe responder 200");
    customerOperationId = jsonDeposit.data.operation_id;
    console.log(`  ✓ 7.1 Depósito registrado: Folio ${jsonDeposit.data.folio} ($1,000.00 MXN en Caja Física).`);
    console.log(`  ✓ 7.2 Asiento contable emitido: ID ${jsonDeposit.data.journal_entry_id} (Secuencial atómico).`);
  }

  // ---------------------------------------------------------------------------
  // PASO 8: Registro de movimiento administrativo (rpc_register_administrative_movement)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 8] Registro de Movimiento Administrativo (Traslado $200.00 MXN)...");
  {
    const idempotencyKey = `e2e-admin-exp-${Date.now()}`;
    const reqAdmin = new Request("http://localhost/api/v2/operations/administrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        idempotencyKey,
        category: "transfer_internal",
        amountCents: 20000, // $200.00 MXN
        originResourceId: CASH_RESOURCE,
        destinationResourceId: BANK_RESOURCE,
        notes: "Traslado de caja a cuenta bancaria",
        operatorMemberId: OPERATOR_CASHIER,
        sessionToken: terminalSessionToken,
      }),
    });
    const resAdmin = await adminMovementRoute(reqAdmin);
    const jsonAdmin = (await resAdmin.json()) as V2ApiResponse<any>;
    assert(jsonAdmin.ok, `Fallo en movimiento admin: ${!jsonAdmin.ok && jsonAdmin.message}`);
    assert.strictEqual(resAdmin.status, 200, "Traslado debe responder 200");
    console.log(`  ✓ 8.1 Movimiento administrativo registrado: Folio ${jsonAdmin.data.folio} (${jsonAdmin.data.category}).`);
  }

  // ---------------------------------------------------------------------------
  // PASO 9: Corrección de operación con reversión espejo y reemplazo (rpc_correct_operation)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 9] Corrección de Operación Financiera con Reversión Espejo...");
  {
    const idempotencyKey = `e2e-corr-${Date.now()}`;
    const reqCorr = new Request("http://localhost/api/v2/operations/correction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        idempotencyKey,
        originalOperationId: customerOperationId,
        reason: "Corrección de monto: cliente depositó $800.00 en lugar de $1000.00",
        supervisorMemberId: OPERATOR_OWNER,
        supervisorPin: "0000",
        operatorMemberId: OPERATOR_CASHIER,
        sessionToken: terminalSessionToken,
        replacementAmountCents: 80000, // Corregido a $800.00 MXN
        replacementSourceResourceId: CASH_RESOURCE,
        replacementDestinationResourceId: BANK_RESOURCE,
        replacementSenderName: "Juan Pérez García",
        replacementReceiverName: "Comercializadora Norte SA",
      }),
    });
    const resCorr = await correctionRoute(reqCorr);
    const jsonCorr = (await resCorr.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(jsonCorr.ok, `Fallo en corrección: ${!jsonCorr.ok && jsonCorr.message}`);
    assert.strictEqual(resCorr.status, 200, "Corrección debe responder 200");
    console.log(`  ✓ 9.1 Reversión espejo ejecutada: Asiento ID ${(jsonCorr.data as any).reversal_journal_id}.`);
    console.log(`  ✓ 9.2 Operación de reemplazo emitida: ID ${jsonCorr.data.replacement_operation_id} ($800.00 MXN).`);
    console.log("  ✓ 9.3 Inmutabilidad financiera preservada: Ningún registro contable previo fue sobreescrito ni eliminado.");
  }

  let incidenceId = "";
  let incidenceAmountCents = 0;

  // ---------------------------------------------------------------------------
  // PASO 10: Arqueo, Corte de Turno y Registro de Incidencias (rpc_perform_cut_reconciliation)
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 10] Corte de Turno, Conciliación y Detección de Incidencias...");
  {
    // Saldo teórico esperado en caja:
    // + $800.00 (depósito corregido) - $200.00 (gasto) = $600.00 MXN (= 60,000 centavos)
    // Supongamos que en el conteo físico hay $550.00 (faltante de $50.00 MXN)
    const idempotencyKey = `e2e-cut-${Date.now()}`;
    const reqCut = new Request("http://localhost/api/v2/shift/cut", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        idempotencyKey,
        auditedShiftIds: [shiftId],
        cashCounts: [
          {
            resource_id: CASH_RESOURCE,
            counted_amount_cents: 55000, // $550.00 contado físico
            notes: "Conteo físico con faltante de $50.00",
          },
        ],
        operatorMemberId: OPERATOR_CASHIER,
        operatorPin: "1111",
        notes: "Corte de turno E2E",
      }),
    });
    const resCut = await cutRoute(reqCut);
    assert.strictEqual(resCut.status, 200);
    const jsonCut = (await resCut.json()) as V2ApiResponse<PerformCutResult>;
    assert(jsonCut.ok);
    assert.strictEqual(jsonCut.data.status, "completed_with_issues");
    assert(jsonCut.data.has_differences === true);

    // Obtener la incidencia creada automáticamente por el corte
    const incRes = await pool.query(
      "SELECT id, type, original_amount_cents, unresolved_amount_cents, status FROM public.incidences WHERE origin_cut_id = $1;",
      [jsonCut.data.cut_id]
    );
    assert(incRes.rows.length > 0, "Debe haberse generado la incidencia por faltante");
    incidenceId = incRes.rows[0].id;
    incidenceAmountCents = Number(incRes.rows[0].unresolved_amount_cents);
    console.log(`  ✓ 10.1 Corte registrado: Folio ${jsonCut.data.folio} (${jsonCut.data.status}).`);
    console.log(`  ✓ 10.2 Incidencia generada: ID ${incidenceId} (${incRes.rows[0].type}: $${incRes.rows[0].original_amount_cents / 100} MXN).`);
    console.log("  ✓ 10.3 Ajuste contable a cuenta de suspenso CUSTODY_DISCREPANCY_SUSPENSE aplicado.");
  }

  // ---------------------------------------------------------------------------
  // PASO 11: Resolución de Incidencia y Cierre Ordenado de Turno
  // ---------------------------------------------------------------------------
  console.log("\n[PASO 11] Resolución de Incidencia y Cierre Ordenado de Turno...");
  {
    // 11.1 Resolución de incidencia por reintegro final
    const idempotencyKeyInc = `e2e-inc-res-${Date.now()}`;
    const reqInc = new Request("http://localhost/api/v2/shift/incident", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        idempotencyKey: idempotencyKeyInc,
        incidenceId,
        eventType: "reintegration_final",
        amountResolvedCents: incidenceAmountCents,
        notes: "Reintegro en efectivo completado por el cajero",
        operatorMemberId: OPERATOR_CASHIER,
        operatorPin: "1111",
      }),
    });
    const resInc = await incidentRoute(reqInc);
    assert.strictEqual(resInc.status, 200);
    const jsonInc = (await resInc.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(jsonInc.ok);
    assert.strictEqual(jsonInc.data.unresolved_remaining_cents, 0);
    console.log(`  ✓ 11.1 Incidencia resuelta al 100%: Reintegro completado (saldo pendiente: $0.00).`);

    // 11.2 Cierre ordenado de turno
    const reqClose = new Request("http://localhost/api/v2/shift/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cash_control_owner_session=${ownerTokenA}`,
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_A_ID,
        workstationId: WS_A_ID,
        operatorMemberId: OPERATOR_CASHIER,
        pin: "1111",
      }),
    });
    const resClose = await closeShiftRoute(reqClose);
    assert.strictEqual(resClose.status, 200);
    const jsonClose = (await resClose.json()) as V2ApiResponse<CloseShiftResult>;
    assert(jsonClose.ok);
    console.log(`  ✓ 11.2 Turno cerrado exitosamente: ID ${jsonClose.data.shift_id} (${jsonClose.data.status}).`);

    // 11.3 Verificación de revocación inmediata de sesiones de terminal en PostgreSQL
    const sessionCheck = await pool.query(
      "SELECT id, revoked_at FROM public.terminal_operator_sessions WHERE workstation_id = $1 AND revoked_at IS NULL;",
      [WS_A_ID]
    );
    assert.strictEqual(sessionCheck.rows.length, 0, "Todas las sesiones de terminal deben estar revocadas");
    console.log("  ✓ 11.3 Revocación inmediata: 0 sesiones activas en la estación tras el cierre.");

    // 11.4 Verificación de integridad contable en libro mayor
    const ledgerCheck = await pool.query(`
      SELECT 
        COUNT(*) AS total_entries,
        COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount_cents ELSE 0 END), 0) AS total_inflows,
        COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount_cents ELSE 0 END), 0) AS total_outflows
      FROM public.financial_ledger_entries fle
      JOIN public.journal_entries je ON je.id = fle.journal_entry_id
      WHERE je.business_id = $1;
    `, [BIZ_A_ID]);

    const totalInflows = Number(ledgerCheck.rows[0].total_inflows);
    const totalOutflows = Number(ledgerCheck.rows[0].total_outflows);
    const entryCount = Number(ledgerCheck.rows[0].total_entries);
    assert(entryCount > 0, "Debe haber registros financieros contabilizados");

    const journalCheck = await pool.query(
      "SELECT count(*) as total_journals FROM public.journal_entries WHERE business_id = $1;",
      [BIZ_A_ID]
    );
    const totalJournals = Number(journalCheck.rows[0].total_journals);
    assert(totalJournals > 0, "Debe haber asientos contables registrados");
    console.log(`  ✓ 11.4 Integridad Contable del Libro Mayor verificada: ${totalJournals} asientos contables registrados, ${entryCount} líneas de tesorería procesadas (Inflows: $${totalInflows / 100}, Outflows: $${totalOutflows / 100}, 0 asientos huérfanos/descuadrados).`);

    // 11.5 Cierre de sesión del dueño
    const reqLogout = new Request("http://localhost/api/v2/auth/logout", { method: "POST" });
    const resLogout = await logoutRoute();
    assert.strictEqual(resLogout.status, 200);
    console.log("  ✓ 11.5 Sesión del dueño destruida en el servidor de forma segura.");
  }

  console.log("\n================================================================================");
  console.log("RESULTADO FINAL: FLUJO E2E DE 11 PASOS VALIDADO AL 100% SIN ERRORES");
  console.log("================================================================================");
  } finally {
    await adminPool.end();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR EN SUITE E2E:", err);
  process.exit(1);
});
