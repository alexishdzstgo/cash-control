// @ts-check
import "server-only";
import { createWorkstationClients } from "./clients.mjs";
import { safeIdentity, validText, WorkstationSessionError } from "./shared.mjs";

/** @typedef {{businessSlug: string, username: string, password: string}} PasswordInput */

/** Password proof only, never the persistent Cash Control session.
 * @param {PasswordInput} input
 * @param {import('./clients.mjs').WorkstationClients} [dependencies]
 */
export async function authenticateMemberPassword(input, dependencies) {
  try {
    if (
      !validText(input.businessSlug) ||
      !validText(input.username) ||
      !validText(input.password)
    )
      throw new Error();
    const { admin, createPasswordClient } =
      dependencies ?? createWorkstationClients();
    const business = await admin
      .from("businesses")
      .select("id")
      .eq("slug", input.businessSlug.trim())
      .eq("status", "active")
      .maybeSingle();
    if (business.error || !business.data) throw new Error();
    const found = await admin.rpc("admin_find_member_by_username", {
      p_business_id: business.data.id,
      p_username: input.username.trim(),
    });
    if (found.error || !found.data) throw new Error();
    const member = await admin
      .from("business_members")
      .select("id,business_id,user_id,username,role")
      .eq("id", found.data)
      .eq("business_id", business.data.id)
      .eq("status", "active")
      .maybeSingle();
    if (member.error || !member.data) throw new Error();
    const profile = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", member.data.user_id)
      .single();
    if (profile.error || !profile.data) throw new Error();
    const authUser = await admin.auth.admin.getUserById(member.data.user_id);
    if (
      authUser.error ||
      authUser.data.user?.id !== member.data.user_id ||
      !authUser.data.user.email
    )
      throw new Error();

    const client = createPasswordClient();
    let identity = null;
    let discardFailed = false;
    try {
      const proof = await client.auth.signInWithPassword({
        email: authUser.data.user.email,
        password: input.password,
      });
      if (proof.error || proof.data.user?.id !== member.data.user_id)
        throw new Error();
      identity = safeIdentity({
        business_id: member.data.business_id,
        member_id: member.data.id,
        user_id: member.data.user_id,
        username: member.data.username,
        role: member.data.role,
        display_name: profile.data.display_name,
      });
    } finally {
      // Revoke only this transient refresh session; never sign out other devices.
      // No access/refresh token is copied, returned, persisted or logged here.
      try {
        const discarded = await client.auth.signOut({ scope: "local" });
        discardFailed = Boolean(discarded.error);
      } catch {
        discardFailed = true;
      }
    }
    if (!identity || discardFailed) throw new Error();
    return identity;
  } catch {
    // Same error for unknown/suspended business, member, bad password and SDK failure.
    throw new WorkstationSessionError("INVALID_CREDENTIALS");
  }
}
