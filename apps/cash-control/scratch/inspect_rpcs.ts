import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function main() {
  const pool = getV2LocalPool();
  try {
    const res = await pool.query(`
      SELECT id, code, name, type
      FROM public.chart_of_accounts
      WHERE business_id = 'b9000000-0000-0000-0000-000000000001';
    `);
    console.log("Chart of Accounts for Business A:", res.rows);

    const polRes = await pool.query(`
      SELECT tablename, policyname, roles, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('shifts', 'shift_participants', 'terminal_operator_sessions');
    `);
    console.log("Policies:");
    for (const r of polRes.rows) {
      console.log(` - ${r.tablename} / ${r.policyname} (roles: ${r.roles}): ${r.qual}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
