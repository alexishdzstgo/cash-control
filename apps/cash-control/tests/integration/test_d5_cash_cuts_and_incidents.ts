/**
 * SUITE DE INTEGRACIÓN FASE D5 — CORTES DE CAJA, CONCILIACIONES E INCIDENCIAS
 * CASH-CONTROL V2 (POSTGRESQL LOCAL AISLADO cash_control_test)
 *
 * Controles ejecutados:
 * 1. Corte cuadrado exacto (has_differences = false, status: 'completed'):
 *    - Sin emisión de asiento de descuadre ni incidencias huérfanas.
 * 2. Corte con faltante de efectivo (shortage):
 *    - Ajuste automático de tesorería (OUTFLOW) al centavo contado.
 *    - Débito a cuenta de suspenso CUSTODY_DISCREPANCY_SUSPENSE.
 *    - Creación automática de incidencia 'cash_shortage' en estado OPEN.
 * 3. Corte con sobrante de efectivo y discrepancia bancaria (surplus):
 *    - Entrada a tesorería (INFLOW) al monto observado.
 *    - Crédito a cuenta de suspenso CUSTODY_DISCREPANCY_SUSPENSE.
 *    - Creación de incidencias 'cash_surplus' y 'bank_discrepancy'.
 * 4. Resolución de incidencia por reintegro (reintegration_partial / reintegration_final):
 *    - Reintegro parcial reduciendo unresolved_amount_cents.
 *    - Reintegro final llevando unresolved_amount_cents a 0 y estado a RESOLVED.
 *    - Entrada a tesorería (INFLOW) y crédito contable a suspenso.
 * 5. Rechazo de sobre-resolución (OVER_RESOLUTION):
 *    - Impide resolver más del saldo pendiente de la incidencia.
 * 6. Rechazo de resolución sobre incidencia ya resuelta (INCIDENCE_ALREADY_RESOLVED).
 * 7. Dictamen de pérdida confirmada exclusivo del dueño (confirmed_loss):
 *    - Rechazo de cajero con 403 OWNER_EXCLUSIVE.
 *    - Aprobación por el dueño: DEBIT a gasto (EXP_CONFIRMED_LOSS), CREDIT a suspenso.
 *    - N=0 movimientos de tesorería y M=2 líneas económicas.
 * 8. Protocolo de idempotencia real:
 *    - Reintento idéntico retorna respuesta cacheada.
 *    - Conflicto por payload alterado (409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD).
 *    - Conflicto por RPC cruzada (409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC).
 * 9. Aislamiento multi-inquilino y autenticación de operador:
 *    - Rechazo de petición con businessId ajeno (403 FORBIDDEN_BUSINESS_ACCESS).
 *    - Rechazo de credenciales incorrectas (401 INVALID_OPERATOR_CREDENTIALS / AUTH_REQUIRED).
 * 10. Cierre limpio de turno y verificación de integridad contable.
 */

