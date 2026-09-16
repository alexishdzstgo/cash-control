import "server-only";
import type { NextRequest } from "next/server";
import { listBusinessCandidates } from "@/lib/workstation/server/candidates.mjs";
import { errorResponse, invalidInputResponse, jsonResponse } from "../_shared";

export async function GET(request: NextRequest) {
  const businessSlug = request.nextUrl.searchParams.get("businessSlug");
  if (!businessSlug?.trim()) return invalidInputResponse();

  try {
    const candidates = await listBusinessCandidates({ businessSlug });
    return jsonResponse({ candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
