import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { authenticateMemberPassword } from "../src/lib/workstation/server/authenticate-member.mjs";
import { createWorkstationClients } from "../src/lib/workstation/server/clients.mjs";
import {
  activateMemberWithPassword,
  closeWorkstation,
  lockCurrentOperator,
  resolveCurrentOperator,
  startWorkstationWithPassword,
  unlockOperatorWithPin,
} from "../src/lib/workstation/server/sessions.mjs";
import {
  generateSessionToken,
  hashSessionToken,
  OPERATOR_TTL_MS,
  SESSION_COOKIE_OPTIONS,
  WORKSTATION_TTL_MS,
} from "../src/lib/workstation/server/tokens.mjs";

const businessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const secondMemberId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";
const secondUserId = "66666666-6666-4666-8666-666666666666";
const otherMemberId = "77777777-7777-4777-8777-777777777777";
const password = "Test-only-password!";
const credentials = { businessSlug: "shop", username: "Alice", password };
const poison = {
  internal_notes: "NOTE_SECRET",
  pin_hash: "HASH_SECRET",
  email: "member-hidden@example.com",
  password,
  access_token: "ACCESS_SECRET",
  refresh_token: "REFRESH_SECRET",
  token_hash: "TOKEN_HASH_SECRET",
};

function fixture() {
  const calls = [];
  const options = {};
  const businesses = [
    { id: businessId, slug: "shop", status: "active" },
    { id: otherBusinessId, slug: "other", status: "active" },
  ];
  const members = [
    {
      id: memberId,
      business_id: businessId,
      user_id: userId,
      username: "Alice",
      role: "owner",
      status: "active",
    },
    {
      id: secondMemberId,
      business_id: businessId,
      user_id: secondUserId,
      username: "Bob",
      role: "employee",
      status: "active",
    },
    {
      id: otherMemberId,
      business_id: otherBusinessId,
      user_id: randomUUID(),
      username: "Other",
      role: "owner",
      status: "active",
    },
  ];
  const profiles = members.map((m) => ({
    id: m.user_id,
    display_name: `${m.username} Test`,
  }));
  const stations = new Map();
  const operators = new Map();
  const activations = new Set();
  const failures = new Map();
  const good = (data) => ({ data, error: null });
  const bad = () => ({
    data: null,
    error: new Error(Object.values(poison).join(" ")),
  });
  function station(hash) {
    const w = stations.get(hash);
    return w &&
      !w.revoked &&
      Date.parse(w.workstation_expires_at) > Date.now() &&
      businesses.some((b) => b.id === w.business_id && b.status === "active")
      ? w
      : null;
  }
  function identity(m) {
    return {
      business_id: m.business_id,
      member_id: m.id,
      user_id: m.user_id,
      username: m.username,
      role: m.role,
      display_name: `${m.username} Test`,
      ...poison,
    };
  }
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          calls.push(["auth.getUserById", id]);
          return good({ user: { id, email: `member-${id}@example.com` } });
        },
      },
    },
    from(table) {
      const filters = [];
      const query = {
        select(columns) {
          calls.push([`${table}.select`, columns]);
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        async maybeSingle() {
          if (options.queryThrows)
            throw new Error(Object.values(poison).join(" "));
          const data = { businesses, business_members: members, profiles }[
            table
          ];
          return good(
            data.find((row) =>
              filters.every(([key, value]) => row[key] === value),
            ) ?? null,
          );
        },
        async single() {
          return query.maybeSingle();
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (options.throwAt === name)
        throw new Error(Object.values(poison).join(" "));
      if (options.failAt === name) return bad();
      if (name === "admin_find_member_by_username")
        return good(
          members.find(
            (m) =>
              m.business_id === args.p_business_id &&
              m.username.toLowerCase() === args.p_username.toLowerCase(),
          )?.id ?? null,
        );
      if (name === "admin_create_workstation_session") {
        const w = {
          workstation_session_id: randomUUID(),
          business_id: args.p_business_id,
          business_slug: "shop",
          workstation_expires_at: args.p_expires_at,
        };
        stations.set(args.p_token_hash, w);
        activations.add(
          `${w.workstation_session_id}:${args.p_created_by_member_id}`,
        );
        return good(w.workstation_session_id);
      }
      if (name === "admin_resolve_workstation_session") {
        const w = station(args.p_token_hash);
        return good(w ? [w] : []);
      }
      if (name === "admin_activate_workstation_member") {
        const w = station(args.p_workstation_token_hash);
        activations.add(`${w.workstation_session_id}:${args.p_member_id}`);
        return good(null);
      }
      if (name === "admin_resolve_workstation_member") {
        const w = station(args.p_workstation_token_hash);
        const m = members.find(
          (m) =>
            m.id === args.p_member_id &&
            m.business_id === w?.business_id &&
            m.status === "active",
        );
        return good(
          w && m && activations.has(`${w.workstation_session_id}:${m.id}`)
            ? [identity(m)]
            : [],
        );
      }
      if (name === "admin_verify_member_pin") {
        const verified = !options.pinFalse && args.p_pin === "1234";
        if (!verified)
          failures.set(
            args.p_member_id,
            (failures.get(args.p_member_id) ?? 0) + 1,
          );
        return good(verified);
      }
      if (name === "admin_issue_operator_session") {
        const w = station(args.p_workstation_token_hash);
        const m = members.find(
          (m) =>
            m.id === args.p_member_id &&
            m.business_id === w?.business_id &&
            m.status === "active",
        );
        if (!w || !m || !activations.has(`${w.workstation_session_id}:${m.id}`))
          return bad();
        for (const o of operators.values())
          if (o.workstation_session_id === w.workstation_session_id)
            o.revoked = true;
        const o = {
          ...identity(m),
          operator_session_id: randomUUID(),
          workstation_session_id: w.workstation_session_id,
          workstation_expires_at: w.workstation_expires_at,
          operator_expires_at: args.p_expires_at,
          stationHash: args.p_workstation_token_hash,
        };
        operators.set(args.p_token_hash, o);
        return options.lostIssueResponse ? bad() : good(o.operator_session_id);
      }
      if (name === "admin_resolve_operator_session") {
        const o = operators.get(args.p_token_hash);
        return good(
          o &&
            !o.revoked &&
            Date.parse(o.operator_expires_at) > Date.now() &&
            station(o.stationHash) &&
            members.some((m) => m.id === o.member_id && m.status === "active")
            ? [o]
            : [],
        );
      }
      if (name === "admin_revoke_operator_session") {
        const o = operators.get(args.p_token_hash);
        if (o) o.revoked = true;
        return good(null);
      }
      if (name === "admin_revoke_workstation_session") {
        const w = stations.get(args.p_token_hash);
        if (w) w.revoked = true;
        for (const o of operators.values())
          if (o.stationHash === args.p_token_hash) o.revoked = true;
        return good(null);
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const clients = {
    admin,
    createPasswordClient() {
      calls.push(["password.client"]);
      return {
        auth: {
          async signInWithPassword(input) {
            calls.push(["password.signIn", input]);
            if (options.passwordThrows)
              throw new Error(Object.values(poison).join(" "));
            if (input.password !== password)
              return { data: { user: null }, error: new Error("invalid") };
            const m = members.find(
              (m) => input.email === `member-${m.user_id}@example.com`,
            );
            return good({
              user: { id: options.wrongAuthId ? randomUUID() : m.user_id },
              get session() {
                throw new Error(
                  "Must not read transient access/refresh tokens",
                );
              },
            });
          },
          async signOut(input) {
            calls.push(["password.signOut", input]);
            return options.discardFails ? bad() : { error: null };
          },
        },
      };
    },
  };
  return {
    clients,
    options,
    calls,
    members,
    businesses,
    stations,
    operators,
    activations,
    failures,
  };
}

function assertSafe(value) {
  const serialized = JSON.stringify(value);
  for (const secret of Object.values(poison))
    assert.ok(!serialized.includes(secret), secret);
}

test("password returns safe identity, verifies returned Auth ID and discards transient session locally", async () => {
  const f = fixture();
  const identity = await authenticateMemberPassword(credentials, f.clients);
  assert.deepEqual(identity, {
    businessId,
    memberId,
    userId,
    username: "Alice",
    role: "owner",
    displayName: "Alice Test",
  });
  assertSafe(identity);
  assert.deepEqual(f.calls.find(([name]) => name === "password.signOut")[1], {
    scope: "local",
  });
  assert.equal(
    f.calls.some(([name]) => name === "admin_create_workstation_session"),
    false,
  );
});

test("password clients use publishable key, are isolated and stateless", () => {
  const calls = [];
  const clients = createWorkstationClients(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "secret-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
    },
    (...args) => {
      const client = {};
      calls.push({ args, client });
      return client;
    },
  );
  assert.notEqual(
    clients.createPasswordClient(),
    clients.createPasswordClient(),
  );
  assert.deepEqual(
    calls.map((c) => c.args[1]),
    ["secret-key", "public-key", "public-key"],
  );
  for (const { args } of calls)
    assert.deepEqual(args[2], {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
});

test("wrong password and different returned Auth ID never create a workstation", async () => {
  for (const wrongAuthId of [false, true]) {
    const f = fixture();
    f.options.wrongAuthId = wrongAuthId;
    await assert.rejects(
      startWorkstationWithPassword(
        { ...credentials, password: wrongAuthId ? password : "wrong" },
        f.clients,
      ),
      { code: "INVALID_CREDENTIALS" },
    );
    assert.equal(f.stations.size, 0);
    assert.equal(f.operators.size, 0);
    assert.equal(
      f.calls.filter(([name]) => name === "password.signOut").length,
      1,
    );
  }
});

test("suspended business/member and empty input fail without password authentication", async () => {
  for (const mode of ["business", "member", "empty"]) {
    const f = fixture();
    if (mode === "business") f.businesses[0].status = "suspended";
    if (mode === "member") f.members[0].status = "suspended";
    await assert.rejects(
      authenticateMemberPassword(
        { ...credentials, username: mode === "empty" ? " " : "Alice" },
        f.clients,
      ),
    );
    assert.equal(
      f.calls.some(([name]) => name === "password.signIn"),
      false,
    );
  }
});

test("password transport/disposal errors suppress SDK secrets and do not issue sessions", async () => {
  for (const flag of ["passwordThrows", "queryThrows", "discardFails"]) {
    const f = fixture();
    f.options[flag] = true;
    await assert.rejects(
      startWorkstationWithPassword(credentials, f.clients),
      (error) => {
        assertSafe({ message: error.message, cause: error.cause });
        return error.code === "INVALID_CREDENTIALS";
      },
    );
    assert.equal(f.stations.size, 0);
  }
});

test("start sends only SHA-256 hashes to RPC and returns bounded server-only token handoff", async () => {
  const f = fixture();
  const before = Date.now();
  const result = await startWorkstationWithPassword(credentials, f.clients);
  const after = Date.now();
  assert.notEqual(result.workstationToken, result.operatorToken);
  for (const token of [result.workstationToken, result.operatorToken]) {
    assert.equal(Buffer.from(token, "base64url").length, 32);
    assert.match(hashSessionToken(token), /^[0-9a-f]{64}$/);
    for (const [name, args] of f.calls)
      if (name.startsWith("admin_"))
        assert.ok(!JSON.stringify(args).includes(token));
  }
  const stationCall = f.calls.find(
    ([name]) => name === "admin_create_workstation_session",
  )[1];
  const operatorCall = f.calls.find(
    ([name]) => name === "admin_issue_operator_session",
  )[1];
  assert.equal(
    stationCall.p_token_hash,
    hashSessionToken(result.workstationToken),
  );
  assert.equal(
    operatorCall.p_token_hash,
    hashSessionToken(result.operatorToken),
  );
  assert.equal(operatorCall.p_workstation_token_hash, stationCall.p_token_hash);
  assert.ok(
    Date.parse(result.workstationExpiresAt) >= before + WORKSTATION_TTL_MS &&
      Date.parse(result.workstationExpiresAt) <= after + WORKSTATION_TTL_MS,
  );
  assert.ok(Date.parse(result.operatorExpiresAt) <= after + OPERATOR_TTL_MS);
  assertSafe(result.identity);
});

test("password activation derives business from workstation, ignoring extra browser business fields", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  const activated = await activateMemberWithPassword(
    {
      workstationToken: start.workstationToken,
      username: "Bob",
      password,
      businessSlug: "other",
      businessId: otherBusinessId,
    },
    f.clients,
  );
  assert.equal(activated.identity.memberId, secondMemberId);
  assert.equal(activated.identity.businessId, businessId);
  assert.equal(
    await resolveCurrentOperator(start, f.clients),
    null,
    "previous operator invalidated",
  );
  assert.equal(
    (
      await resolveCurrentOperator(
        {
          workstationToken: start.workstationToken,
          operatorToken: activated.operatorToken,
        },
        f.clients,
      )
    ).userId,
    secondUserId,
  );
});

test("password activation rejects a different business resolved by slug", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  f.stations.get(hashSessionToken(start.workstationToken)).business_slug =
    "other";
  await assert.rejects(
    activateMemberWithPassword(
      { workstationToken: start.workstationToken, username: "Other", password },
      f.clients,
    ),
    { code: "INVALID_CREDENTIALS" },
  );
  assert.equal(
    f.calls.some(([name]) => name === "admin_activate_workstation_member"),
    false,
  );
});

test("PIN rejects nonactivated, foreign, or suspended members before verification", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  for (const selected of [secondMemberId, otherMemberId])
    await assert.rejects(
      unlockOperatorWithPin(
        {
          workstationToken: start.workstationToken,
          memberId: selected,
          pin: "1234",
        },
        f.clients,
      ),
    );
  f.members[0].status = "suspended";
  await assert.rejects(
    unlockOperatorWithPin(
      { workstationToken: start.workstationToken, memberId, pin: "1234" },
      f.clients,
    ),
  );
  assert.equal(
    f.calls.some(([name]) => name === "admin_verify_member_pin"),
    false,
  );
});

test("false PIN persists attempt and does not issue an operator; correct PIN rotates it", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  const initialIssues = f.calls.filter(
    ([name]) => name === "admin_issue_operator_session",
  ).length;
  await assert.rejects(
    unlockOperatorWithPin(
      { workstationToken: start.workstationToken, memberId, pin: "0000" },
      f.clients,
    ),
    { code: "INVALID_PIN" },
  );
  assert.equal(f.failures.get(memberId), 1);
  assert.equal(
    f.calls.filter(([name]) => name === "admin_issue_operator_session").length,
    initialIssues,
  );
  const unlocked = await unlockOperatorWithPin(
    { workstationToken: start.workstationToken, memberId, pin: "1234" },
    f.clients,
  );
  assert.notEqual(unlocked.operatorToken, start.operatorToken);
  assert.equal(unlocked.identity.userId, userId);
  assert.equal(await resolveCurrentOperator(start, f.clients), null);
});

test("operator TTL is capped by remaining station lifetime", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  const expiry = new Date(Date.now() + 60_000).toISOString();
  f.stations.get(
    hashSessionToken(start.workstationToken),
  ).workstation_expires_at = expiry;
  const unlocked = await unlockOperatorWithPin(
    { workstationToken: start.workstationToken, memberId, pin: "1234" },
    f.clients,
  );
  assert.equal(unlocked.operatorExpiresAt, expiry);
});

