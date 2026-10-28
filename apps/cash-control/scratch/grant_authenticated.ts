import { Pool } from "pg";

async function grantAuthenticatedRole() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    console.log("Concediendo rol 'authenticated' a 'cash_control_app'...");
    await pool.query("GRANT authenticated TO cash_control_app;");
    console.log("✓ Concesión completada.");
  } finally {
    await pool.end();
  }
}

grantAuthenticatedRole().catch(console.error);
