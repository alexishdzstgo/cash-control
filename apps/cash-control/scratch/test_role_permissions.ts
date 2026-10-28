import { Pool } from "pg";

async function testRestrictedRolePermissions() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "cash_control_app",
    password: process.env.V2_LOCAL_APP_PASSWORD || "v2_app_local_pass_2026",
  });

  try {
    console.log("1. Verificando identidad de conexión...");
    const whoami = await pool.query("SELECT current_user, current_database();");
    console.log("Conectado como:", whoami.rows[0]);
    if (whoami.rows[0].current_user !== "cash_control_app") {
      throw new Error("No está conectado como cash_control_app");
    }

    console.log("2. Verificando que SELECT sobre shifts está permitido...");
    const shifts = await pool.query("SELECT COUNT(*) FROM public.shifts;");
    console.log("✓ SELECT permitido:", shifts.rows[0]);

    console.log("3. Verificando que INSERT directo sobre financial_ledger_entries es DENEGADO...");
    let directInsertFailed = false;
    try {
      const enumRes = await pool.query(`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'financial_direction';
      `);
      const dirVal = enumRes.rows[0]?.enumlabel || 'inflow';
      await pool.query(`
        INSERT INTO public.financial_ledger_entries (
          id, business_id, journal_entry_id, resource_id, entry_sequence,
          amount_cents, direction, balance_after_cents
        ) VALUES (
          gen_random_uuid(), 'b9000000-0000-0000-0000-000000000001', gen_random_uuid(),
          gen_random_uuid(), 9999, 10000, '${dirVal}', 10000
        );
      `);
    } catch (err: any) {
      directInsertFailed = true;
      console.log("✓ INSERT directo bloqueado exitosamente por PostgreSQL:", err.message);
      if (!err.message.includes("permission denied")) {
        throw new Error("Se esperaba error 'permission denied' pero se obtuvo: " + err.message);
      }
    }
    if (!directInsertFailed) {
      throw new Error("VULNERABILIDAD CRÍTICA: Se permitió INSERT directo en libro mayor a cash_control_app");
    }

    console.log("4. Verificando que UPDATE directo sobre saldos de treasury_resources es DENEGADO...");
    let directUpdateFailed = false;
    try {
      await pool.query(`
        UPDATE public.treasury_resources
        SET current_balance_cents = 999999999
        WHERE id = 'ca900000-0000-0000-0000-000000000001';
      `);
    } catch (err: any) {
      directUpdateFailed = true;
      console.log("✓ UPDATE directo sobre saldos bloqueado exitosamente por PostgreSQL:", err.message);
    }
    if (!directUpdateFailed) {
      throw new Error("VULNERABILIDAD CRÍTICA: Se permitió UPDATE directo en saldos a cash_control_app");
    }

    console.log("✓ TODAS LAS PRUEBAS DE PRIVILEGIO MÍNIMO PARA cash_control_app PASARON SATISFACTORIAMENTE.");
  } finally {
    await pool.end();
  }
}

testRestrictedRolePermissions().catch(console.error);
