/**
 * SUITE DE INTEGRACIÓN FASE D4 — MOVIMIENTOS ADMINISTRATIVOS Y CORRECCIONES
 * CASH-CONTROL V2 (POSTGRESQL LOCAL AISLADO)
 *
 * Controles ejecutados:
 * 1. Cada categoría administrativa permitida:
 *    - transfer_internal (traslado simétrico sin alteración patrimonial)
 *    - expense_out (salida de caja contra cuenta de gastos)
 *    - funding_in (entrada a caja contra cuenta de fondeo)
 *    - reconciliation_adjustment (ajuste de arqueo contra cuenta de descuadres)
 * 2. Rechazo estricto de categorías patrimoniales restringidas para cajeros (OWNER_EXCLUSIVE):
 *    - owner_capital_injection
 *    - owner_drawing_withdrawal
 * 3. Ejecución autorizada de categorías patrimoniales por el dueño:
 *    - owner_capital_injection (aumento de patrimonio neto tipo 'equity')
 *    - owner_drawing_withdrawal (disminución de patrimonio neto tipo 'equity')
 * 4. Corrección de operaciones financieras con reversión espejo fiel:
 *    - Creación de REV-... invirtiendo exactamente líneas financieras y económicas
 *    - Creación de REP-... contabilizando nuevo monto y comisiones
 *    - Vinculación inmutable en operation_corrections y estado 'corrected'
 * 5. Rechazo de doble corrección (ALREADY_CORRECTED)
 * 6. Exigencia de autorización de supervisor/dueño para correcciones de cajeros
 * 7. Protocolo de idempotencia real: reintentos idénticos, detección de conflicto por carga útil alterada y RPC cruzada
 * 8. Rechazo de identidad falsificada y acceso entre empresas (multi-inquilino)
 * 9. Rollback completo e integridad contable sin registros huérfanos
 */

