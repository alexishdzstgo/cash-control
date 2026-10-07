import "server-only";
import type { NextRequest } from "next/server";
import { readSessionCookies } from "@/lib/workstation/server/cookies.mjs";
import { listActivatedMembers } from "@/lib/workstation/server/sessions.mjs";
import { errorResponse, jsonResponse } from "../_shared";

export async function GET(request: NextRequest) {
  const { workstationToken } = readSessionCookies(request);
  if (!workstationToken)
    return jsonResponse({ state: "NO_WORKSTATION" as const, members: [] });

  try {
    const members = await listActivatedMembers({ workstationToken });
    return jsonResponse({ state: "ACTIVE" as const, members });
  } catch (error) {
    return errorResponse(error);
  }
}
