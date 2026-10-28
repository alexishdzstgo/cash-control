import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function main() {
  const p = getV2LocalPool();
  try {
    const res = await p.query(
      `SELECT u.id as user_id, u.email, b.id as business_id, b.legal_name, b.commercial_name 
       FROM auth.users u 
       JOIN public.businesses b ON b.owner_user_id = u.id;`
    );
    console.log("Found:", res.rows);
  } finally {
    await p.end();
  }
}

main().catch(console.error);