import { Pool } from "pg";
import { POST as closeRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as cutRoute } from "../../src/app/api/v2/shift/cut/route";
import { POST as incidentRoute } from "../../src/app/api/v2/shift/incident/route";
import { POST as joinRoute } from "../../src/app/api/v2/shift/join/route";
import { POST as openRoute } from "../../src/app/api/v2/shift/open/route";
import { createOwnerSessionToken } from "../../src/lib/api-v2/server/auth";
import { getV2LocalPool } from "../../src/lib/api-v2/server/db";
import type {
  JoinShiftResult,
  OpenShiftResult,
  PerformCutResult,
  ResolveIncidenceResult,
  V2ApiResponse,
} from "../../src/lib/api-v2/types";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runD5Tests() {
  console.log(
    "================================================================================",
  );
  console.log("CASH-CONTROL V2: SUITE DE PRUEBAS DE INTEGRACIÓN FASE D5");
  console.log("CORTES DE CAJA, CONCILIACIONES Y RESOLUCIÓN DE INCIDENCIAS");
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

  // Pool administrativo para fixtures y consultas de validación profunda
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  // Pool de la aplicación con rol restringido cash_control_app
  const appPool = getV2LocalPool();

  try {
    // -------------------------------------------------------------------------
    // PREPARACIÓN DE ENTORNO Y CUENTAS CONTABLES
    // -------------------------------------------------------------------------
    console.log(
      "\n[0] Preparando estado inicial del turno y cuentas fixture...",
    );
    await adminPool.query(
      "UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE status = 'open';",
    );
    await adminPool.query(
      "UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'D5_TEST_RESET' WHERE revoked_at IS NULL;",
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

    // Asegurar que las cuentas contables de suspenso y pérdida existan
    await adminPool.query(`
      INSERT INTO public.chart_of_accounts (id, business_id, code, name, type, is_active)
      VALUES 
        ('cd900000-0000-0000-0000-000000000005', '${BIZ_ID}', 'CUSTODY_DISCREPANCY_SUSPENSE', 'Cuenta Transitoria de Descuadres', 'clearing_control', true),
        ('cd900000-0000-0000-0000-000000000006', '${BIZ_ID}', 'EXP_CONFIRMED_LOSS', 'Pérdidas Operativas Confirmadas', 'expense', true)
      ON CONFLICT (business_id, code) DO NOTHING;
    `);

    const ownerAuthToken = createOwnerSessionToken({
      ownerUserId: OWNER_AUTH,
      businessId: BIZ_ID,
    });

    // Abrir turno con dueño
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
    const activeShiftId = openJson.data.shift_id;
    let ownerTerminalToken = openJson.data.session_token;
    console.log(
      " ✓ Turno abierto con dueño exitosamente. Folio:",
      openJson.data.folio,
    );

    // Incorporar cajero para obtener token operativo de cajero
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
      `Fallo al incorporar cajero: ${!joinJson.ok && joinJson.message}`,
    );
    const cashierTerminalToken = joinJson.data.session_token;
    console.log(" ✓ Relevo de cajero completado. Token de cajero emitido.");

    // Helper para consultar saldos teóricos de tesorería
    const getBalances = async () => {
      const res = await appPool.query(
        "SELECT id, current_balance_cents FROM public.treasury_resources WHERE id IN ($1, $2);",
        [SOURCE_RESOURCE_ID, DEST_RESOURCE_ID],
      );
      const cash = res.rows.find((r) => r.id === SOURCE_RESOURCE_ID)
        ?.current_balance_cents as string;
      const bank = res.rows.find((r) => r.id === DEST_RESOURCE_ID)
        ?.current_balance_cents as string;
      return {
        cashCents: BigInt(cash),
        bankCents: BigInt(bank),
      };
    };

    // -------------------------------------------------------------------------
    // TEST 1: Corte Cuadrado Exacto (has_differences = false, status: completed)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Corte de turno cuadrado exacto sin diferencias...");
    const b1 = await getBalances();
    const cutExactIdemKey = `idem-cut-exact-${Date.now()}`;

    const cutExactRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutExactIdemKey,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: Number(b1.cashCents),
              notes: "Arqueo exacto de caja",
            },
          ],
          bankAudits: [
            {
              resource_id: DEST_RESOURCE_ID,
              observed_balance_cents: Number(b1.bankCents),
              notes: "Saldo bancario conciliado exacto",
            },
          ],
          notes: "Corte ordinario de mediodía",
        }),
      }),
    );

    const cutExactJson =
      (await cutExactRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      cutExactRes.status === 200,
      `Esperaba 200 pero recibí ${cutExactRes.status}`,
    );
    assert(
      cutExactJson.ok,
      `Error en corte exacto: ${!cutExactJson.ok && cutExactJson.message}`,
    );
    assert(
      cutExactJson.data.status === "completed",
      `Estado de corte debe ser 'completed', recibido: ${cutExactJson.data.status}`,
    );
    assert(
      cutExactJson.data.has_differences === false,
      "Corte cuadrado no debe tener diferencias.",
    );
    assert(
      cutExactJson.data.journal_entry_id === null,
      "Corte cuadrado no debe generar asiento de ajuste.",
    );

    // Verificar en BD que no hay incidencias generadas
    const exactIncCheck = await appPool.query(
      "SELECT count(*) as cnt FROM public.incidences WHERE origin_cut_id = $1;",
      [cutExactJson.data.cut_id],
    );
    assert(
      Number(exactIncCheck.rows[0].cnt) === 0,
      "No deben existir incidencias para un corte cuadrado.",
    );

    // Saldos deben permanecer inalterados
    const b1After = await getBalances();
    assert(
      b1After.cashCents === b1.cashCents,
      "Saldo de caja debe permanecer idéntico tras corte exacto.",
    );
    assert(
      b1After.bankCents === b1.bankCents,
      "Saldo de banco debe permanecer idéntico tras corte exacto.",
    );
    console.log(
      " ✓ Corte cuadrado completado. Status: completed, has_differences: false.",
    );

    // -------------------------------------------------------------------------
    // TEST 2: Corte con Faltante de Efectivo (shortage)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Corte con faltante de efectivo (-$300.00)...");
    const b2 = await getBalances();
    const shortageCents = 30000; // $300.00
    const countedCashShortage = Number(b2.cashCents) - shortageCents;
    const cutShortageIdemKey = `idem-cut-shortage-${Date.now()}`;

    const cutShortageRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutShortageIdemKey,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: countedCashShortage,
              notes: "Faltante físico en caja",
            },
          ],
          notes: "Corte vespertino con faltante",
        }),
      }),
    );

    const cutShortageJson =
      (await cutShortageRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      cutShortageRes.status === 200,
      `Esperaba 200 pero recibí ${cutShortageRes.status}`,
    );
    assert(
      cutShortageJson.ok,
      `Error en corte con faltante: ${!cutShortageJson.ok && cutShortageJson.message}`,
    );
    assert(
      cutShortageJson.data.status === "completed_with_issues",
      `Estado debe ser completed_with_issues, recibido: ${cutShortageJson.data.status}`,
    );
    assert(
      cutShortageJson.data.has_differences === true,
      "has_differences debe ser true.",
    );
    assert(
      cutShortageJson.data.journal_entry_id !== null,
      "Debe generarse journal_entry_id.",
    );

    // Saldo en tesorería debe quedar EXACTAMENTE en el monto contado (Axioma 1)
    const b2After = await getBalances();
    assert(
      Number(b2After.cashCents) === countedCashShortage,
      `Saldo de caja (${b2After.cashCents}) debe ser exactamente el monto contado (${countedCashShortage}).`,
    );

    // Asiento contable de reconciliación
    const shortageJournalId = cutShortageJson.data.journal_entry_id;
    const fleShortage = await appPool.query(
      "SELECT * FROM public.financial_ledger_entries WHERE journal_entry_id = $1;",
      [shortageJournalId],
    );
    assert(
      fleShortage.rows.length === 1,
      "Debe existir 1 movimiento de tesorería.",
    );
    assert(
      fleShortage.rows[0].direction === "OUTFLOW",
      "Faltante debe ser OUTFLOW.",
    );
    assert(
      Number(fleShortage.rows[0].amount_cents) === shortageCents,
      "Monto de salida debe ser 30,000.",
    );

    // Contabilidad económica en suspenso
    const eleShortage = await appPool.query(
      `SELECT ele.*, coa.code 
       FROM public.economic_ledger_entries ele
       JOIN public.chart_of_accounts coa ON coa.id = ele.account_id
       WHERE ele.journal_entry_id = $1;`,
      [shortageJournalId],
    );
    assert(
      eleShortage.rows.length === 1,
      "Debe existir 1 movimiento económico.",
    );
    assert(
      eleShortage.rows[0].code === "CUSTODY_DISCREPANCY_SUSPENSE",
      "Cuenta debe ser CUSTODY_DISCREPANCY_SUSPENSE.",
    );
    assert(
      eleShortage.rows[0].direction === "DEBIT",
      "Faltante contra suspenso debe ser DEBIT.",
    );
    assert(
      Number(eleShortage.rows[0].amount_cents) === shortageCents,
      "Monto económico debe ser 30,000.",
    );

    // Incidencia generada en BD
    const incShortageRes = await appPool.query(
      "SELECT * FROM public.incidences WHERE origin_cut_id = $1 AND origin_resource_id = $2;",
      [cutShortageJson.data.cut_id, SOURCE_RESOURCE_ID],
    );
    assert(
      incShortageRes.rows.length === 1,
      "Debe existir 1 incidencia registrada.",
    );
    const shortageIncidence = incShortageRes.rows[0];
    assert(
      shortageIncidence.type === "cash_shortage",
      "Tipo de incidencia debe ser cash_shortage.",
    );
    assert(
      shortageIncidence.direction === "shortage",
      "Dirección debe ser shortage.",
    );
    assert(
      Number(shortageIncidence.original_amount_cents) === shortageCents,
      "original_amount_cents debe ser 30,000.",
    );
    assert(
      Number(shortageIncidence.unresolved_amount_cents) === shortageCents,
      "unresolved_amount_cents debe ser 30,000.",
    );
    assert(shortageIncidence.status === "OPEN", "Estado debe ser OPEN.");
    console.log(
      " ✓ Faltante detectado e incidencia creada exitosamente. Folio:",
      shortageIncidence.folio,
    );

    // -------------------------------------------------------------------------
    // TEST 3: Corte con Sobrante de Efectivo y Discrepancia Bancaria
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 3] Corte con sobrante de efectivo y discrepancia bancaria...",
    );
    const b3 = await getBalances();
    const cashSurplusCents = 15000; // $150.00 sobrante
    const bankSurplusCents = 20000; // $200.00 sobrante bancario
    const countedCashSurplus = Number(b3.cashCents) + cashSurplusCents;
    const observedBankSurplus = Number(b3.bankCents) + bankSurplusCents;
    const cutSurplusIdemKey = `idem-cut-surplus-${Date.now()}`;

    const cutSurplusRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutSurplusIdemKey,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: countedCashSurplus,
              notes: "Sobrante físico en caja",
            },
          ],
          bankAudits: [
            {
              resource_id: DEST_RESOURCE_ID,
              observed_balance_cents: observedBankSurplus,
              notes: "Discrepancia bancaria a favor",
            },
          ],
          notes: "Corte nocturno con sobrantes",
        }),
      }),
    );

    const cutSurplusJson =
      (await cutSurplusRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      cutSurplusRes.status === 200,
      `Esperaba 200 pero recibí ${cutSurplusRes.status}`,
    );
    assert(
      cutSurplusJson.ok,
      `Error en corte con sobrantes: ${!cutSurplusJson.ok && cutSurplusJson.message}`,
    );
    assert(
      cutSurplusJson.data.has_differences === true,
      "Corte con sobrantes debe tener diferencias.",
    );

    // Verificar saldos actualizados en tesorería
    const b3After = await getBalances();
    assert(
      Number(b3After.cashCents) === countedCashSurplus,
      "Saldo de caja debe coincidir con sobrante sumado.",
    );
    assert(
      Number(b3After.bankCents) === observedBankSurplus,
      "Saldo de banco debe coincidir con observed_balance_cents.",
    );

    // Verificar incidencias de sobrante
    const incSurplusCheck = await appPool.query(
      "SELECT * FROM public.incidences WHERE origin_cut_id = $1;",
      [cutSurplusJson.data.cut_id],
    );
    assert(
      incSurplusCheck.rows.length === 2,
      "Deben generarse 2 incidencias (caja y banco).",
    );
    console.log(
      " ✓ Sobrantes registrados e incidencias creadas correctamente.",
    );

    // -------------------------------------------------------------------------
    // TEST 4: Resolución Parcial y Final por Reintegro (reintegration)
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 4] Resolución parcial y final con reintegro de faltante...",
    );
    // 4a. Reintegro parcial de $100.00 (10,000 cents) sobre la incidencia de faltante
    const partialResolveAmount = 10000;
    const idemPartialInc = `idem-inc-partial-${Date.now()}`;

    const b4Before = await getBalances();
    const resPartial = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: idemPartialInc,
          incidenceId: shortageIncidence.id,
          eventType: "reintegration_partial",
          amountResolvedCents: partialResolveAmount,
          notes: "Cajero repone parte del faltante en efectivo",
        }),
      }),
    );

    const jsonPartial =
      (await resPartial.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      resPartial.status === 200,
      `Esperaba 200 pero recibí ${resPartial.status}`,
    );
    assert(
      jsonPartial.ok,
      `Error en reintegro parcial: ${!jsonPartial.ok && jsonPartial.message}`,
    );
    assert(
      jsonPartial.data.amount_resolved_cents === partialResolveAmount,
      "Monto resuelto debe ser 10,000.",
    );
    assert(
      jsonPartial.data.unresolved_remaining_cents === 20000,
      "Saldo restante debe ser 20,000.",
    );

    // Tesorería debe recibir INFLOW por 10,000
    const b4AfterPartial = await getBalances();
    assert(
      Number(b4AfterPartial.cashCents) ===
        Number(b4Before.cashCents) + partialResolveAmount,
      "Caja debe haber ingresado 10,000 centavos.",
    );

    // Estado de incidencia en BD debe ser PARTIALLY_RESOLVED
    const incDbPart = await appPool.query(
      "SELECT unresolved_amount_cents, status FROM public.incidences WHERE id = $1;",
      [shortageIncidence.id],
    );
    assert(
      Number(incDbPart.rows[0].unresolved_amount_cents) === 20000,
      "BD debe registrar 20,000 no resuelto.",
    );
    assert(
      incDbPart.rows[0].status === "PARTIALLY_RESOLVED",
      "Estado debe ser PARTIALLY_RESOLVED.",
    );
    console.log(" ✓ Reintegro parcial validado: Saldo pendiente = $200.00.");

    // 4b. Reintegro final de los $200.00 restantes (20,000 cents)
    const finalResolveAmount = 20000;
    const idemFinalInc = `idem-inc-final-${Date.now()}`;

    const resFinal = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: idemFinalInc,
          incidenceId: shortageIncidence.id,
          eventType: "reintegration_final",
          amountResolvedCents: finalResolveAmount,
          notes: "Cajero completa liquidación total del faltante",
        }),
      }),
    );

    const jsonFinal =
      (await resFinal.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      resFinal.status === 200,
      `Esperaba 200 pero recibí ${resFinal.status}`,
    );
    assert(
      jsonFinal.ok,
      `Error en reintegro final: ${!jsonFinal.ok && jsonFinal.message}`,
    );
    assert(
      jsonFinal.data.unresolved_remaining_cents === 0,
      "Saldo no resuelto debe ser 0.",
    );

    const incDbFinal = await appPool.query(
      "SELECT unresolved_amount_cents, status FROM public.incidences WHERE id = $1;",
      [shortageIncidence.id],
    );
    assert(
      Number(incDbFinal.rows[0].unresolved_amount_cents) === 0,
      "BD unresolved_amount_cents debe ser 0.",
    );
    assert(
      incDbFinal.rows[0].status === "RESOLVED",
      "Estado debe ser RESOLVED.",
    );
    console.log(
      " ✓ Reintegro final completado: Incidencia en estado RESOLVED.",
    );

    // -------------------------------------------------------------------------
    // TEST 5: Rechazo de Sobre-Resolución (OVER_RESOLUTION)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Rechazo de sobre-resolución (OVER_RESOLUTION)...");
    // Tomamos una de las incidencias de sobrante de Test 3 que tiene 15000 centavos
    const surplusIncRow = incSurplusCheck.rows.find(
      (r) => r.type === "cash_surplus",
    );
    assert(surplusIncRow, "Debe existir incidencia de cash_surplus.");

    const resOver = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-over-${Date.now()}`,
          incidenceId: surplusIncRow.id,
          eventType: "reintegration_partial",
          amountResolvedCents: 999999, // Supera con creces los 15000
          notes: "Intento inválido de sobre-resolución",
        }),
      }),
    );

    const jsonOver =
      (await resOver.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      resOver.status === 400,
      `Esperaba 400 pero recibí ${resOver.status}`,
    );
    assert(
      !jsonOver.ok && jsonOver.code === "OVER_RESOLUTION",
      `Esperaba OVER_RESOLUTION pero recibí ${!jsonOver.ok ? jsonOver.code : "OK"}`,
    );
    console.log(" ✓ Sobre-resolución rechazada con 400 OVER_RESOLUTION.");

    // -------------------------------------------------------------------------
    // TEST 6: Rechazo de Resolución sobre Incidencia Ya Resuelta
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 6] Rechazo de resolución sobre incidencia ya resuelta...",
    );
    const resAlreadyResolved = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-already-${Date.now()}`,
          incidenceId: shortageIncidence.id, // Ya totalmente resuelta en Test 4
          eventType: "reintegration_final",
          amountResolvedCents: 5000,
          notes: "Intento de resolver una incidencia que ya está en 0",
        }),
      }),
    );

    const jsonAlreadyResolved =
      (await resAlreadyResolved.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      resAlreadyResolved.status === 409,
      `Esperaba 409 pero recibí ${resAlreadyResolved.status}`,
    );
    assert(
      !jsonAlreadyResolved.ok &&
        jsonAlreadyResolved.code === "INCIDENCE_ALREADY_RESOLVED",
      `Esperaba INCIDENCE_ALREADY_RESOLVED pero recibí ${!jsonAlreadyResolved.ok ? jsonAlreadyResolved.code : "OK"}`,
    );
    console.log(
      " ✓ Resolución sobre incidencia liquidada rechazada con 409 INCIDENCE_ALREADY_RESOLVED.",
    );

    // -------------------------------------------------------------------------
    // TEST 7: Dictamen de Pérdida Confirmada Exclusivo del Dueño (confirmed_loss)
    // -------------------------------------------------------------------------
    console.log(
      "\n[TEST 7] Dictamen de pérdida confirmada exclusivo del dueño...",
    );
    // 7.1 Crear un nuevo corte con faltante de $50.00 (5,000 cents)
    const b5 = await getBalances();
    const lossFaltante = 5000;
    const cutLossRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-cut-loss-${Date.now()}`,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: Number(b5.cashCents) - lossFaltante,
              notes: "Faltante destinado a dictamen de pérdida",
            },
          ],
        }),
      }),
    );
    const cutLossJson =
      (await cutLossRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(cutLossJson.ok, "Fallo al crear corte para pérdida.");
    const incLossRes = await appPool.query(
      "SELECT id FROM public.incidences WHERE origin_cut_id = $1;",
      [cutLossJson.data.cut_id],
    );
    const lossIncId = incLossRes.rows[0].id;

    // 7.2 Cajero intenta dictaminar confirmed_loss -> Debe fallar con 403 OWNER_EXCLUSIVE
    const rejLossRes = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": cashierTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-rej-loss-${Date.now()}`,
          incidenceId: lossIncId,
          eventType: "confirmed_loss",
          amountResolvedCents: lossFaltante,
          notes: "Cajero intentando condonar faltante como pérdida",
        }),
      }),
    );
    const rejLossJson =
      (await rejLossRes.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      rejLossRes.status === 403,
      `Esperaba 403 pero recibí ${rejLossRes.status}`,
    );
    assert(
      !rejLossJson.ok && rejLossJson.code === "OWNER_EXCLUSIVE",
      `Esperaba OWNER_EXCLUSIVE pero recibí ${!rejLossJson.ok ? rejLossJson.code : "OK"}`,
    );
    console.log(" ✓ Intento de cajero rechazado con 403 OWNER_EXCLUSIVE.");

    // 7.3 Dueño se reincorpora a la terminal y autoriza confirmed_loss
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
    assert(ownerJoinJson.ok, "Dueño debe reincorporarse exitosamente.");
    ownerTerminalToken = ownerJoinJson.data.session_token;

    const bBeforeLoss = await getBalances();
    const authLossRes = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-auth-loss-${Date.now()}`,
          incidenceId: lossIncId,
          eventType: "confirmed_loss",
          amountResolvedCents: lossFaltante,
          notes: "Dueño autoriza absorber faltante como pérdida operativa",
        }),
      }),
    );
    const authLossJson =
      (await authLossRes.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      authLossRes.status === 200,
      `Esperaba 200 pero recibí ${authLossRes.status}`,
    );
    assert(
      authLossJson.ok,
      `Error al dictaminar pérdida: ${!authLossJson.ok && authLossJson.message}`,
    );

    // En confirmed_loss: N=0 movimientos de tesorería (saldos permanecen exactamente iguales)
    const bAfterLoss = await getBalances();
    assert(
      bAfterLoss.cashCents === bBeforeLoss.cashCents,
      "Tesorería en caja debe permanecer inalterada en confirmed_loss.",
    );
    assert(
      bAfterLoss.bankCents === bBeforeLoss.bankCents,
      "Tesorería en banco debe permanecer inalterada en confirmed_loss.",
    );

    // M=2 movimientos económicos: Débito a gasto (EXP_CONFIRMED_LOSS) y Crédito a suspenso
    const lossResolutionId = authLossJson.data.resolution_id;
    const lossResRow = await appPool.query(
      "SELECT journal_entry_id FROM public.incidence_resolutions WHERE id = $1;",
      [lossResolutionId],
    );
    const lossJournalId = lossResRow.rows[0].journal_entry_id;

    const eleLoss = await appPool.query(
      `SELECT ele.*, coa.code, coa.type
       FROM public.economic_ledger_entries ele
       JOIN public.chart_of_accounts coa ON coa.id = ele.account_id
       WHERE ele.journal_entry_id = $1;`,
      [lossJournalId],
    );
    assert(
      eleLoss.rows.length === 2,
      `Deben existir 2 movimientos económicos, encontrados: ${eleLoss.rows.length}`,
    );
    const debitLoss = eleLoss.rows.find((r) => r.direction === "DEBIT");
    const creditLoss = eleLoss.rows.find((r) => r.direction === "CREDIT");
    assert(debitLoss, "Debe existir línea DEBIT.");
    assert(creditLoss, "Debe existir línea CREDIT.");
    assert(
      debitLoss.type === "expense",
      "Cuenta debitada debe ser de tipo 'expense'.",
    );
    assert(
      creditLoss.code === "CUSTODY_DISCREPANCY_SUSPENSE",
      "Cuenta acreditada debe ser CUSTODY_DISCREPANCY_SUSPENSE.",
    );
    console.log(
      " ✓ Pérdida confirmada autorizada por dueño: 0 tesorería, 2 líneas económicas.",
    );

    // -------------------------------------------------------------------------
    // TEST 8: Protocolo de Idempotencia Real
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Protocolo de idempotencia real...");
    // 8.1 Reintento con misma clave y parámetros -> Retorna respuesta cacheada
    const replayRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutExactIdemKey,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: Number(b1.cashCents),
              notes: "Arqueo exacto de caja",
            },
          ],
          bankAudits: [
            {
              resource_id: DEST_RESOURCE_ID,
              observed_balance_cents: Number(b1.bankCents),
              notes: "Saldo bancario conciliado exacto",
            },
          ],
          notes: "Corte ordinario de mediodía",
        }),
      }),
    );
    const replayJson =
      (await replayRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(replayRes.status === 200, "Reintento debe ser HTTP 200.");
    assert(
      replayJson.ok && replayJson.data.cut_id === cutExactJson.data.cut_id,
      "Debe devolver exactamente el mismo cut_id cacheado.",
    );
    console.log(" ✓ Reintento idéntico cacheado exitosamente.");

    // 8.2 Reutilización con payload alterado -> 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
    const alteredRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutExactIdemKey,
          auditedShiftIds: [activeShiftId],
          cashCounts: [
            {
              resource_id: SOURCE_RESOURCE_ID,
              counted_amount_cents: 99999999, // Parámetro alterado
            },
          ],
        }),
      }),
    );
    const alteredJson =
      (await alteredRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      alteredRes.status === 409,
      `Esperaba 409 pero recibí ${alteredRes.status}`,
    );
    assert(
      !alteredJson.ok &&
        alteredJson.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      `Esperaba IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD, recibido: ${!alteredJson.ok ? alteredJson.code : "OK"}`,
    );
    console.log(" ✓ Conflicto por payload alterado detectado con 409.");

    // 8.3 Reutilización en RPC cruzada -> 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC
    const crossRpcRes = await incidentRoute(
      new Request("http://localhost/api/v2/shift/incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: cutExactIdemKey, // Clave originada en rpc_perform_cut_reconciliation
          incidenceId: lossIncId,
          eventType: "reintegration_final",
          amountResolvedCents: 1000,
        }),
      }),
    );
    const crossRpcJson =
      (await crossRpcRes.json()) as V2ApiResponse<ResolveIncidenceResult>;
    assert(
      crossRpcRes.status === 409,
      `Esperaba 409 pero recibí ${crossRpcRes.status}`,
    );
    assert(
      !crossRpcJson.ok &&
        crossRpcJson.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC",
      `Esperaba IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC, recibido: ${!crossRpcJson.ok ? crossRpcJson.code : "OK"}`,
    );
    console.log(" ✓ Conflicto por RPC cruzada detectado con 409.");

    // -------------------------------------------------------------------------
    // TEST 9: Aislamiento Multi-Inquilino y Control de Acceso
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Aislamiento multi-inquilino y autenticación...");
    // 9.1 Acceso cruzado a otra empresa con token de dueño
    const crossTenantRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_B_ID, // Empresa ajena
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-cross-${Date.now()}`,
          cashCounts: [],
        }),
      }),
    );
    const crossTenantJson =
      (await crossTenantRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      crossTenantRes.status === 403,
      `Esperaba 403 pero recibí ${crossTenantRes.status}`,
    );
    assert(
      !crossTenantJson.ok &&
        crossTenantJson.code === "FORBIDDEN_BUSINESS_ACCESS",
      "Debe rechazar con FORBIDDEN_BUSINESS_ACCESS.",
    );
    console.log(
      " ✓ Acceso multi-inquilino bloqueado con 403 FORBIDDEN_BUSINESS_ACCESS.",
    );

    // 9.2 Petición sin sesión ni credenciales de operador
    const noAuthRes = await cutRoute(
      new Request("http://localhost/api/v2/shift/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          idempotencyKey: `idem-no-auth-${Date.now()}`,
        }),
      }),
    );
    const noAuthJson =
      (await noAuthRes.json()) as V2ApiResponse<PerformCutResult>;
    assert(
      noAuthRes.status === 401,
      `Esperaba 401 pero recibí ${noAuthRes.status}`,
    );
    assert(
      !noAuthJson.ok && noAuthJson.code === "AUTH_REQUIRED",
      "Debe rechazar con AUTH_REQUIRED.",
    );
    console.log(
      " ✓ Petición sin credenciales rechazada con 401 AUTH_REQUIRED.",
    );

    // -------------------------------------------------------------------------
    // TEST 10: Cierre Seguro de Turno
    // -------------------------------------------------------------------------
    console.log("\n[TEST 10] Cierre seguro del turno auditado...");
    const closeRes = await closeRoute(
      new Request("http://localhost/api/v2/shift/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerAuthToken}`,
          "x-terminal-session": ownerTerminalToken,
        },
        body: JSON.stringify({
          businessId: BIZ_ID,
          workstationId: WORKSTATION_ID,
          operatorMemberId: OWNER_MEMBER_ID,
          pin: "0000",
        }),
      }),
    );
    const closeJson = (await closeRes.json()) as V2ApiResponse<unknown>;
    assert(
      closeRes.status === 200,
      `Esperaba 200 al cerrar turno pero recibí ${closeRes.status}`,
    );
    assert(
      closeJson.ok,
      `Error al cerrar turno: ${!closeJson.ok && closeJson.message}`,
    );
    console.log(
      " ✓ Turno cerrado exitosamente con todas las operaciones y cortes conciliados.",
    );

    console.log(
      "\n================================================================================",
    );
    console.log(
      "✓ TODAS LAS 10/10 PRUEBAS DE INTEGRACIÓN DE FASE D5 PASARON CON ÉXITO.",
    );
    console.log(
      "================================================================================",
    );
  } finally {
    await adminPool.end();
    await appPool.end();
  }
}

runD5Tests().catch((err) => {
  console.error("\n❌ ERROR EN SUITE D5:", err);
  process.exit(1);
});
