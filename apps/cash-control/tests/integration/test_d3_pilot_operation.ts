/**
 * PILOTO FINANCIERO D3 AISLADO LOCAL — CASH-CONTROL V2
 *
 * Flujo de extremo a extremo:
 * 1. Apertura de turno autorizada con emisión de token de terminal.
 * 2. Registro de operación de cliente ('deposit') vía rpc_register_customer_operation.
 * 3. Verificación de cálculo determinista de comisiones y asientos:
 *    - INFLOW en recurso origen (caja) por monto total (monto + comisión).
 *    - OUTFLOW en recurso destino (banco) por monto de operación.
 *    - Asiento contable de diario (journal_entry) y entrada analítica en REV_COMMISSIONS.
 *    - Verificación de saldos en treasury_resources sincronizados con los libros mayores.
 * 4. Prueba de protocolo de idempotencia:
 *    - Reintento con idénticos parámetros devuelve respuesta idéntica sin duplicar asientos ni saldos.
 *    - Reintento con parámetros alterados es rechazado con IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD.
 * 5. Cierre ordenado de turno.
 */

import { Pool } from "pg";
import { POST as customerOperationRoute } from "../../src/app/api/v2/operations/customer/route";
import { POST as closeRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as openRoute } from "../../src/app/api/v2/shift/open/route";
import { createOwnerSessionToken } from "../../src/lib/api-v2/server/auth";
import { getV2LocalPool } from "../../src/lib/api-v2/server/db";
import type { CustomerOperationResult } from "../../src/lib/api-v2/types";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runD3Pilot() {
  console.log(
    "================================================================================",
  );
  console.log(
    "CASH-CONTROL V2: PILOTO FINANCIERO D3 LOCAL AISLADO (POSTGRESQL)",
  );
  console.log(
    "================================================================================",
  );

  const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
  const OWNER_AUTH = "a9000000-0000-0000-0000-000000000001";
  const WORKSTATION_ID = "ca900000-0000-0000-0000-000000000001";
  const OPERATOR_MEMBER_ID = "ba900000-0000-0000-0000-000000000001"; // PIN 0000
  const OPERATOR_PIN = "0000";

  const SOURCE_RESOURCE_ID = "cc900000-0000-0000-0000-000000000001"; // CAJA-FISICA-01
  const DEST_RESOURCE_ID = "cc900000-0000-0000-0000-000000000002"; // BANCO-BBVA-01

  // Pool administrativo solo para setup/cleanup inicial
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  // Pool de la aplicación conectado con rol restringido cash_control_app
  const appPool = getV2LocalPool();

  try {
    // 1. Limpieza de turnos y sincronización de secuencia append-only
    console.log("1. Preparando estado base en base de datos local...");
    await adminPool.query(
      "UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE status = 'open';",
    );
    await adminPool.query(
      "UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'PILOT_RESET' WHERE revoked_at IS NULL;",
    );
    await adminPool.query(
      `
      UPDATE public.treasury_resources tr
      SET last_entry_sequence = COALESCE(
        (SELECT MAX(entry_sequence) FROM public.financial_ledger_entries fle WHERE fle.resource_id = tr.id),
        0
      )
      WHERE id IN ($1, $2);
    `,
      [SOURCE_RESOURCE_ID, DEST_RESOURCE_ID],
    );

    // 2. Apertura de turno con sesión de dueño autenticada
    console.log("2. Abriendo turno operativo con autenticación del dueño...");
    const ownerToken = createOwnerSessionToken({
      ownerUserId: OWNER_AUTH,
      businessId: BIZ_ID,
    });

    const openRes = await openRoute(
      new Request("http://localhost/api/v2/shift/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OPERATOR_MEMBER_ID,
          pin: OPERATOR_PIN,
          folio: `FOLIO-D3-PILOT-${Date.now()}`,
        }),
      }),
    );
    assert(
      openRes.status === 200,
      `Apertura debe ser 200, recibido: ${openRes.status}`,
    );
    const openJson = await openRes.json();
    assert(openJson.ok === true, "Apertura debe ser exitosa");
    const terminalSessionToken = openJson.data.session_token;
    console.log(
      `✓ Turno abierto. Token operativo de terminal: ${terminalSessionToken.substring(0, 12)}...`,
    );

    // 3. Consultar saldos previos
    const prevSourceRes = await appPool.query(
      "SELECT current_balance_cents, last_entry_sequence FROM public.treasury_resources WHERE id = $1;",
      [SOURCE_RESOURCE_ID],
    );
    const prevSourceBalance = Number.parseInt(
      prevSourceRes.rows[0].current_balance_cents,
      10,
    );

    const prevDestRes = await appPool.query(
      "SELECT current_balance_cents, last_entry_sequence FROM public.treasury_resources WHERE id = $1;",
      [DEST_RESOURCE_ID],
    );
    const prevDestBalance = Number.parseInt(
      prevDestRes.rows[0].current_balance_cents,
      10,
    );

    console.log(
      `  - Saldo inicial Caja: $${(prevSourceBalance / 100).toFixed(2)} MXN (${prevSourceBalance} cents)`,
    );
    console.log(
      `  - Saldo inicial Banco: $${(prevDestBalance / 100).toFixed(2)} MXN (${prevDestBalance} cents)`,
    );

    // 4. Ejecutar operación financiera de cliente ('deposit' de $500.00 MXN = 50,000 cents)
    console.log(
      "\n3. Ejecutando operación financiera piloto (Depósito de $500.00 MXN)...",
    );
    const idempotencyKey = `IDEM-PILOT-D3-${Date.now()}`;
    const amountCents = 50000; // $500.00 MXN

    const opReq = new Request("http://localhost/api/v2/operations/customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-terminal-session": terminalSessionToken,
      },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        idempotencyKey,
        type: "deposit",
        amountCents,
        sourceResourceId: SOURCE_RESOURCE_ID,
        destinationResourceId: DEST_RESOURCE_ID,
        senderName: "Juan Pérez García",
        receiverName: "Comercializadora Norte SA",
        customerAccountRef: "CTA-1234567890",
        notes: "Piloto financiero D3 Cash-Control v2",
      }),
    });

    const opRes = await customerOperationRoute(opReq);
    const opJson = (await opRes.json()) as {
      ok: boolean;
      data: CustomerOperationResult;
      code?: string;
      message?: string;
    };
    if (opRes.status !== 200) {
      console.error("Falla en operación piloto:", opJson);
    }
    assert(
      opRes.status === 200,
      `Operación financiera debe devolver 200, recibido: ${opRes.status}`,
    );
    assert(opJson.ok === true, "Respuesta de operación debe ser ok: true");
    const result = opJson.data;

    console.log("✓ Operación procesada con éxito:");
    console.log(`  - Folio: ${result.folio}`);
    console.log(`  - ID Operación: ${result.operation_id}`);
    console.log(
      `  - Asiento de Diario #: ${result.entry_number} (ID: ${result.journal_entry_id})`,
    );
    console.log(
      `  - Monto Solicitado: $${(result.amount_cents / 100).toFixed(2)} MXN`,
    );
    console.log(
      `  - Comisión Calculada: $${(result.commission_cents / 100).toFixed(2)} MXN (Fija 10.00 + 1% sobre 500.00)`,
    );
    console.log(
      `  - Monto Total Recibido: $${(result.total_cents / 100).toFixed(2)} MXN`,
    );

    // Regla de comisión configurada: 1,000 fija + 100 bps (1%) de 50,000 = 1,000 + 500 = 1,500 cents ($15.00 MXN)
    assert(
      result.commission_cents === 1500,
      `Comisión esperada: 1500, obtenida: ${result.commission_cents}`,
    );
    assert(
      result.total_cents === 51500,
      `Total esperado: 51500, obtenido: ${result.total_cents}`,
    );

    // 5. Verificación de movimientos en el libro mayor y saldos
    console.log(
      "\n4. Verificando integridad de asientos contables y saldos...",
    );

    // 5.1 Verificar saldo de Caja (recurso origen: INFLOW de total_cents)
    const expectedSourceBalance = prevSourceBalance + result.total_cents;
    assert(
      result.source_resource.balance_after_cents === expectedSourceBalance,
      `Saldo final de Caja esperado ${expectedSourceBalance}, obtenido ${result.source_resource.balance_after_cents}`,
    );
    console.log(
      `  ✓ Caja Efectivo aumentó en $${(result.total_cents / 100).toFixed(2)} MXN (Saldo: $${(expectedSourceBalance / 100).toFixed(2)} MXN).`,
    );

    // 5.2 Verificar saldo de Banco (recurso destino: OUTFLOW de amount_cents)
    const expectedDestBalance = prevDestBalance - result.amount_cents;
    assert(
      result.destination_resource.balance_after_cents === expectedDestBalance,
      `Saldo final de Banco esperado ${expectedDestBalance}, obtenido ${result.destination_resource.balance_after_cents}`,
    );
    console.log(
      `  ✓ Cuenta Banco disminuyó en $${(result.amount_cents / 100).toFixed(2)} MXN (Saldo: $${(expectedDestBalance / 100).toFixed(2)} MXN).`,
    );

    // 5.3 Comprobar persistencia directa en tablas
    const ledgerLines = await appPool.query(
      `SELECT resource_id, direction, amount_cents, balance_after_cents 
       FROM public.financial_ledger_entries 
       WHERE journal_entry_id = $1 
       ORDER BY entry_sequence ASC;`,
      [result.journal_entry_id],
    );
    assert(
      ledgerLines.rows.length === 2,
      "Debe existir partida doble (2 líneas de libro financiero)",
    );
    const inflowLine = ledgerLines.rows.find((r) => r.direction === "INFLOW");
    const outflowLine = ledgerLines.rows.find((r) => r.direction === "OUTFLOW");
    assert(inflowLine !== undefined, "Debe existir línea INFLOW");
    assert(
      Number(inflowLine.amount_cents) === 51500,
      "Monto INFLOW debe ser 51500",
    );
    assert(outflowLine !== undefined, "Debe existir línea OUTFLOW");
    assert(
      Number(outflowLine.amount_cents) === 50000,
      "Monto OUTFLOW debe ser 50000",
    );
    console.log(
      "  ✓ Partida doble verificada en financial_ledger_entries (INFLOW 51,500 / OUTFLOW 50,000).",
    );

    const economicLines = await appPool.query(
      `SELECT account_id, direction, amount_cents 
       FROM public.economic_ledger_entries 
       WHERE journal_entry_id = $1;`,
      [result.journal_entry_id],
    );
    assert(
      economicLines.rows.length === 1,
      "Debe existir 1 línea económica por la comisión",
    );
    assert(
      economicLines.rows[0].direction === "CREDIT",
      "Comisión debe ser crédito",
    );
    assert(
      Number(economicLines.rows[0].amount_cents) === 1500,
      "Monto de comisión económica debe ser 1500",
    );
    console.log(
      "  ✓ Asiento analítico de ingresos por comisión verificado en economic_ledger_entries ($15.00 MXN).",
    );

    // 6. Prueba de Idempotencia: Reintento idéntico
    console.log(
      "\n5. Verificando protocolo de idempotencia ante reintentos idénticos...",
    );
    const retryReq = new Request(
      "http://localhost/api/v2/operations/customer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": terminalSessionToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey, // MISMA CLAVE
          type: "deposit",
          amountCents,
          sourceResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          senderName: "Juan Pérez García",
          receiverName: "Comercializadora Norte SA",
          customerAccountRef: "CTA-1234567890",
          notes: "Piloto financiero D3 Cash-Control v2",
        }),
      },
    );

    const retryRes = await customerOperationRoute(retryReq);
    assert(retryRes.status === 200, "Reintento idéntico debe retornar 200");
    const retryJson = (await retryRes.json()) as {
      ok: boolean;
      data: CustomerOperationResult;
    };
    assert(retryJson.ok === true, "Reintento debe ser ok: true");
    assert(
      retryJson.data.operation_id === result.operation_id,
      "Reintento debe devolver el MISMO operation_id",
    );
    assert(
      retryJson.data.journal_entry_id === result.journal_entry_id,
      "Reintento debe devolver el MISMO journal_entry_id",
    );
    assert(
      retryJson.data.folio === result.folio,
      "Reintento debe devolver el MISMO folio",
    );

    // Comprobar que no se duplicaron líneas en el libro
    const postRetryLedgerCount = await appPool.query(
      "SELECT COUNT(*) FROM public.financial_ledger_entries WHERE journal_entry_id = $1;",
      [result.journal_entry_id],
    );
    assert(
      Number(postRetryLedgerCount.rows[0].count) === 2,
      "No deben crearse líneas adicionales",
    );

    // Comprobar que los saldos permanecen intactos
    const postRetrySourceRes = await appPool.query(
      "SELECT current_balance_cents FROM public.treasury_resources WHERE id = $1;",
      [SOURCE_RESOURCE_ID],
    );
    assert(
      Number(postRetrySourceRes.rows[0].current_balance_cents) ===
        expectedSourceBalance,
      "Saldo no debe alterarse por reintentos de idempotencia",
    );
    console.log(
      "  ✓ Idempotencia confirmada: El reintento idéntico devolvió el resultado original sin alterar saldos ni duplicar asientos.",
    );

    // 7. Prueba de Idempotencia: Reintento con parámetros alterados (debe ser rechazado)
    console.log(
      "\n6. Verificando rechazo ante reutilización de clave con payload diferente...",
    );
    const alteredReq = new Request(
      "http://localhost/api/v2/operations/customer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-session": terminalSessionToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey, // MISMA CLAVE
          type: "deposit",
          amountCents: 999999, // MONTO DIFERENTE
          sourceResourceId: SOURCE_RESOURCE_ID,
          destinationResourceId: DEST_RESOURCE_ID,
          senderName: "Juan Pérez García",
          receiverName: "Comercializadora Norte SA",
        }),
      },
    );

    const alteredRes = await customerOperationRoute(alteredReq);
    assert(
      alteredRes.status === 400 || alteredRes.status === 409,
      "Debe rechazar reutilización con parámetros diferentes",
    );
    const alteredJson = await alteredRes.json();
    assert(alteredJson.ok === false, "Respuesta debe ser ok: false");
    console.log(
      `  ✓ Clave reutilizada con monto diferente rechazada exitosamente (${alteredJson.code || "REJECTED"}).`,
    );

    // 8. Cierre de turno
    console.log("\n7. Cerrando turno ordenadamente...");
    const closeRes = await closeRoute(
      new Request("http://localhost/api/v2/shift/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OPERATOR_MEMBER_ID,
          pin: OPERATOR_PIN,
        }),
      }),
    );
    assert(closeRes.status === 200, "Cierre de turno debe ser 200");
    console.log("✓ Turno cerrado y terminal revocada.");

    console.log(
      "\n================================================================================",
    );
    console.log(
      "✓ RESULTADO: PILOTO FINANCIERO D3 COMPLETADO Y VALIDADO AL 100%.",
    );
    console.log(
      "================================================================================",
    );
  } finally {
    await adminPool.end();
  }
}

runD3Pilot().catch((err) => {
  console.error("FATAL ERROR EN PILOTO D3:", err);
  process.exit(1);
});
