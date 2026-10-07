import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { listBusinessCandidates } from "../src/lib/workstation/server/candidates.mjs";

const businessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "22222222-2222-4222-8222-222222222222";
const ownerMemberId = "33333333-3333-4333-8333-333333333333";
const employeeMemberId = "44444444-4444-4444-8444-444444444444";
const ownerUserId = "55555555-5555-4555-8555-555555555555";
const employeeUserId = "66666666-6666-4666-8666-666666666666";
const poison = {
  email: "member-hidden@example.com",
  pin_hash: "PIN_HASH_SECRET",
  internal_notes: "NOTE_SECRET",
  access_token: "ACCESS_SECRET",
  refresh_token: "REFRESH_SECRET",
};

function failed() {
  return Promise.resolve({
    data: null,
    error: new Error(Object.values(poison).join(" ")),
  });
}

/** Admin client simulation: only the tables and chains the candidates query uses. */
function fixture({
  failAt = null,
  orphanMember = false,
  noMembers = false,
} = {}) {
  const calls = [];
  const businesses = [
    { id: businessId, slug: "cash-control", status: "active" },
    { id: otherBusinessId, slug: "suspended-shop", status: "suspended" },
  ];
  const members = [];
  if (!noMembers) {
    members.push(
      {
        id: ownerMemberId,
        business_id: businessId,
        user_id: ownerUserId,
        username: "zeferino",
        role: "owner",
        status: "active",
        ...poison,
      },
      {
        id: employeeMemberId,
        business_id: businessId,
        user_id: employeeUserId,
        username: "ana",
        role: "employee",
        status: "active",
        ...poison,
      },
    );
  }
  members.push(
    {
      id: "77777777-7777-4777-8777-777777777777",
      business_id: businessId,
      user_id: randomUUID(),
      username: "suspendido",
      role: "employee",
      status: "suspended",
      ...poison,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      business_id: otherBusinessId,
      user_id: randomUUID(),
      username: "otro-negocio",
      role: "owner",
      status: "active",
      ...poison,
    },
  );
  if (orphanMember)
    members.push({
      id: "99999999-9999-4999-8999-999999999999",
      business_id: businessId,
      user_id: randomUUID(),
      username: "sin-perfil",
      role: "employee",
      status: "active",
      ...poison,
    });
  const profiles = [
    { id: ownerUserId, display_name: "Zeferino", ...poison },
    { id: employeeUserId, display_name: "Ana López", ...poison },
    { id: randomUUID(), display_name: "Ajeno", ...poison },
  ];

  const admin = {
    from(table) {
      if (failAt === table) return brokenQuery();
      const filters = [];
      let allowedIds = null;
      const query = {
        select(columns) {
          calls.push([`${table}.select`, columns]);
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        in(key, values) {
          calls.push([`${table}.in`, key]);
          allowedIds = new Set(values);
          return query;
        },
        maybeSingle() {
          return rows(true);
        },
        // biome-ignore lint/suspicious/noThenProperty: el builder de Supabase es thenable en la simulación.
        then(onFulfilled, onRejected) {
          return rows(false).then(onFulfilled, onRejected);
        },
      };
      function rows(single) {
        const source = { businesses, business_members: members, profiles }[
          table
        ];
        if (!source) throw new Error(`Unexpected table ${table}`);
        const matched = source.filter(
          (row) =>
            filters.every(([key, value]) => row[key] === value) &&
            (!allowedIds || allowedIds.has(row.id)),
        );
        return Promise.resolve({
          data: single ? (matched[0] ?? null) : matched,
          error: null,
        });
      }
      return query;
    },
  };
  return { clients: { admin }, calls };
}

function assertSafe(value) {
  const serialized = JSON.stringify(value);
  for (const secret of Object.values(poison))
    assert.equal(serialized.includes(secret), false, secret);
}

/** Every step of the chain fails, emulating an SDK error on that table. */
function brokenQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: () => failed(),
    // biome-ignore lint/suspicious/noThenProperty: el builder de Supabase es thenable en la simulación.
    then: (onFulfilled, onRejected) => failed().then(onFulfilled, onRejected),
  };
  return query;
}

test("candidates: solo miembros activos del negocio con DTO público", async () => {
  const { clients, calls } = fixture();
  const candidates = await listBusinessCandidates(
    { businessSlug: "cash-control" },
    clients,
  );

  assert.deepEqual(candidates, [
    {
      memberId: employeeMemberId,
      username: "ana",
      displayName: "Ana López",
      role: "employee",
    },
    {
      memberId: ownerMemberId,
      username: "zeferino",
      displayName: "Zeferino",
      role: "owner",
    },
  ]);
  for (const candidate of candidates)
    assert.deepEqual(Object.keys(candidate).sort(), [
      "displayName",
      "memberId",
      "role",
      "username",
    ]);
  assertSafe(candidates);
  const serialized = JSON.stringify(candidates);
  for (const hidden of [
    ownerUserId,
    employeeUserId,
    businessId,
    "cash-control",
  ])
    assert.equal(serialized.includes(hidden), false, hidden);
  for (const [name, columns] of calls)
    if (typeof columns === "string")
      assert.doesNotMatch(columns, /pin|email|notes/i, `${name} ${columns}`);
});

test("candidates: negocio suspendido, inexistente o sin slug no expone miembros", async () => {
  const { clients, calls } = fixture();
  for (const businessSlug of ["suspended-shop", "desconocido", "   "])
    await assert.rejects(
      listBusinessCandidates({ businessSlug }, clients),
      { code: "UNAVAILABLE" },
      businessSlug,
    );
  assert.equal(
    calls.some(([name]) => name.startsWith("business_members")),
    false,
  );
});

test("candidates: sin miembros activos no se consultan perfiles", async () => {
  const { clients, calls } = fixture({ noMembers: true });
  assert.deepEqual(
    await listBusinessCandidates({ businessSlug: "cash-control" }, clients),
    [],
  );
  assert.equal(
    calls.some(([name]) => name.startsWith("profiles")),
    false,
  );
});

test("candidates: una membresía activa sin perfil no se inventa", async () => {
  const { clients } = fixture({ orphanMember: true });
  await assert.rejects(
    listBusinessCandidates({ businessSlug: "cash-control" }, clients),
    { code: "UNAVAILABLE" },
  );
});

test("candidates: los errores del cliente admin no filtran detalles", async () => {
  for (const table of ["businesses", "business_members", "profiles"]) {
    const { clients } = fixture({ failAt: table });
    await assert.rejects(
      listBusinessCandidates({ businessSlug: "cash-control" }, clients),
      (error) => {
        assertSafe({ message: error.message, cause: error.cause });
        return error.code === "UNAVAILABLE";
      },
      table,
    );
  }
});