test("resolve returns only safe current actor and rejects mismatched tokens/expired/revoked sessions", async () => {
  const f = fixture();
  const first = await startWorkstationWithPassword(credentials, f.clients);
  const second = await startWorkstationWithPassword(credentials, f.clients);
  const actor = await resolveCurrentOperator(first, f.clients);
  assertSafe(actor);
  assert.equal(actor.userId, userId);
  assert.equal(
    await resolveCurrentOperator(
      {
        workstationToken: second.workstationToken,
        operatorToken: first.operatorToken,
      },
      f.clients,
    ),
    null,
  );
  f.operators.get(hashSessionToken(first.operatorToken)).operator_expires_at =
    new Date(Date.now() - 1).toISOString();
  assert.equal(await resolveCurrentOperator(first, f.clients), null);
  await closeWorkstation(second, f.clients);
  assert.equal(await resolveCurrentOperator(second, f.clients), null);
});

test("lock revokes only operator; station and activation survive until close", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  await lockCurrentOperator(start, f.clients);
  await lockCurrentOperator(start, f.clients);
  assert.equal(await resolveCurrentOperator(start, f.clients), null);
  assert.ok(!f.stations.get(hashSessionToken(start.workstationToken)).revoked);
  assert.equal(f.activations.size, 1);
  const unlocked = await unlockOperatorWithPin(
    { workstationToken: start.workstationToken, memberId, pin: "1234" },
    f.clients,
  );
  await closeWorkstation(start, f.clients);
  await closeWorkstation(start, f.clients);
  assert.equal(
    await resolveCurrentOperator({ ...start, ...unlocked }, f.clients),
    null,
  );
  assert.equal(f.operators.size, 2, "revocation keeps records");
  await assert.rejects(
    unlockOperatorWithPin(
      { workstationToken: start.workstationToken, memberId, pin: "1234" },
      f.clients,
    ),
  );
});

