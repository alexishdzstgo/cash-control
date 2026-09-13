// @ts-check
import "server-only";
import { OPERATOR_COOKIE_NAME, WORKSTATION_COOKIE_NAME } from "./tokens.mjs";

/** @typedef {{httpOnly: true, secure: boolean, sameSite: 'lax', path: '/'}} SessionCookieOptions */
/** @typedef {import('next/server').NextResponse} NextResponse */

/** @param {Record<string, string | undefined>} [env] @returns {SessionCookieOptions} */
export function getSessionCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/** @param {{cookies?: {get?: (name: string) => {value?: unknown} | undefined}}} request */
export function readSessionCookies(request) {
  /** @param {string} name */
  const cookieValue = (name) => {
    const value = request.cookies?.get?.(name)?.value;
    return typeof value === "string" && value.length > 0 ? value : null;
  };
  return {
    workstationToken: cookieValue(WORKSTATION_COOKIE_NAME),
    operatorToken: cookieValue(OPERATOR_COOKIE_NAME),
  };
}

/** @param {NextResponse} response
 * @param {{workstationToken: string, operatorToken: string}} session
 * @param {Record<string, string | undefined>} [env]
 */
export function setSessionCookies(response, session, env = process.env) {
  const options = getSessionCookieOptions(env);
  response.cookies.set(
    WORKSTATION_COOKIE_NAME,
    session.workstationToken,
    options,
  );
  response.cookies.set(OPERATOR_COOKIE_NAME, session.operatorToken, options);
  return response;
}

/** @param {NextResponse} response
 * @param {string} operatorToken
 * @param {Record<string, string | undefined>} [env]
 */
export function setOperatorCookie(response, operatorToken, env = process.env) {
  response.cookies.set(
    OPERATOR_COOKIE_NAME,
    operatorToken,
    getSessionCookieOptions(env),
  );
  return response;
}

/** @param {NextResponse} response
 * @param {string} name
 * @param {Record<string, string | undefined>} [env]
 */
function clearCookie(response, name, env = process.env) {
  response.cookies.set(name, "", {
    ...getSessionCookieOptions(env),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

/** @param {NextResponse} response @param {Record<string, string | undefined>} [env] */
export function clearOperatorCookie(response, env = process.env) {
  return clearCookie(response, OPERATOR_COOKIE_NAME, env);
}

/** @param {NextResponse} response @param {Record<string, string | undefined>} [env] */
export function clearSessionCookies(response, env = process.env) {
  clearCookie(response, OPERATOR_COOKIE_NAME, env);
  return clearCookie(response, WORKSTATION_COOKIE_NAME, env);
}
