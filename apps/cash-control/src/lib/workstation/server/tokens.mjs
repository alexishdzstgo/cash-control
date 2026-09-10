// @ts-check
import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const WORKSTATION_TTL_MS = 24 * 60 * 60 * 1000;
export const OPERATOR_TTL_MS = 12 * 60 * 60 * 1000;
export const WORKSTATION_COOKIE_NAME = "cc_workstation";
export const OPERATOR_COOKIE_NAME = "cc_operator";

// Constants only. No cookies are read/written until Phase 2B.2.
export const SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

/** @param {unknown} token */
export function isSessionToken(token) {
  return (
    typeof token === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(token) &&
    Buffer.from(token, "base64url").toString("base64url") === token
  );
}

/** @param {string} token */
export function hashSessionToken(token) {
  if (!isSessionToken(token)) throw new Error("Token de sesión inválido.");
  return createHash("sha256").update(token, "utf8").digest("hex");
}
