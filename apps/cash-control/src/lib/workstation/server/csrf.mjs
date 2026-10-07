// @ts-check
import "server-only";

const LOCAL_ORIGINS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_PORTS = new Set(["3000", "3001"]);

export class OriginValidationError extends Error {
  /** @param {string} code */
  constructor(code) {
    super("No se pudo validar el origen de la solicitud.");
    this.name = "OriginValidationError";
    this.code = code;
  }
}

/** @param {string | undefined} configuredOrigin */
function parseConfiguredOrigin(configuredOrigin) {
  if (!configuredOrigin) return null;
  try {
    const url = new URL(configuredOrigin);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new OriginValidationError("INVALID_APP_ORIGIN");
    return url.origin;
  } catch (error) {
    if (error instanceof OriginValidationError) throw error;
    throw new OriginValidationError("INVALID_APP_ORIGIN");
  }
}

/** @param {{headers?: {get?: (name: string) => string | null}}} request
 * @param {Record<string, string | undefined>} [env]
 */
export function assertMutationOrigin(request, env = process.env) {
  const rawOrigin = request.headers?.get?.("origin");
  if (!rawOrigin) throw new OriginValidationError("MISSING_ORIGIN");

  let requestOrigin;
  try {
    requestOrigin = new URL(rawOrigin);
  } catch {
    throw new OriginValidationError("INVALID_ORIGIN");
  }

  const configuredOrigin = parseConfiguredOrigin(env.APP_ORIGIN);
  if (configuredOrigin) {
    if (requestOrigin.origin !== configuredOrigin)
      throw new OriginValidationError("ORIGIN_MISMATCH");
    return requestOrigin.origin;
  }

  if (env.NODE_ENV === "production")
    throw new OriginValidationError("MISSING_APP_ORIGIN");

  if (
    requestOrigin.protocol !== "http:" ||
    !LOCAL_ORIGINS.has(requestOrigin.hostname) ||
    !LOCAL_PORTS.has(requestOrigin.port)
  )
    throw new OriginValidationError("ORIGIN_MISMATCH");

  return requestOrigin.origin;
}