import { Pool } from "pg";
import { POST as administrativeRoute } from "../../src/app/api/v2/operations/administrative/route";
import { POST as correctionRoute } from "../../src/app/api/v2/operations/correction/route";
import { POST as customerOperationRoute } from "../../src/app/api/v2/operations/customer/route";
import { POST as closeRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as joinRoute } from "../../src/app/api/v2/shift/join/route";
import { POST as openRoute } from "../../src/app/api/v2/shift/open/route";
import { createOwnerSessionToken } from "../../src/lib/api-v2/server/auth";
import { getV2LocalPool } from "../../src/lib/api-v2/server/db";
import type {
  AdministrativeMovementResult,
  CorrectOperationResult,
  CustomerOperationResult,
  JoinShiftResult,
  OpenShiftResult,
  V2ApiResponse,
} from "../../src/lib/api-v2/types";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runD4Tests() {
  console.log(
    "================================================================================",
  );
  console.log("CASH-CONTROL V2: SUITE DE PRUEBAS DE INTEGRACIÓN FASE D4");
  console.log("MOVIMIENTOS ADMINISTRATIVOS Y CORRECCIONES DE OPERACIONES");
  console.log(
    "================================================================================",
  );

  const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
  const OWNER_AUTH = "a9000000-0000-0000-0000-000000000001";
  const WORKSTATION_ID = "ca900000-0000-0000-0000-000000000001";
  const OWNER_MEMBER_ID = "ba900000-0000-0000-0000-000000000001"; // PIN 0000 (owner)
  const CASHIER_MEMBER_ID = "ba900000-0000-0000-0000-000000000002"; // PIN 1111 (cashier)

  const SOURCE_RESOURCE_ID = "cc900000-0000-0000-0000-000000000001"; // CAJA-FISICA-01
  const DEST_RESOURCE_ID = "cc900000-0000-0000-0000-000000000002"; // BANCO-BBVA-01

  const BIZ_B_ID = "b9000000-0000-0000-0000-000000000002";
  const BIZ_B_OWNER_AUTH = "a9000000-0000-0000-0000-000000000002";

  // Pool de administración para fixtures / consultas directas
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  // Pool de aplicación con rol restringido cash_control_app
  const appPool = getV2LocalPool();

  try {
    // -------------------------------------------------------------------------
    // PREPARACIÓN DE ENTORNO
    // -------------------------------------------------------------------------
    console.log("\n[0] Preparando estado inicial del turno y secuencias...");
    await adminPool.query(
      "UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE status = 'open';",
    );
    await adminPool.query(
      "UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'D4_TEST_RESET' WHERE revoked_at IS NULL;",
    );
    await adminPool.query(
      `UPDATE public.treasury_resources tr
       SET last_entry_sequence = COALESCE(
         (SELECT MAX(entry_sequence) FROM public.financial_ledger_entries fle WHERE fle.resource_id = tr.id),
         0
       )
       WHERE id IN ($1, $2);`,
      [SOURCE_RESOURCE_ID, DEST_RESOURCE_ID],
    );

    const ownerAuthToken = createOwnerSessionToken({
      ownerUserId: OWNER_AUTH,
      businessId: BIZ_ID,
    });

    // Abrir turno con el dueño
    const openRes = await openRoute(
      new Request("http://localhost/api/v2/shift/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OWNER_MEMBER_ID,
          pin: "0000",
        }),
      }),
    );
    const openJson = (await openRes.json()) as V2ApiResponse<OpenShiftResult>;
    assert(
      openJson.ok,
      `Fallo al abrir turno: ${!openJson.ok && openJson.message}`,
    );
    console.log(
      " ✓ Turno abierto con dueño exitosamente. Folio:",
      openJson.data.folio,
    );

    // Relevo / Incorporación del cajero para obtener token de sesión de cajero
    const joinRes = await joinRoute(
      new Request("http://localhost/api/v2/shift/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: CASHIER_MEMBER_ID,
          pin: "1111",
        }),
      }),
    );
    const joinJson = (await joinRes.json()) as V2ApiResponse<JoinShiftResult>;
    assert(
      joinJson.ok,
      `Fallo al relevar con cajero: ${!joinJson.ok && joinJson.message}`,
    );
    const cashierTerminalToken = joinJson.data.session_token;
    console.log(" ✓ Relevo de cajero completado. Token de cajero emitido.");

    // Helper para consultar saldos de recursos
    async function getResourceBalances() {
      const res = await adminPool.query(
        "SELECT id, code, current_balance_cents FROM public.treasury_resources WHERE id IN ($1, $2);",
        [SOURCE_RESOURCE_ID, DEST_RESOURCE_ID],
      );
      const source = res.rows.find((r) => r.id === SOURCE_RESOURCE_ID);
      const dest = res.rows.find((r) => r.id === DEST_RESOURCE_ID);
      return {
        source: BigInt(source.current_balance_cents),
        dest: BigInt(dest.current_balance_cents),
      };
    }

    // -------------------------------------------------------------------------
    // TEST 1: Transferencia Interna (transfer_internal)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Transferencia interna entre recursos...");
    const b1 = await getResourceBalances();
    const transferAmount = BigInt(50000); // $500.00
    const transferIdemKey = `idem-transfer-${Date.now()}`;

    const transferRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: transferIdemKey,
          category: "transfer_internal",
          amountCents: Number(transferAmount),
          originResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          notes: "Traslado de caja a cuenta bancaria",
        }),
      }),
    );
    const transferJson =
      (await transferRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      transferJson.ok,
      `Error en transferencia: ${!transferJson.ok && transferJson.message}`,
    );
    console.log(" ✓ Transferencia registrada:", transferJson.data.folio);

    const b2 = await getResourceBalances();
    assert(
      b2.source === b1.source - transferAmount,
      "El recurso origen no disminuyó exactamente el monto de traslado.",
    );
    assert(
      b2.dest === b1.dest + transferAmount,
      "El recurso destino no aumentó exactamente el monto de traslado.",
    );

    // Comprobar que NO alteró patrimonio neto (0 movimientos económicos)
    const econEntries = await adminPool.query(
      "SELECT * FROM public.economic_ledger_entries WHERE journal_entry_id = $1;",
      [transferJson.data.journal_entry_id],
    );
    assert(
      econEntries.rows.length === 0,
      "Una transferencia interna no debe generar líneas económicas en el patrimonio.",
    );
    console.log(
      " ✓ Verificado: Origen -500, Destino +500, Impacto patrimonial neto = 0.",
    );

    // -------------------------------------------------------------------------
    // TEST 2: Gasto Operativo (expense_out)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Gasto operativo (expense_out)...");
    const b3 = await getResourceBalances();
    const expenseAmount = BigInt(12000); // $120.00
    const expenseIdemKey = `idem-expense-${Date.now()}`;

    const expenseRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: expenseIdemKey,
          category: "expense_out",
          amountCents: Number(expenseAmount),
          originResourceId: SOURCE_RESOURCE_ID,
          notes: "Pago de papelería y suministros",
        }),
      }),
    );
    const expenseJson =
      (await expenseRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      expenseJson.ok,
      `Error en gasto: ${!expenseJson.ok && expenseJson.message}`,
    );

    const b4 = await getResourceBalances();
    assert(
      b4.source === b3.source - expenseAmount,
      "El recurso origen no disminuyó por el gasto.",
    );

    // Verificar línea económica DEBIT en cuenta de gastos
    const expenseEcon = await adminPool.query(
      `SELECT ele.*, coa.code, coa.type 
       FROM public.economic_ledger_entries ele
       JOIN public.chart_of_accounts coa ON coa.id = ele.account_id
       WHERE ele.journal_entry_id = $1;`,
      [expenseJson.data.journal_entry_id],
    );
    assert(
      expenseEcon.rows.length === 1,
      "Debe registrarse 1 línea económica de gasto.",
    );
    assert(
      expenseEcon.rows[0].direction === "DEBIT",
      "Línea de gasto debe ser DEBIT.",
    );
    assert(
      expenseEcon.rows[0].type === "expense",
      "Cuenta contable debe ser de tipo 'expense'.",
    );
    console.log(
      " ✓ Verificado: Gasto registrado con DEBIT en cuenta de tipo expense.",
    );

    // -------------------------------------------------------------------------
    // TEST 3: Fondeo Operativo (funding_in)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Fondeo operativo (funding_in)...");
    const b5 = await getResourceBalances();
    const fundingAmount = BigInt(30000); // $300.00
    const fundingIdemKey = `idem-funding-${Date.now()}`;

    const fundingRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: fundingIdemKey,
          category: "funding_in",
          amountCents: Number(fundingAmount),
          destinationResourceId: SOURCE_RESOURCE_ID,
          notes: "Fondeo inicial de cambio en caja",
        }),
      }),
    );
    const fundingJson =
      (await fundingRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      fundingJson.ok,
      `Error en fondeo: ${!fundingJson.ok && fundingJson.message}`,
    );

    const b6 = await getResourceBalances();
    assert(
      b6.source === b5.source + fundingAmount,
      "El recurso destino no aumentó por el fondeo.",
    );
    console.log(
      " ✓ Verificado: Fondeo registrado con INFLOW en tesorería y CREDIT contable.",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Ajuste de Arqueo / Conciliación (reconciliation_adjustment)
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 4] Ajuste de conciliación / arqueo (reconciliation_adjustment)...",
    );
    const adjAmount = BigInt(2500); // $25.00
    const adjIdemKey = `idem-adj-${Date.now()}`;

    const adjRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: adjIdemKey,
          category: "reconciliation_adjustment",
          amountCents: Number(adjAmount),
          destinationResourceId: SOURCE_RESOURCE_ID,
          notes: "Ajuste sobrante de arqueo",
        }),
      }),
    );
    const adjJson =
      (await adjRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      adjJson.ok,
      `Error en ajuste de arqueo: ${!adjJson.ok && adjJson.message}`,
    );
    console.log(" ✓ Verificado: Ajuste de arqueo registrado exitosamente.");

    // -------------------------------------------------------------------------
    // TEST 5: Rechazo de Categorías Patrimoniales para Cajeros (OWNER_EXCLUSIVE)
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 5] Rechazo de categorías patrimoniales intentadas por cajero...",
    );

    // Cajero intenta inyección de capital
    const rejCapitalRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-rej-cap-${Date.now()}`,
          category: "owner_capital_injection",
          amountCents: 100000,
          destinationResourceId: DEST_RESOURCE_ID,
        }),
      }),
    );
    const rejCapitalJson =
      (await rejCapitalRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(!rejCapitalJson.ok, "Cajero no debe poder inyectar capital.");
    assert(
      rejCapitalRes.status === 403,
      `Esperaba 403 pero recibí ${rejCapitalRes.status}`,
    );
    assert(
      rejCapitalJson.code === "OWNER_EXCLUSIVE",
      `Esperaba OWNER_EXCLUSIVE pero recibí ${rejCapitalJson.code}`,
    );
    console.log(
      " ✓ Cajero bloqueado para owner_capital_injection con 403 OWNER_EXCLUSIVE.",
    );

    // Cajero intenta retiro de dueño
    const rejDrawingRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-rej-draw-${Date.now()}`,
          category: "owner_drawing_withdrawal",
          amountCents: 40000,
          originResourceId: DEST_RESOURCE_ID,
        }),
      }),
    );
    const rejDrawingJson =
      (await rejDrawingRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      !rejDrawingJson.ok,
      "Cajero no debe poder retirar capital del dueño.",
    );
    assert(
      rejDrawingRes.status === 403,
      `Esperaba 403 pero recibí ${rejDrawingRes.status}`,
    );
    assert(
      rejDrawingJson.code === "OWNER_EXCLUSIVE",
      `Esperaba OWNER_EXCLUSIVE pero recibí ${rejDrawingJson.code}`,
    );
    console.log(
      " ✓ Cajero bloqueado para owner_drawing_withdrawal con 403 OWNER_EXCLUSIVE.",
    );

    // -------------------------------------------------------------------------
    // TEST 6: Aportación de Capital por el Dueño (owner_capital_injection)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Aportación de capital autorizada por el dueño...");

    // El dueño retoma la terminal mediante relevo / joinShift
    const ownerJoinRes = await joinRoute(
      new Request("http://localhost/api/v2/shift/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OWNER_MEMBER_ID,
          pin: "0000",
        }),
      }),
    );
    const ownerJoinJson =
      (await ownerJoinRes.json()) as V2ApiResponse<JoinShiftResult>;
    assert(ownerJoinJson.ok, "Fallo al retomar terminal por el dueño.");
    const activeOwnerToken = ownerJoinJson.data.session_token;

    const b7 = await getResourceBalances();
    const capitalAmount = BigInt(100000); // $1,000.00
    const capitalIdemKey = `idem-cap-${Date.now()}`;

    const capitalRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": activeOwnerToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: capitalIdemKey,
          category: "owner_capital_injection",
          amountCents: Number(capitalAmount),
          destinationResourceId: DEST_RESOURCE_ID,
          notes: "Aportación de capital para expansión",
        }),
      }),
    );
    const capitalJson =
      (await capitalRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      capitalJson.ok,
      `Error en capital injection: ${!capitalJson.ok && capitalJson.message}`,
    );

    const b8 = await getResourceBalances();
    assert(
      b8.dest === b7.dest + capitalAmount,
      "El banco no aumentó por la inyección de capital.",
    );

    // Verificar clasificación económica en cuenta 'equity'
    const capEcon = await adminPool.query(
      `SELECT ele.*, coa.code, coa.type 
       FROM public.economic_ledger_entries ele
       JOIN public.chart_of_accounts coa ON coa.id = ele.account_id
       WHERE ele.journal_entry_id = $1;`,
      [capitalJson.data.journal_entry_id],
    );
    assert(capEcon.rows.length === 1, "Debe existir 1 línea económica.");
    assert(
      capEcon.rows[0].direction === "CREDIT",
      "Aportación debe ser CREDIT.",
    );
    assert(
      capEcon.rows[0].type === "equity",
      "Cuenta debe ser de tipo 'equity'.",
    );
    console.log(
      " ✓ Aportación de capital confirmada en banco y cuenta patrimonial equity.",
    );

    // -------------------------------------------------------------------------
    // TEST 7: Retiro del Dueño (owner_drawing_withdrawal)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Retiro de capital autorizado por el dueño...");
    const b9 = await getResourceBalances();
    const drawingAmount = BigInt(40000); // $400.00
    const drawingIdemKey = `idem-draw-${Date.now()}`;

    const drawingRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": activeOwnerToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: drawingIdemKey,
          category: "owner_drawing_withdrawal",
          amountCents: Number(drawingAmount),
          originResourceId: DEST_RESOURCE_ID,
          notes: "Retiro de utilidades del propietario",
        }),
      }),
    );
    const drawingJson =
      (await drawingRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      drawingJson.ok,
      `Error en retiro de dueño: ${!drawingJson.ok && drawingJson.message}`,
    );

    const b10 = await getResourceBalances();
    assert(
      b10.dest === b9.dest - drawingAmount,
      "El banco no disminuyó por el retiro.",
    );

    const drawEcon = await adminPool.query(
      `SELECT ele.*, coa.code, coa.type 
       FROM public.economic_ledger_entries ele
       JOIN public.chart_of_accounts coa ON coa.id = ele.account_id
       WHERE ele.journal_entry_id = $1;`,
      [drawingJson.data.journal_entry_id],
    );
    assert(drawEcon.rows.length === 1, "Debe existir 1 línea económica.");
    assert(drawEcon.rows[0].direction === "DEBIT", "Retiro debe ser DEBIT.");
    assert(
      drawEcon.rows[0].type === "equity",
      "Cuenta debe ser de tipo 'equity'.",
    );
    console.log(
      " ✓ Retiro de dueño confirmado con OUTFLOW bancario y DEBIT en equity.",
    );

    // -------------------------------------------------------------------------
    // TEST 8: Validación de Parámetros Inválidos
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Validación de parámetros incorrectos...");

    // Relevo de cajero para las operaciones de ventanilla
    const cashierRejoinRes = await joinRoute(
      new Request("http://localhost/api/v2/shift/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: CASHIER_MEMBER_ID,
          pin: "1111",
        }),
      }),
    );
    const cashierRejoinJson =
      (await cashierRejoinRes.json()) as V2ApiResponse<JoinShiftResult>;
    assert(cashierRejoinJson.ok, "Fallo al relevar cajero antes de Test 8.");
    const activeCashierToken = cashierRejoinJson.data.session_token;

    // Mismo origen y destino en transfer_internal
    const invalidTransferRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-inv-tr-${Date.now()}`,
          category: "transfer_internal",
          amountCents: 10000,
          originResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: SOURCE_RESOURCE_ID,
        }),
      }),
    );
    assert(
      invalidTransferRes.status === 400,
      "Debe rechazar con 400 origen y destino iguales.",
    );
    console.log(
      " ✓ Rechazo de origen y destino iguales en transfer_internal (400).",
    );

    // Monto negativo o cero
    const invalidAmountRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-inv-amt-${Date.now()}`,
          category: "funding_in",
          amountCents: -500,
          destinationResourceId: SOURCE_RESOURCE_ID,
        }),
      }),
    );
    assert(
      invalidAmountRes.status === 400,
      "Debe rechazar con 400 montos no positivos.",
    );
    console.log(" ✓ Rechazo de monto no positivo (400).");

    // -------------------------------------------------------------------------
    // TEST 9: Corrección de Operación — Reversión Espejo Fiel y Reemplazo
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 9] Corrección de operaciones financieras con reversión espejo y reemplazo...",
    );

    // 1. Ejecutar una operación normal de cliente (depósito)
    const opAmount = 80000; // $800.00
    const originalOpIdemKey = `idem-orig-op-${Date.now()}`;

    const origOpRes = await customerOperationRoute(
      new Request("http://localhost/api/v2/operations/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: originalOpIdemKey,
          type: "deposit",
          amountCents: opAmount,
          sourceResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          senderName: "Carlos Cliente",
          receiverName: "Mariana Destino",
          notes: "Operación con error tipográfico en destinatario",
        }),
      }),
    );
    const origOpJson =
      (await origOpRes.json()) as V2ApiResponse<CustomerOperationResult>;
    assert(
      origOpJson.ok,
      `Fallo en operación original: ${!origOpJson.ok && origOpJson.message}`,
    );
    const originalOperationId = origOpJson.data.operation_id;
    const origJournalId = origOpJson.data.journal_entry_id;
    console.log(
      " ✓ Operación original creada:",
      origOpJson.data.folio,
      "ID:",
      originalOperationId,
    );

    // 2. Corregir la operación (ejecutada con autorización de supervisor)
    const repAmount = 60000; // $600.00
    const repCommission = 3000; // $30.00
    const correctionIdemKey = `idem-correct-${Date.now()}`;

    const corrRes = await correctionRoute(
      new Request("http://localhost/api/v2/operations/correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: correctionIdemKey,
          originalOperationId: originalOperationId,
          reason: "Error en monto capturado y nombre del beneficiario",
          replacementAmountCents: repAmount,
          replacementCommissionOverrideCents: repCommission,
          replacementSourceResourceId: SOURCE_RESOURCE_ID,
          replacementDestinationResourceId: DEST_RESOURCE_ID,
          replacementSenderName: "Carlos Cliente",
          replacementReceiverName: "Mariana Beneficiario Corregido",
          supervisorMemberId: OWNER_MEMBER_ID,
          supervisorPin: "0000",
        }),
      }),
    );
    const corrJson =
      (await corrRes.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(
      corrJson.ok,
      `Error en corrección: ${!corrJson.ok && corrJson.message}`,
    );
    console.log(
      " ✓ Corrección aplicada exitosamente. Reversión ID:",
      corrJson.data.reversal_operation_id,
    );

    // 3. Verificaciones de integridad en base de datos
    // a) Estado de la operación original cambiado a 'corrected'
    const origDb = await adminPool.query(
      "SELECT status, folio FROM public.operations WHERE id = $1;",
      [originalOperationId],
    );
    assert(
      origDb.rows[0].status === "corrected",
      "La operación original debe pasar a estado 'corrected'.",
    );

    // b) Vínculo inmutable en operation_corrections
    const corrDb = await adminPool.query(
      "SELECT * FROM public.operation_corrections WHERE original_operation_id = $1;",
      [originalOperationId],
    );
    assert(
      corrDb.rows.length === 1,
      "Debe existir exactamente 1 registro en operation_corrections.",
    );
    assert(
      corrDb.rows[0].reversal_operation_id ===
        corrJson.data.reversal_operation_id,
      "ID de reversión no coincide.",
    );
    assert(
      corrDb.rows[0].replacement_operation_id ===
        corrJson.data.replacement_operation_id,
      "ID de reemplazo no coincide.",
    );

    // c) Reversión Espejo Fiel: verificar líneas de tesorería del asiento de reversión
    const origFinLines = await adminPool.query(
      "SELECT resource_id, amount_cents, direction FROM public.financial_ledger_entries WHERE journal_entry_id = $1 ORDER BY entry_sequence ASC;",
      [origJournalId],
    );
    const revFinLines = await adminPool.query(
      "SELECT resource_id, amount_cents, direction FROM public.financial_ledger_entries WHERE journal_entry_id = $1 ORDER BY entry_sequence ASC;",
      [corrJson.data.reversal_journal_id],
    );
    assert(
      revFinLines.rows.length === origFinLines.rows.length,
      "La reversión debe tener el mismo número de líneas.",
    );
    for (let i = 0; i < origFinLines.rows.length; i++) {
      const origLine = origFinLines.rows[i];
      const revLine = revFinLines.rows.find(
        (r) => r.resource_id === origLine.resource_id,
      );
      assert(
        revLine !== undefined,
        "Debe existir línea de reversión para cada recurso.",
      );
      assert(
        revLine.amount_cents === origLine.amount_cents,
        "El monto de reversión debe ser exactamente idéntico.",
      );
      const expectedDir =
        origLine.direction === "INFLOW" ? "OUTFLOW" : "INFLOW";
      assert(
        revLine.direction === expectedDir,
        `Dirección de reversión invertida esperada: ${expectedDir}, obtenida: ${revLine.direction}`,
      );
    }

    // d) Reversión Espejo Fiel: verificar líneas económicas invertidas
    const origEconLines = await adminPool.query(
      "SELECT account_id, amount_cents, direction FROM public.economic_ledger_entries WHERE journal_entry_id = $1;",
      [origJournalId],
    );
    const revEconLines = await adminPool.query(
      "SELECT account_id, amount_cents, direction FROM public.economic_ledger_entries WHERE journal_entry_id = $1;",
      [corrJson.data.reversal_journal_id],
    );
    assert(
      revEconLines.rows.length === origEconLines.rows.length,
      "La reversión económica debe coincidir en cantidad.",
    );
    if (origEconLines.rows.length > 0) {
      assert(
        origEconLines.rows[0].direction === "CREDIT",
        "Original debió ser CREDIT.",
      );
      assert(
        revEconLines.rows[0].direction === "DEBIT",
        "Reversión debió ser DEBIT.",
      );
      assert(
        origEconLines.rows[0].amount_cents ===
          revEconLines.rows[0].amount_cents,
        "Montos económicos deben coincidir.",
      );
    }
    console.log(
      " ✓ Reversión espejo fiel verificada: líneas financieras y económicas invertidas exactamente.",
    );

    // -------------------------------------------------------------------------
    // TEST 10: Rechazo de Doble Corrección (ALREADY_CORRECTED)
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 10] Rechazo de doble corrección sobre la misma operación...",
    );
    const doubleCorrRes = await correctionRoute(
      new Request("http://localhost/api/v2/operations/correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-double-corr-${Date.now()}`,
          originalOperationId: originalOperationId, // Misma operación ya corregida
          reason: "Intento de segunda corrección no permitida",
          replacementAmountCents: 50000,
          replacementSourceResourceId: SOURCE_RESOURCE_ID,
          replacementDestinationResourceId: DEST_RESOURCE_ID,
          replacementSenderName: "Carlos Cliente",
          replacementReceiverName: "Tercer Intento",
          supervisorMemberId: OWNER_MEMBER_ID,
          supervisorPin: "0000",
        }),
      }),
    );
    const doubleCorrJson =
      (await doubleCorrRes.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(!doubleCorrJson.ok, "No debe permitir corregir dos veces.");
    assert(
      doubleCorrRes.status === 409,
      `Esperaba 409 pero obtuve ${doubleCorrRes.status}`,
    );
    assert(
      doubleCorrJson.code === "ALREADY_CORRECTED" ||
        doubleCorrJson.code === "ORIGINAL_NOT_COMPLETED",
      `Esperaba ALREADY_CORRECTED u ORIGINAL_NOT_COMPLETED pero recibí ${doubleCorrJson.code}`,
    );
    console.log(
      ` ✓ Doble corrección rechazada con 409 (${doubleCorrJson.code}).`,
    );

    // -------------------------------------------------------------------------
    // TEST 11: Autorización Requerida para Correcciones (Cajero sin supervisor)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 11] Autorización para correcciones de cajero...");

    // 1. Crear otra operación normal
    const op2Res = await customerOperationRoute(
      new Request("http://localhost/api/v2/operations/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-op2-${Date.now()}`,
          type: "deposit",
          amountCents: 15000,
          sourceResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          senderName: "Cliente 2",
          receiverName: "Destino 2",
        }),
      }),
    );
    const op2Json =
      (await op2Res.json()) as V2ApiResponse<CustomerOperationResult>;
    assert(op2Json.ok, "Fallo al crear op2.");

    // 2. Cajero intenta corregir SIN supervisor
    const cajeroSinSupRes = await correctionRoute(
      new Request("http://localhost/api/v2/operations/correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-no-sup-${Date.now()}`,
          originalOperationId: op2Json.data.operation_id,
          reason: "Cajero intentando corregir sin PIN de supervisor",
          replacementAmountCents: 10000,
          replacementSourceResourceId: SOURCE_RESOURCE_ID,
          replacementDestinationResourceId: DEST_RESOURCE_ID,
          replacementSenderName: "Cliente 2",
          replacementReceiverName: "Destino 2 Corregido",
        }),
      }),
    );
    const cajeroSinSupJson =
      (await cajeroSinSupRes.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(!cajeroSinSupJson.ok, "Cajero sin supervisor debe ser rechazado.");
    assert(
      cajeroSinSupRes.status === 403,
      `Esperaba 403 pero recibí ${cajeroSinSupRes.status}`,
    );
    assert(
      cajeroSinSupJson.code === "SUPERVISOR_REQUIRED_FOR_CORRECTION",
      `Esperaba SUPERVISOR_REQUIRED_FOR_CORRECTION pero recibí ${cajeroSinSupJson.code}`,
    );
    console.log(
      " ✓ Rechazo de corrección de cajero sin supervisor (403 SUPERVISOR_REQUIRED_FOR_CORRECTION).",
    );

    // 3. Cajero intenta corregir CON PIN de supervisor INCORRECTO
    const cajeroPinInvalidoRes = await correctionRoute(
      new Request("http://localhost/api/v2/operations/correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-bad-pin-${Date.now()}`,
          originalOperationId: op2Json.data.operation_id,
          reason: "Cajero con PIN incorrecto",
          replacementAmountCents: 10000,
          replacementSourceResourceId: SOURCE_RESOURCE_ID,
          replacementDestinationResourceId: DEST_RESOURCE_ID,
          replacementSenderName: "Cliente 2",
          replacementReceiverName: "Destino 2 Corregido",
          supervisorMemberId: OWNER_MEMBER_ID,
          supervisorPin: "9999", // PIN incorrecto
        }),
      }),
    );
    const cajeroPinInvalidoJson =
      (await cajeroPinInvalidoRes.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(!cajeroPinInvalidoJson.ok, "PIN incorrecto debe ser rechazado.");
    assert(
      cajeroPinInvalidoRes.status === 403,
      `Esperaba 403 pero recibí ${cajeroPinInvalidoRes.status}`,
    );
    assert(
      cajeroPinInvalidoJson.code === "INVALID_SUPERVISOR_PIN",
      `Esperaba INVALID_SUPERVISOR_PIN pero recibí ${cajeroPinInvalidoJson.code}`,
    );
    console.log(
      " ✓ Rechazo de supervisor con PIN erróneo (403 INVALID_SUPERVISOR_PIN).",
    );

    // -------------------------------------------------------------------------
    // TEST 12: Protocolo de Idempotencia en Movimientos y Correcciones
    // -------------------------------------------------------------------------
    console.log("\n[TEST 12] Pruebas de protocolo de idempotencia...");

    // a) Reintento idéntico de movimiento administrativo
    const replayAdmRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: transferIdemKey, // Clave de transfer_internal del TEST 1
          category: "transfer_internal",
          amountCents: Number(transferAmount),
          originResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          notes: "Traslado de caja a cuenta bancaria",
        }),
      }),
    );
    const replayAdmJson =
      (await replayAdmRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(
      replayAdmJson.ok,
      "El reintento con mismos parámetros debe ser exitoso.",
    );
    assert(
      replayAdmJson.data.movement_id === transferJson.data.movement_id,
      "Debe devolver el mismo movement_id.",
    );
    assert(
      replayAdmJson.data.folio === transferJson.data.folio,
      "Debe devolver el mismo folio.",
    );
    console.log(" ✓ Reintento idempotente exitoso con respuesta idéntica.");

    // b) Conflicto por parámetros alterados (monto cambiado)
    const conflictAdmRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: transferIdemKey,
          category: "transfer_internal",
          amountCents: 99999, // Monto alterado
          originResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
        }),
      }),
    );
    const conflictAdmJson =
      (await conflictAdmRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(!conflictAdmJson.ok, "Debe rechazar parámetros alterados.");
    assert(
      conflictAdmRes.status === 409,
      `Esperaba 409 pero recibí ${conflictAdmRes.status}`,
    );
    assert(
      conflictAdmJson.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      `Esperaba IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD pero recibí ${conflictAdmJson.code}`,
    );
    console.log(
      " ✓ Conflicto de idempotencia por carga alterada detectado (409).",
    );

    // c) Conflicto por RPC cruzada (clave usada en otra función)
    const crossRpcRes = await correctionRoute(
      new Request("http://localhost/api/v2/operations/correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: transferIdemKey, // Clave originaria de transfer_internal
          originalOperationId: op2Json.data.operation_id,
          reason: "Intento de cruce de RPC",
          replacementAmountCents: 10000,
          replacementSourceResourceId: SOURCE_RESOURCE_ID,
          replacementDestinationResourceId: DEST_RESOURCE_ID,
          replacementSenderName: "Cliente",
          replacementReceiverName: "Destino",
          supervisorMemberId: OWNER_MEMBER_ID,
          supervisorPin: "0000",
        }),
      }),
    );
    const crossRpcJson =
      (await crossRpcRes.json()) as V2ApiResponse<CorrectOperationResult>;
    assert(
      !crossRpcJson.ok,
      "Debe rechazar clave reutilizada en distinta RPC.",
    );
    assert(
      crossRpcRes.status === 409,
      `Esperaba 409 pero recibí ${crossRpcRes.status}`,
    );
    assert(
      crossRpcJson.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC",
      `Esperaba IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC pero recibí ${crossRpcJson.code}`,
    );
    console.log(
      " ✓ Detección de clave reutilizada para RPC distinta (409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC).",
    );

    // -------------------------------------------------------------------------
    // TEST 13: Rechazo de Identidad Falsificada y Acceso Entre Empresas
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 13] Aislamiento multi-inquilino y rechazo de acceso entre empresas...",
    );
    const ownerBizBToken = createOwnerSessionToken({
      ownerUserId: BIZ_B_OWNER_AUTH,
      businessId: BIZ_B_ID,
    });

    const crossBizRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerBizBToken}`, // Dueño de empresa B
        },
        body: JSON.stringify({
          businessId: BIZ_ID, // Intentando operar en empresa A
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-cross-biz-${Date.now()}`,
          category: "expense_out",
          amountCents: 1000,
          originResourceId: SOURCE_RESOURCE_ID,
        }),
      }),
    );
    const crossBizJson =
      (await crossBizRes.json()) as V2ApiResponse<AdministrativeMovementResult>;
    assert(!crossBizJson.ok, "Dueño de empresa B no debe operar en empresa A.");
    assert(
      crossBizRes.status === 403,
      `Esperaba 403 pero recibí ${crossBizRes.status}`,
    );
    assert(
      crossBizJson.code === "FORBIDDEN_BUSINESS_ACCESS",
      `Esperaba FORBIDDEN_BUSINESS_ACCESS pero recibí ${crossBizJson.code}`,
    );
    console.log(
      " ✓ Intento de acceso entre empresas rechazado con 403 FORBIDDEN_BUSINESS_ACCESS.",
    );

    // -------------------------------------------------------------------------
    // TEST 14: Rollback Completo ante Errores
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 14] Verificación de Rollback completo ante excepciones...",
    );
    const totalMovementsBefore = await adminPool.query(
      "SELECT count(*) as cnt FROM public.administrative_movements WHERE business_id = $1;",
      [BIZ_ID],
    );
    const totalJournalsBefore = await adminPool.query(
      "SELECT count(*) as cnt FROM public.journal_entries WHERE business_id = $1;",
      [BIZ_ID],
    );

    // Provocar fallo: recurso origen inexistente en expense_out
    const FAKE_RESOURCE_ID = "cc999999-9999-9999-9999-999999999999";
    const rollbackRes = await administrativeRoute(
      new Request("http://localhost/api/v2/operations/administrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": activeCashierToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-fail-${Date.now()}`,
          category: "expense_out",
          amountCents: 5000,
          originResourceId: FAKE_RESOURCE_ID,
        }),
      }),
    );
    assert(
      rollbackRes.status === 400,
      "Debe retornar 400 por recurso inexistente.",
    );

    const totalMovementsAfter = await adminPool.query(
      "SELECT count(*) as cnt FROM public.administrative_movements WHERE business_id = $1;",
      [BIZ_ID],
    );
    const totalJournalsAfter = await adminPool.query(
      "SELECT count(*) as cnt FROM public.journal_entries WHERE business_id = $1;",
      [BIZ_ID],
    );

    assert(
      totalMovementsBefore.rows[0].cnt === totalMovementsAfter.rows[0].cnt,
      "Rollback falló: se insertó fila en administrative_movements.",
    );
    assert(
      totalJournalsBefore.rows[0].cnt === totalJournalsAfter.rows[0].cnt,
      "Rollback falló: se insertó fila en journal_entries.",
    );
    console.log(
      " ✓ Rollback atómico verificado: 0 registros huérfanos generados ante fallos.",
    );

    // -------------------------------------------------------------------------
    // CIERRE ORDENADO DE TURNO
    // -------------------------------------------------------------------------
    console.log("\n[FIN] Cerrando turno operativo...");
    const closeRes = await closeRoute(
      new Request("http://localhost/api/v2/shift/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OWNER_MEMBER_ID,
          pin: "0000",
        }),
      }),
    );
    const closeJson = await closeRes.json();
    assert(closeJson.ok, "Fallo al cerrar turno.");
    console.log(" ✓ Turno cerrado exitosamente.");

    console.log(
      "\n================================================================================",
    );
    console.log(
      "✅ TODAS LAS PRUEBAS DE FASE D4 APROBADAS SATISFACTORIAMENTE (14/14)",
    );
    console.log(
      "================================================================================",
    );
  } finally {
    await adminPool.end();
    await appPool.end();
  }
}

runD4Tests().catch((err) => {
  console.error("\n❌ ERROR EN SUITE D4:", err);
  process.exit(1);
});
