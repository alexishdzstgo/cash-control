import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function verifyD4Prerequisites() {
  const pool = getV2LocalPool();

  try {
    console.log("=== VERIFICACIÓN PREVIA D4 ===");

    // 1. Verificar identidad de conexión y base de datos
    const whoami = await pool.query("SELECT current_user, current_database(), inet_server_addr();");
    console.log("1. Conexión activa:", whoami.rows[0]);
    if (whoami.rows[0].current_user !== "cash_control_app" || whoami.rows[0].current_database !== "cash_control_test") {
      throw new Error("Conexión no cumple con usuario o base local restringida.");
    }

    // 2. Verificar auth.uid() en rpc_open_shift
    const funcDef = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'rpc_open_shift';
    `);
    const isHardened = funcDef.rows[0]?.prosrc.includes("v_auth_uid IS NULL OR v_auth_uid != v_owner_user_id");
    console.log("2. rpc_open_shift endurecido con auth.uid():", isHardened ? "SÍ (CORRECTO)" : "NO (DEFECTO)");
    if (!isHardened) {
      throw new Error("rpc_open_shift no tiene la corrección estricta de auth.uid()!");
    }

    // 3. Verificar permisos de funciones RPC para cash_control_app
    const rpcGrants = await pool.query(`
      SELECT routine_name, privilege_type
      FROM information_schema.routine_privileges
      WHERE grantee = 'cash_control_app' AND routine_name IN ('rpc_register_administrative_movement', 'rpc_correct_operation');
    `);
    console.log("3. Permisos RPC para cash_control_app:", rpcGrants.rows);

    // 4. Verificar permisos sobre tablas de D4
    const tableGrants = await pool.query(`
      SELECT table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = 'cash_control_app' AND table_name IN ('administrative_movements', 'operation_corrections', 'chart_of_accounts', 'treasury_resources')
      ORDER BY table_name, privilege_type;
    `);
    console.log("4. Permisos de tabla para cash_control_app:");
    for (const r of tableGrants.rows) {
      console.log(` - ${r.table_name}: ${r.privilege_type}`);
    }

    // 5. Verificar políticas RLS sobre administrative_movements y operation_corrections
    const rlsPolicies = await pool.query(`
      SELECT tablename, policyname, roles, cmd
      FROM pg_policies
      WHERE tablename IN ('administrative_movements', 'operation_corrections');
    `);
    console.log("5. Políticas RLS D4:", rlsPolicies.rows);

  } finally {
    await pool.end();
  }
}

verifyD4Prerequisites().catch(console.error);