test("expired workstation prevents activation and PIN calls", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  f.stations.get(
    hashSessionToken(start.workstationToken),
  ).workstation_expires_at = new Date(Date.now() - 1).toISOString();
  await assert.rejects(
    activateMemberWithPassword(
      { workstationToken: start.workstationToken, username: "Bob", password },
      f.clients,
    ),
    { code: "INVALID_SESSION" },
  );
  await assert.rejects(
    unlockOperatorWithPin(
      { workstationToken: start.workstationToken, memberId, pin: "1234" },
      f.clients,
    ),
    { code: "INVALID_SESSION" },
  );
  assert.equal(
    f.calls.some(([name]) => name === "admin_verify_member_pin"),
    false,
  );
});

test("RPC errors never expose SDK PIN, token, email or password details", async () => {
  const f = fixture();
  const start = await startWorkstationWithPassword(credentials, f.clients);
  for (const [name, run] of [
    [
      "admin_verify_member_pin",
      () =>
        unlockOperatorWithPin(
          { workstationToken: start.workstationToken, memberId, pin: "1234" },
          f.clients,
        ),
    ],
    [
      "admin_resolve_operator_session",
      () => resolveCurrentOperator(start, f.clients),
    ],
    [
      "admin_revoke_operator_session",
      () => lockCurrentOperator(start, f.clients),
    ],
    [
      "admin_revoke_workstation_session",
      () => closeWorkstation(start, f.clients),
    ],
  ]) {
    f.options.throwAt = name;
    await assert.rejects(run(), (error) => {
      assertSafe({ message: error.message, cause: error.cause });
      return error.code === "UNAVAILABLE";
    });
  }
});

test("lost issuance response revokes undelivered operator and newly created workstation", async () => {
  const f = fixture();
  f.options.lostIssueResponse = true;
  await assert.rejects(startWorkstationWithPassword(credentials, f.clients));
  assert.ok([...f.operators.values()].every((o) => o.revoked));
  assert.ok([...f.stations.values()].every((w) => w.revoked));
});

test("malformed tokens do not reach RPC; cookies remain configuration only", async () => {
  const f = fixture();
  assert.equal(
    await resolveCurrentOperator(
      { workstationToken: "invalid", operatorToken: "invalid" },
      f.clients,
    ),
    null,
  );
  await lockCurrentOperator({ operatorToken: "invalid" }, f.clients);
  await closeWorkstation({ workstationToken: "invalid" }, f.clients);
  assert.equal(f.calls.length, 0);
  const one = generateSessionToken();
  assert.notEqual(one, generateSessionToken());
  assert.equal(hashSessionToken(one), hashSessionToken(one));
  assert.throws(() => hashSessionToken("invalid"));
  assert.deepEqual(SESSION_COOKIE_OPTIONS, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
});
