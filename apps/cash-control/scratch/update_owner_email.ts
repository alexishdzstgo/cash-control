import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function main() {
  const pool = getV2LocalPool();
  try {
    await pool.query(
      "UPDATE auth.users SET email = 'dueno1@test.com' WHERE id = 'a9000000-0000-0000-0000-000000000001';"
    );
    const res = await pool.query("SELECT id, email FROM auth.users;");
    console.log("auth.users updated:", res.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
