import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Autenticación estricta del dueño para Cash-Control v2.
 *
 * GARANTÍAS DE SEGURIDAD:
 * 1. La identidad del dueño NUNCA se extrae del cuerpo de la petición ni de parámetros URL.
 * 2. Se verifica criptográficamente mediante HMAC-SHA256 contra una clave secreta del servidor.
 * 3. Si no hay sesión válida o el token está expirado/manipulado, se rechaza la petición.
 * 4. La identidad verificada (ownerUserId) es la ÚNICA que se inyecta en request.jwt.claim.sub.
 */

const V2_AUTH_SECRET =
  process.env.V2_AUTH_SECRET || "cash_control_v2_local_hmac_secret_2026_secure";

export const OWNER_SESSION_COOKIE = "cash_control_owner_session";

export interface OwnerSessionPayload {
  ownerUserId: string;
  businessId: string;
  role: "owner";
  exp: number; // Unix timestamp en segundos
  iat: number;
}

/**
 * Genera un token firmado de sesión para el dueño (usado tras login exitoso o en tests).
 */
export function createOwnerSessionToken(params: {
  ownerUserId: string;
  businessId: string;
  expiresInSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.expiresInSeconds || 24 * 60 * 60); // 24h por defecto

  const payload: OwnerSessionPayload = {
    ownerUserId: params.ownerUserId,
    businessId: params.businessId,
    role: "owner",
    iat: now,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", V2_AUTH_SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Valida un token de sesión y devuelve el payload verificado si es válido y vigente.
 */
export function verifyOwnerSessionToken(
  token: string,
): OwnerSessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Verificar firma HMAC-SHA256 con tiempo constante para prevenir timing attacks
  const expectedSignature = crypto
    .createHmac("sha256", V2_AUTH_SECRET)
    .update(payloadB64)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    ) as OwnerSessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expirado
    }

    if (
      payload.role !== "owner" ||
      !payload.ownerUserId ||
      !payload.businessId
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Obtiene la sesión autenticada del dueño a partir de la petición HTTP.
 * Busca primero en cookie HttpOnly y luego en cabecera Authorization (Bearer).
 */
export async function getAuthenticatedOwner(
  request: Request,
): Promise<OwnerSessionPayload | null> {
  let token: string | undefined;

  // 1. Intentar desde cookie HttpOnly
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
  } catch {
    // Si cookies() no está disponible (ej. en ciertos tests), buscar en headers
  }

  // 2. Si no hay cookie, buscar en Header Cookie directamente
  if (!token) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${OWNER_SESSION_COOKIE}=([^;]+)`),
      );
      if (match) {
        token = match[1];
      }
    }
  }

  // 3. Si no hay cookie, buscar en Authorization: Bearer <token>
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) return null;

  return verifyOwnerSessionToken(token);
}
