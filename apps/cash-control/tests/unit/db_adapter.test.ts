import {
  assertLocalTarget,
  executeV2Rpc,
  getV2LocalPool,
} from "../../src/lib/api-v2/server/db";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function run() {
  console.log("--- INICIANDO PRUEBAS DEL ADAPTADOR LOCAL V2 ---");

  // 1. Verificación de conexión directa e inocua
  const pool = getV2LocalPool();
  const res = await pool.query(
    "SELECT current_database() as db, current_user as usr, version() as ver;",
  );
  assert(
    res.rows[0].db === "cash_control_test",
    `Debe ser cash_control_test, recibido: ${res.rows[0].db}`,
  );
  assert(
    res.rows[0].usr === "cash_control_app" || res.rows[0].usr === "postgres",
    `Debe ser cash_control_app o postgres, recibido: ${res.rows[0].usr}`,
  );
  console.log(
    "✓ Conexión local a PostgreSQL confirmada:",
    res.rows[0].db,
    res.rows[0].usr,
  );

  // 2. Verificación de auth.uid() y autorización de dueño
  const authForbiddenTest = await executeV2Rpc(
    "rpc_open_shift",
    [
      "b9000000-0000-0000-0000-000000000001",
      "ca900000-0000-0000-0000-000000000001",
      "ba900000-0000-0000-0000-000000000002",
      "1234",
      null,
    ],
    { authenticatedUserId: "a0000000-0000-0000-0000-000000000999" }, // Usuario no es el dueño legal (a9000000...)
  );
  assert(
    !authForbiddenTest.ok,
    "Debe fallar cuando el usuario autenticado no es el dueño",
  );
  assert(
    authForbiddenTest.code === "FORBIDDEN_BUSINESS_ACCESS",
    `Código debe ser FORBIDDEN_BUSINESS_ACCESS, recibido: ${authForbiddenTest.code}`,
  );
  console.log(
    "✓ Verificación de autorización de dueño (FORBIDDEN_BUSINESS_ACCESS) aprobada.",
  );

  // 3. Verificación de rechazo de PIN en rpc_open_shift (como dueño legítimo pero con PIN de operador incorrecto)
  const rpcFail = await executeV2Rpc(
    "rpc_open_shift",
    [
      "b9000000-0000-0000-0000-000000000001",
      "ca900000-0000-0000-0000-000000000001",
      "ba900000-0000-0000-0000-000000000002",
      "9999", // PIN incorrecto
      null,
    ],
    { authenticatedUserId: "a9000000-0000-0000-0000-000000000001" }, // Dueño legal
  );
  assert(!rpcFail.ok, "Debe fallar con PIN incorrecto");
  assert(
    rpcFail.code === "INVALID_OPERATOR_PIN",
    `Código debe ser INVALID_OPERATOR_PIN, recibido: ${rpcFail.code}`,
  );
  console.log("✓ Normalización de error SQL (INVALID_OPERATOR_PIN) aprobada.");
  let remoteRejected = false;
  try {
    assertLocalTarget("lnzhxntfzjvblnmangzp.supabase.co", "cash_control_test");
  } catch (err: unknown) {
    remoteRejected = true;
    const msg = err instanceof Error ? err.message : String(err);
    assert(
      msg.includes("FATAL SECURITY VIOLATION"),
      "Error debe indicar violación de seguridad",
    );
  }
  assert(remoteRejected, "Debe rechazar host que contenga supabase.co");

  let wrongDbRejected = false;
  try {
    assertLocalTarget("127.0.0.1", "postgres");
  } catch (err: unknown) {
    wrongDbRejected = true;
    const msg = err instanceof Error ? err.message : String(err);
    assert(
      msg.includes("cash_control_test"),
      "Error debe indicar base inválida",
    );
  }
  assert(
    wrongDbRejected,
    "Debe rechazar base de datos que no sea cash_control_test",
  );
  console.log("✓ Protección contra bases remotas y hosts ajenos verificada.");

  await pool.end();
  console.log("✓ TODAS LAS PRUEBAS DEL ADAPTADOR LOCAL PASARON CON ÉXITO.");
}

run().catch((err) => {
  console.error("ERROR FATAL EN PRUEBA:", err);
  process.exit(1);
});
