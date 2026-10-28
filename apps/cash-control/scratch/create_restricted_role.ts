import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function setupRestrictedRole() {
  const pool = getV2LocalPool();
  try {
    const password = process.env.V2_LOCAL_APP_PASSWORD || "v2_app_local_pass_2026";

    console.log("1. Creando o configurando rol restringido cash_control_app...");
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cash_control_app') THEN
          CREATE ROLE cash_control_app WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        ELSE
          ALTER ROLE cash_control_app WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    console.log("2. Configurando permisos de conexión y esquemas...");
    await pool.query(`
      GRANT CONNECT ON DATABASE cash_control_test TO cash_control_app;
      GRANT USAGE ON SCHEMA public TO cash_control_app;
      GRANT USAGE ON SCHEMA auth TO cash_control_app;
    `);

    console.log("3. Revocando todos los permisos de tabla por defecto...");
    await pool.query(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cash_control_app;
    `);

    console.log("4. Concediendo únicamente SELECT sobre tablas de lectura necesarias...");
    await pool.query(`
      GRANT SELECT ON TABLE public.shifts TO cash_control_app;
      GRANT SELECT ON TABLE public.shift_participants TO cash_control_app;
      GRANT SELECT ON TABLE public.terminal_operator_sessions TO cash_control_app;
      GRANT SELECT ON TABLE public.workstations TO cash_control_app;
      GRANT SELECT ON TABLE public.businesses TO cash_control_app;
      GRANT SELECT ON TABLE public.business_members TO cash_control_app;
      GRANT SELECT ON TABLE public.treasury_resources TO cash_control_app;
      GRANT SELECT ON TABLE public.chart_of_accounts TO cash_control_app;
      GRANT SELECT ON TABLE public.financial_ledger_entries TO cash_control_app;
      GRANT SELECT ON TABLE public.economic_ledger_entries TO cash_control_app;
      GRANT SELECT ON TABLE public.journal_entries TO cash_control_app;
      GRANT SELECT ON TABLE public.operations TO cash_control_app;
      GRANT SELECT ON TABLE public.idempotency_records TO cash_control_app;
    `);

    console.log("5. Prohibiendo estrictamente INSERT, UPDATE, DELETE sobre ledgers y saldos...");
    await pool.query(`
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financial_ledger_entries FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.economic_ledger_entries FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.journal_entries FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.treasury_resources FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.operations FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.idempotency_records FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shifts FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.shift_participants FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.terminal_operator_sessions FROM cash_control_app;
    `);

    console.log("6. Concediendo EXECUTE sobre funciones públicas autorizadas...");
    await pool.query(`
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cash_control_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO cash_control_app;
    `);

    console.log("7. Verificando rol en pg_roles...");
    const roleRes = await pool.query(`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'cash_control_app';
    `);
    console.log("Propiedades de cash_control_app:", roleRes.rows[0]);

    console.log("✓ Rol cash_control_app configurado exitosamente con MÍNIMO PRIVILEGIO.");
  } finally {
    await pool.end();
  }
}

setupRestrictedRole().catch(console.error);
