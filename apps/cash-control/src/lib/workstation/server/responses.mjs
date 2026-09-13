// @ts-check
import "server-only";

/** @param {Record<string, unknown>} identity */
function publicIdentity(identity) {
  return {
    businessId: identity.businessId,
    memberId: identity.memberId,
    userId: identity.userId,
    username: identity.username,
    role: identity.role,
    displayName: identity.displayName,
  };
}

/** @param {{identity: Record<string, unknown>, workstationExpiresAt: string, operatorExpiresAt: string}} result */
export function publicSessionResponse(result) {
  return {
    identity: publicIdentity(result.identity),
    workstationExpiresAt: result.workstationExpiresAt,
    operatorExpiresAt: result.operatorExpiresAt,
  };
}

/** @param {Record<string, unknown> & {identity?: Record<string, unknown>}} result */
export function publicOperatorResponse(result) {
  const identity = result.identity ?? result;
  return {
    identity: publicIdentity(identity),
    operatorExpiresAt: result.operatorExpiresAt,
    ...(result.operatorSessionId
      ? { operatorSessionId: result.operatorSessionId }
      : {}),
    ...(result.workstationSessionId
      ? { workstationSessionId: result.workstationSessionId }
      : {}),
    ...(result.workstationExpiresAt
      ? { workstationExpiresAt: result.workstationExpiresAt }
      : {}),
  };
}
