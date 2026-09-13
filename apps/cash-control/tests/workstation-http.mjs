import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearOperatorCookie,
  clearSessionCookies,
  getSessionCookieOptions,
  readSessionCookies,
  setSessionCookies,
} from "../src/lib/workstation/server/cookies.mjs";
import {
  assertMutationOrigin,
  OriginValidationError,
} from "../src/lib/workstation/server/csrf.mjs";
import {
  publicOperatorResponse,
  publicSessionResponse,
} from "../src/lib/workstation/server/responses.mjs";

function fakeRequest(origin, cookies = {}) {
  return {
    headers: { get: (name) => (name === "origin" ? origin : null) },
    cookies: { get: (name) => ({ value: cookies[name] }) },
  };
}

function fakeResponse() {
  const calls = [];
  return {
    calls,
    cookies: {
      set: (...args) => calls.push(args),
    },
  };
}

const identity = {
  businessId: "business-id",
  memberId: "member-id",
  userId: "user-id",
  username: "alice",
  role: "owner",
  displayName: "Alice Test",
};

test("session cookies use HttpOnly, SameSite=Lax, root path and environment Secure", () => {
  assert.deepEqual(getSessionCookieOptions({ NODE_ENV: "development" }), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  assert.deepEqual(getSessionCookieOptions({ NODE_ENV: "production" }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
});

test("session cookie abstraction reads and writes only opaque session cookies", () => {
  assert.deepEqual(
    readSessionCookies(
      fakeRequest("http://localhost:3000", {
        cc_workstation: "station-token",
        cc_operator: "operator-token",
        member_id: "must-not-be-read",
      }),
    ),
    {
      workstationToken: "station-token",
      operatorToken: "operator-token",
    },
  );

  const response = fakeResponse();
  setSessionCookies(
    response,
    { workstationToken: "station-token", operatorToken: "operator-token" },
    { NODE_ENV: "development" },
  );
  assert.deepEqual(
    response.calls.map(([name, value]) => [name, value]),
    [
      ["cc_workstation", "station-token"],
      ["cc_operator", "operator-token"],
    ],
  );
  assert.equal(response.calls[0][2].httpOnly, true);
  assert.equal(response.calls[0][2].sameSite, "lax");
  assert.equal(response.calls[0][2].secure, false);
  assert.equal(response.calls[0][2].path, "/");
  assert.equal("domain" in response.calls[0][2], false);
});

test("lock clears only the operator cookie and close clears both cookies", () => {
  const lockResponse = fakeResponse();
  clearOperatorCookie(lockResponse, { NODE_ENV: "development" });
  assert.deepEqual(
    lockResponse.calls.map(([name]) => name),
    ["cc_operator"],
  );
  assert.equal(lockResponse.calls[0][1], "");
  assert.equal(lockResponse.calls[0][2].maxAge, 0);

  const closeResponse = fakeResponse();
  clearSessionCookies(closeResponse, { NODE_ENV: "development" });
  assert.deepEqual(
    closeResponse.calls.map(([name]) => name),
    ["cc_operator", "cc_workstation"],
  );
});

test("Origin validation accepts configured or local origins and rejects missing/foreign origins", () => {
  assert.equal(
    assertMutationOrigin(fakeRequest("https://cash-control.example"), {
      NODE_ENV: "production",
      APP_ORIGIN: "https://cash-control.example",
    }),
    "https://cash-control.example",
  );
  assert.equal(
    assertMutationOrigin(fakeRequest("http://127.0.0.1:3001"), {
      NODE_ENV: "development",
    }),
    "http://127.0.0.1:3001",
  );
  assert.throws(
    () =>
      assertMutationOrigin(fakeRequest(null), {
        NODE_ENV: "development",
      }),
    (error) =>
      error instanceof OriginValidationError && error.code === "MISSING_ORIGIN",
  );
  assert.throws(
    () =>
      assertMutationOrigin(fakeRequest("https://evil.example"), {
        NODE_ENV: "production",
        APP_ORIGIN: "https://cash-control.example",
      }),
    (error) =>
      error instanceof OriginValidationError &&
      error.code === "ORIGIN_MISMATCH",
  );
  assert.throws(
    () =>
      assertMutationOrigin(fakeRequest("http://localhost:4000"), {
        NODE_ENV: "development",
      }),
    (error) =>
      error instanceof OriginValidationError &&
      error.code === "ORIGIN_MISMATCH",
  );
  assert.throws(
    () =>
      assertMutationOrigin(fakeRequest("http://localhost"), {
        NODE_ENV: "development",
      }),
    (error) =>
      error instanceof OriginValidationError &&
      error.code === "ORIGIN_MISMATCH",
  );
});

test("production requires APP_ORIGIN and never falls back to wildcard behavior", () => {
  assert.throws(
    () =>
      assertMutationOrigin(fakeRequest("https://cash-control.example"), {
        NODE_ENV: "production",
      }),
    (error) =>
      error instanceof OriginValidationError &&
      error.code === "MISSING_APP_ORIGIN",
  );
});

test("public session responses contain safe identity only, never tokens or auth secrets", () => {
  const result = {
    identity: {
      ...identity,
      token_hash: "TOKEN_HASH_SECRET",
      access_token: "ACCESS_SECRET",
      refresh_token: "REFRESH_SECRET",
      pin_hash: "PIN_HASH_SECRET",
    },
    workstationToken: "station-token",
    operatorToken: "operator-token",
    workstationExpiresAt: "2030-01-01T00:00:00.000Z",
    operatorExpiresAt: "2030-01-01T00:00:00.000Z",
    operatorSessionId: "operator-session-id",
    workstationSessionId: "workstation-session-id",
  };
  const serialized = JSON.stringify({
    start: publicSessionResponse(result),
    resolve: publicOperatorResponse(result),
  });
  for (const secret of [
    "station-token",
    "operator-token",
    "TOKEN_HASH_SECRET",
    "ACCESS_SECRET",
    "REFRESH_SECRET",
    "PIN_HASH_SECRET",
  ])
    assert.equal(serialized.includes(secret), false, secret);
  assert.equal(serialized.includes("operator-session-id"), true);
});
