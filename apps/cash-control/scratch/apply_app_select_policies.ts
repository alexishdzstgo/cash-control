import { Pool } from "pg";

async function applyAppSelectPolicies() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    console.log("Aplicando políticas de SELECT para rol restringido cash_control_app...");
    const tables = [
      "businesses",
      "workstations",
      "business_members",
      "shifts",
      "shift_participants",
      "terminal_operator_sessions",
      "treasury_resources",
      "chart_of_accounts",
      "operations",
      "journal_entries",
      "financial_ledger_entries",
      "economic_ledger_entries",
      "idempotency_records",
    ];

    for (const tbl of tables) {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = '${tbl}' AND policyname = '${tbl}_app_select'
          ) THEN
            CREATE POLICY ${tbl}_app_select ON public.${tbl} 
            FOR SELECT TO cash_control_app USING (true);
          END IF;
        END
        $$;
      `);
      console.log(` - Política SELECT creada para ${tbl}`);
    }

    console.log("✓ Políticas RLS de SELECT para cash_control_app aplicadas exitosamente.");
  } finally {
    await pool.end();
  }
}

applyAppSelectPolicies().catch(console.error);
