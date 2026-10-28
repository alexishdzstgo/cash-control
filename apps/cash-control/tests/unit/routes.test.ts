/**
 * Pruebas unitarias de los Route Handlers de Next.js para Fase D2 (con autenticación segura)
 */

import { Pool } from "pg";
import { POST as closeRoute } from "../../src/app/api/v2/shift/close/route";
import { POST as joinRoute } from "../../src/app/api/v2/shift/join/route";
import { POST as openRoute } from "../../src/app/api/v2/shift/open/route";
import { GET as statusRoute } from "../../src/app/api/v2/shift/status/route";
import { createOwnerSessionToken } from "../../src/lib/api-v2/server/auth";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runRouteTests() {
  console.log(
    "--- INICIANDO PRUEBAS DE ROUTE HANDLERS (/api/v2/shift/*) CON AUTENTICACIÓN ---",
  );

  // Admin pool para limpieza de datos de prueba
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
  const OWNER_USER_ID = "a9000000-0000-0000-0000-000000000001";
  const BIZ_B_ID = "b9000000-0000-0000-0000-000000000002";
  const OWNER_B_USER_ID = "a9000000-0000-0000-0000-000000000002";

  const WORKSTATION_ID = "ca900000-0000-0000-0000-000000000001";
  const OPERATOR_1_ID = "ba900000-0000-0000-0000-000000000001"; // Dueño / PIN 0000
  const OPERATOR_2_ID = "ba900000-0000-0000-0000-000000000002"; // Cajero Uno / PIN 1111

  // Tokens firmados por el servidor
  const ownerTokenA = createOwnerSessionToken({
    ownerUserId: OWNER_USER_ID,
    businessId: BIZ_ID,
  });

  const ownerTokenB = createOwnerSessionToken({
    ownerUserId: OWNER_B_USER_ID,
    businessId: BIZ_B_ID,
  });

  try {
    // Limpiar turnos previos en estación
    await adminPool.query(
      "UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE workstation_id = $1 AND status = 'open';",
      [WORKSTATION_ID],
    );
    await adminPool.query(
      "UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'CLEANUP' WHERE workstation_id = $1 AND revoked_at IS NULL;",
      [WORKSTATION_ID],
    );

    // 1. RECHAZO DE PETICIÓN NO AUTENTICADA (Sin token/cookie de sesión)
    console.log("[TEST 1] Verificando rechazo de petición no autenticada...");
    const unauthReq = new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_1_ID,
        pin: "0000",
      }),
    });
    const unauthRes = await openRoute(unauthReq);
    assert(
      unauthRes.status === 401,
      "Debe responder 401 para petición no autenticada",
    );
    const unauthJson = await unauthRes.json();
    assert(unauthJson.code === "UNAUTHORIZED", "Código debe ser UNAUTHORIZED");
    console.log("✓ 1. Petición no autenticada rechazada con 401 UNAUTHORIZED.");

    // 2. RECHAZO DE OPERACIÓN SOBRE OTRA EMPRESA (Dueño B intentando operar Empresa A)
    console.log(
      "[TEST 2] Verificando aislamiento multi-inquilino (Dueño B sobre Empresa A)...",
    );
    const crossBizReq = new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokenB}`,
      },
      body: JSON.stringify({
        businessId: BIZ_ID, // Empresa A
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_1_ID,
        pin: "0000",
      }),
    });
    const crossBizRes = await openRoute(crossBizReq);
    assert(
      crossBizRes.status === 403,
      "Debe responder 403 para acceso cruzado entre empresas",
    );
    const crossBizJson = await crossBizRes.json();
    assert(
      crossBizJson.code === "FORBIDDEN_BUSINESS_ACCESS",
      "Código debe ser FORBIDDEN_BUSINESS_ACCESS",
    );
    console.log(
      "✓ 2. Operación cruzada entre empresas rechazada con 403 FORBIDDEN_BUSINESS_ACCESS.",
    );

    // 3. Validación de entrada en /api/v2/shift/open (PIN inválido pero autenticado)
    console.log("[TEST 3] Verificando validación de datos de entrada...");
    const badReq = new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_1_ID,
        pin: "12", // Solo 2 dígitos
      }),
    });
    const badRes = await openRoute(badReq);
    assert(
      badRes.status === 400,
      "Debe rechazar PIN de menos de 4 dígitos con status 400",
    );
    const badJson = await badRes.json();
    assert(
      badJson.code === "VALIDATION_ERROR",
      "Código debe ser VALIDATION_ERROR",
    );
    console.log("✓ 3. Validación de entrada en Route Handler aprobada.");

    // 4. Apertura legítima vía Route Handler con sesión de Dueño A
    console.log(
      "[TEST 4] Ejecutando apertura legítima con sesión de dueño autenticado...",
    );
    const openReq = new Request("http://localhost/api/v2/shift/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_1_ID,
        pin: "0000",
        folio: `FOLIO-ROUTE-${Date.now()}`,
      }),
    });
    const openRes = await openRoute(openReq);
    const openJson = await openRes.json();
    if (openRes.status !== 200) {
      console.error("openRes failed details:", openJson);
    }
    assert(
      openRes.status === 200,
      `Apertura debe responder status 200, recibido: ${openRes.status}`,
    );
    assert(openJson.ok === true, "Respuesta debe ser ok: true");
    const token1 = openJson.data.session_token;
    console.log(
      "✓ 4. Route Handler /api/v2/shift/open ejecutó apertura exitosamente.",
    );

    // 5. Consulta de estado vía /api/v2/shift/status con token operativo
    console.log("[TEST 5] Consultando estado con token operativo emitido...");
    const statusReq = new Request(
      `http://localhost/api/v2/shift/status?businessId=${BIZ_ID}&workstationId=${WORKSTATION_ID}`,
      {
        method: "GET",
        headers: { "x-terminal-session": token1 },
      },
    );
    const statusRes = await statusRoute(statusReq);
    assert(statusRes.status === 200, "Status route debe devolver 200");
    const statusJson = await statusRes.json();
    assert(statusJson.data.hasOpenShift === true, "hasOpenShift debe ser true");
    assert(
      statusJson.data.sessionValid === true,
      "sessionValid debe ser true con token vigente",
    );
    assert(
      statusJson.data.operatorMemberId === OPERATOR_1_ID,
      "operatorMemberId debe coincidir",
    );
    console.log(
      "✓ 5. Route Handler /api/v2/shift/status verificó sesión activa correctamente.",
    );

    // 6. Relevo de cajero vía /api/v2/shift/join
    console.log("[TEST 6] Ejecutando relevo de cajero...");
    const joinReq = new Request("http://localhost/api/v2/shift/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_2_ID,
        pin: "1111",
      }),
    });
    const joinRes = await joinRoute(joinReq);
    assert(joinRes.status === 200, "Relevo debe responder 200");
    const joinJson = await joinRes.json();
    assert(joinJson.ok === true, "Relevo debe ser exitoso");
    const token2 = joinJson.data.session_token;
    assert(token2 !== token1, "Token de nuevo operador debe diferir");
    console.log(
      "✓ 6. Route Handler /api/v2/shift/join ejecutó relevo exitosamente.",
    );

    // 7. Cierre de turno vía /api/v2/shift/close
    console.log("[TEST 7] Ejecutando cierre de turno...");
    const closeReq = new Request("http://localhost/api/v2/shift/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        businessId: BIZ_ID,
        workstationId: WORKSTATION_ID,
        operatorMemberId: OPERATOR_2_ID,
        pin: "1111",
      }),
    });
    const closeRes = await closeRoute(closeReq);
    assert(closeRes.status === 200, "Cierre debe responder 200");
    const closeJson = await closeRes.json();
    assert(closeJson.ok === true, "Cierre debe ser exitoso");
    assert(closeJson.data.status === "closed", "Estado debe ser closed");
    console.log(
      "✓ 7. Route Handler /api/v2/shift/close ejecutó cierre de turno exitosamente.",
    );

    // 8. Consulta de estado post-cierre (debe reportar no hay turno abierto)
    console.log("[TEST 8] Consultando estado post-cierre...");
    const statusAfterClose = await statusRoute(
      new Request(
        `http://localhost/api/v2/shift/status?businessId=${BIZ_ID}&workstationId=${WORKSTATION_ID}`,
        {
          method: "GET",
          headers: { "x-terminal-session": token2 },
        },
      ),
    );
    const statusCloseJson = await statusAfterClose.json();
    assert(
      statusCloseJson.data.hasOpenShift === false,
      "Tras cierre, hasOpenShift debe ser false",
    );
    assert(
      statusCloseJson.data.sessionValid === false,
      "Tras cierre, sesión debe ser inválida",
    );
    console.log(
      "✓ 8. Estado post-cierre verificado correctamente (hasOpenShift = false).",
    );

    console.log("✓ TODAS LAS PRUEBAS DE ROUTE HANDLERS PASARON CON ÉXITO.");
  } finally {
    await adminPool.end();
  }
}

runRouteTests().catch((err) => {
  console.error("ERROR FATAL EN PRUEBAS DE ROUTE HANDLERS:", err);
  process.exit(1);
});
