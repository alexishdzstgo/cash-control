import { Pool } from "pg";

async function addSuspenseAccount() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
  const SUSPENSE_ID = "cd900000-0000-0000-0000-000000000005";

  try {
    await pool.query(`
      INSERT INTO public.chart_of_accounts (id, business_id, code, name, type)
      VALUES ($1, $2, 'CUSTODY_DISCREPANCY_SUSPENSE', 'Cuenta de Descuadres y Arqueos', 'clearing_control')
      ON CONFLICT (business_id, code) DO NOTHING;
    `, [SUSPENSE_ID, BIZ_ID]);
    console.log("CUSTODY_DISCREPANCY_SUSPENSE account verified.");
  } finally {
    await pool.end();
  }
}

addSuspenseAccount().catch(console.error);
