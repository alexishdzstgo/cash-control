import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function main() {
  const pool = getV2LocalPool();
  try {
    const res = await pool.query(`
      SELECT 
        u.id AS owner_user_id,
        u.email,
        b.id AS business_id,
        b.commercial_name,
        b.legal_name,
        b.status AS business_status
      FROM auth.users u
      JOIN public.businesses b ON b.owner_user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) AND b.status = 'active'
      LIMIT 1;
    `, ["dueno1@test.com"]);

    console.log("Found owner:", res.rows[0]);

    const res2 = await pool.query(`
      SELECT 
        u.id AS owner_user_id,
        u.email,
        b.id AS business_id,
        b.commercial_name,
        b.legal_name,
        b.status AS business_status
      FROM auth.users u
      JOIN public.businesses b ON b.owner_user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) AND b.status = 'active'
      LIMIT 1;
    `, ["dueno2@test.com"]);

    console.log("Found owner 2 (Biz B):", res2.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
