// @ts-check
import "server-only";
import { createWorkstationClients } from "./clients.mjs";
import {
  safeString,
  sessionOperation,
  validText,
  WorkstationSessionError,
} from "./shared.mjs";

/** @typedef {{memberId: string, username: string, displayName: string, role: 'owner' | 'employee'}} BusinessCandidate */

/**
 * Strict projection for the initial access picker: only the fields the browser
 * needs to show a card. user_id, email, PIN hashes and notes never leave here.
 * @param {Record<string, unknown>} row
 * @param {Map<string, string>} displayNames
 * @returns {BusinessCandidate}
 */
function safeCandidate(row, displayNames) {
  const role = row.role;
  if (role !== "owner" && role !== "employee")
    throw new WorkstationSessionError("UNAVAILABLE");
  const displayName = displayNames.get(safeString(row.user_id));
  if (!displayName) throw new WorkstationSessionError("UNAVAILABLE");
  return {
    memberId: safeString(row.id),
    username: safeString(row.username),
    displayName,
    role,
  };
}

/**
 * Active members of an active business, used by the initial access screen.
 * Reads public.businesses, public.business_members and public.profiles with the
 * existing admin client; it never touches Supabase Auth.
 * @param {{businessSlug: string}} input
 * @param {import('./clients.mjs').WorkstationClients} [dependencies]
 * @returns {Promise<BusinessCandidate[]>}
 */
export async function listBusinessCandidates(input, dependencies) {
  return sessionOperation(async () => {
    if (!validText(input.businessSlug))
      throw new WorkstationSessionError("UNAVAILABLE");
    const { admin } = dependencies ?? createWorkstationClients();
    const business = await admin
      .from("businesses")
      .select("id")
      .eq("slug", input.businessSlug.trim())
      .eq("status", "active")
      .maybeSingle();
    if (business.error || !business.data)
      throw new WorkstationSessionError("UNAVAILABLE");

    const members = await admin
      .from("business_members")
      .select("id,user_id,username,role")
      .eq("business_id", business.data.id)
      .eq("status", "active");
    if (members.error || !Array.isArray(members.data))
      throw new WorkstationSessionError("UNAVAILABLE");
    const memberRows = members.data;
    if (memberRows.length === 0) return [];

    const userIds = [
      ...new Set(memberRows.map((row) => safeString(row.user_id))),
    ];
    const profiles = await admin
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds);
    if (profiles.error || !Array.isArray(profiles.data))
      throw new WorkstationSessionError("UNAVAILABLE");
    const profileRows = profiles.data;
    const displayNames = new Map(
      profileRows.map((row) => [
        safeString(row.id),
        safeString(row.display_name),
      ]),
    );

    return memberRows
      .map((row) => safeCandidate(row, displayNames))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  });
}
