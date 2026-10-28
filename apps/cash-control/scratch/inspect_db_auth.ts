import { Pool } from "pg";

async function main() {
  const p = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });
  try {
    const uCols = await p.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' ORDER BY ordinal_position;"
    );
    console.log("auth.users columns:", uCols.rows.map(r => r.column_name));

    const u = await p.query("SELECT id, email FROM auth.users;");
    console.log("=== auth.users ===");
    console.table(u.rows);

    const bCols = await p.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'businesses' ORDER BY ordinal_position;"
    );
    console.log("businesses columns:", bCols.rows.map(r => r.column_name));

    const b = await p.query("SELECT * FROM public.businesses;");
    console.log("=== businesses ===");
    console.table(b.rows);

    const m = await p.query("SELECT * FROM public.business_members;");
    console.log("=== business_members ===");
    console.table(m.rows);
  } finally {
    await p.end();
  }
}

main().catch(console.error);
