import { executeV2Rpc } from "../src/lib/api-v2/server/db";
import type { ResolveIncidenceResult } from "../src/lib/api-v2/types";

async function main() {
  const businessId = "b9000000-0000-0000-0000-000000000001";
  const workstationId = "ca900000-0000-0000-0000-000000000001";
  const operatorMemberId = "ba900000-0000-0000-0000-000000000001"; // owner
  const pin = "0000";

  console.log("Testing executeV2Rpc with rpc_resolve_incidence dry-call...");
  const res = await executeV2Rpc<ResolveIncidenceResult>("rpc_resolve_incidence", [
    businessId,
    workstationId,
    "IDEM-INC-DRY-RUN-01",
    "00000000-0000-0000-0000-000000000000", // fake incidence
    "reintegration_final",
    1000,
    null, // session_token
    operatorMemberId,
    pin,
    null, // linked_operation_id
    null, // linked_admin_movement_id
    "Dry run notes",
    null, // supervisor_pin
    null  // supervisor_member_id
  ], {
    authenticatedUserId: "a9000000-0000-0000-0000-000000000001"
  });

  console.log("Result:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
