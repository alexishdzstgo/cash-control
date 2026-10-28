import { getV2LocalPool } from "../src/lib/api-v2/server/db";

async function main() {
  const pool = getV2LocalPool();
  try {
    const res1 = await pool.query(
      "SELECT public.fn_verify_member_pin($1, $2, $3) AS valid;",
      ["b9000000-0000-0000-0000-000000000001", "ba900000-0000-0000-0000-000000000001", "0000"]
    );
    console.log("PIN 0000 for Owner:", res1.rows[0]);

    const res2 = await pool.query(
      "SELECT public.fn_verify_member_pin($1, $2, $3) AS valid;",
      ["b9000000-0000-0000-0000-000000000001", "ba900000-0000-0000-0000-000000000002", "1111"]
    );
    console.log("PIN 1111 for Cashier:", res2.rows[0]);

    const res3 = await pool.query(
      "SELECT public.fn_verify_member_pin($1, $2, $3) AS valid;",
      ["b9000000-0000-0000-0000-000000000001", "ba900000-0000-0000-0000-000000000002", "9999"]
    );
    console.log("PIN 9999 (invalid) for Cashier:", res3.rows[0]);
  } catch (err) {
    console.error("Error calling fn_verify_member_pin:", err);
  } finally {
    await pool.end();
  }
}

main();
