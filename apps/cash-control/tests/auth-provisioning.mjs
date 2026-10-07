import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bootstrapFirstOwner,
  readBootstrapInput,
} from "../src/lib/users/server/bootstrap.mjs";
import {
  createBusinessMember,
  findAuthUserByEmail,
  provisionExistingAuthMember,
} from "../src/lib/users/server/provisioning.mjs";

const businessId = "11111111-1111-4111-8111-111111111111";
const input = {
  businessId,
  firstName: "Ana",
  lastName: "Test",
  displayName: "Ana Test",
  username: " Owner ",
  role: "owner",
  password: "Test-only-password!",
  pin: "123456",
  internalNotes: "private note",
};
const env = {
  BOOTSTRAP_BUSINESS_NAME: "Test",
  BOOTSTRAP_BUSINESS_SLUG: "test",
  BOOTSTRAP_OWNER_FIRST_NAME: "Ana",
  BOOTSTRAP_OWNER_LAST_NAME: "Test",
  BOOTSTRAP_OWNER_USERNAME: " Owner ",
  BOOTSTRAP_OWNER_PASSWORD: input.password,
  BOOTSTRAP_OWNER_PIN: input.pin,
};

function fixture(options = {}) {
  const users = new Map();
  const businesses = new Map();
  const members = new Map();
  const pins = new Map();
  const calls = [];
  if (options.existingBusiness)
    businesses.set(businessId, {
      id: businessId,
      slug: "test",
      status: "active",
    });
  if (options.existingMember) {
    const member = {
      id: "member-existing",
      business_id: businessId,
      user_id:
        options.existingMember.userId ?? "22222222-2222-4222-8222-222222222222",
      username: options.existingMember.username ?? "zeferino",
      role: options.existingMember.role ?? "owner",
      status: options.existingMember.status ?? "active",
    };
    members.set(member.id, member);
  }
  const failure = {
    message: `${input.password} ${input.pin} ${input.internalNotes}`,
  };
  const admin = {
    auth: {
      admin: {
        async createUser(attributes) {
          calls.push(["auth.create", attributes]);
          if (options.authFails)
            return { data: { user: null }, error: failure };
          users.set(attributes.id, attributes);
          return { data: { user: { id: attributes.id } }, error: null };
        },
        async listUsers() {
          calls.push(["auth.list"]);
          return { data: { users: options.authUsers ?? [] }, error: null };
        },
        async deleteUser(id) {
          calls.push(["auth.delete", id]);
          if (options.cleanupFails) return { error: failure };
          users.delete(id);
          return { error: null };
        },
      },
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === "admin_find_member_by_username") {
        const existing = [...members.values()].find(
          (m) =>
            m.business_id === args.p_business_id &&
            m.username.toLowerCase() === args.p_username.toLowerCase(),
        );
        return { data: existing?.id ?? null, error: null };
      }
      if (name === "admin_set_member_pin") {
        const member = members.get(args.p_member_id);
        if (!member) return { data: null, error: { code: "22023" } };
        pins.set(args.p_member_id, args.p_pin);
        return { data: null, error: null };
      }
      if (options.rpcFails) return { data: null, error: failure };
      if (
        [...members.values()].some(
          (m) =>
            m.business_id === args.p_business_id &&
            m.username.toLowerCase() === args.p_username.toLowerCase(),
        )
      ) {
        return { data: null, error: { code: "23505" } };
      }
      const id = `member-${members.size + 1}`;
      members.set(id, {
        id,
        business_id: args.p_business_id,
        user_id: args.p_user_id,
        username: args.p_username,
        role: args.p_role,
        status: "active",
      });
      pins.set(id, args.p_pin);
      if (options.lostResponse) throw new Error("transport error");
      return { data: id, error: null };
    },
    from(table) {
      const rows = table === "businesses" ? businesses : members;
      let action = "select";
      let values;
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        insert(value) {
          action = "insert";
          values = value;
          return query;
        },
        delete() {
          action = "delete";
          return query;
        },
        limit() {
          return query;
        },
        async single() {
          const result = await execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        async maybeSingle() {
          return query.single();
        },
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable.
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };
      async function execute() {
        calls.push([`${table}.${action}`]);
        if (action === "insert") {
          if ([...rows.values()].some((row) => row.slug === values.slug))
            return { data: null, error: { code: "23505" } };
          const row = { ...values, status: "active" };
          rows.set(row.id, row);
          return { data: [row], error: null };
        }
        const data = [...rows.values()].filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
        if (action === "delete") for (const row of data) rows.delete(row.id);
        return { data, error: null };
      }
      return query;
    },
  };
  return {
    admin,
    users,
    businesses,
    members,
    pins,
    calls,
    access: { admin, authorize: async () => true },
  };
}

test("validates and authorizes before any network activity", async () => {
  const f = fixture();
  for (const change of [
    { pin: "123" },
    { password: "short" },
    { firstName: " " },
    { businessId: "bad" },
    { role: "admin" },
  ]) {
    await assert.rejects(
      createBusinessMember({ ...input, ...change }, f.access),
    );
  }
  await assert.rejects(
    createBusinessMember(input, {
      admin: f.admin,
      authorize: async () => false,
    }),
    /no autorizado/,
  );
  await assert.rejects(
    createBusinessMember(input, { admin: f.admin }),
    /no autorizado/,
  );
  assert.equal(f.calls.length, 0);
});

test("creates UUID internal Auth email, confirms email and returns only safe identifiers", async () => {
  const f = fixture();
  const result = await createBusinessMember(input, f.access);
  const auth = f.calls.find(([name]) => name === "auth.create")[1];
  assert.match(auth.id, /^[0-9a-f-]{14}4[0-9a-f-]{21}$/);
  assert.equal(auth.email, `member-${auth.id}@example.com`);
  assert.equal(auth.email_confirm, true);
  assert.deepEqual(Object.keys(auth).sort(), [
    "email",
    "email_confirm",
    "id",
    "password",
  ]);
  assert.deepEqual(Object.keys(result).sort(), [
    "businessId",
    "memberId",
    "userId",
    "username",
  ]);
  assert.equal(result.username, "Owner");
  const rpc = f.calls.find(([name]) => name === "admin_provision_member")[1];
  assert.equal(rpc.p_pin, input.pin);
  assert.equal(rpc.p_user_id, auth.id);
  assert.equal("password" in rpc, false);
  assert.equal(
    f.calls.some(([name]) => name === "auth.delete"),
    false,
  );
});

test("RPC failure compensates Auth; raw errors and secrets are suppressed", async () => {
  const f = fixture({ rpcFails: true });
  await assert.rejects(createBusinessMember(input, f.access), (error) => {
    assert.match(error.message, /Auth user nuevo eliminado/);
    for (const secret of [input.password, input.pin, input.internalNotes])
      assert.ok(!String(error).includes(secret));
    return true;
  });
  assert.equal(f.users.size, 0);
  assert.equal(f.members.size, 0);
});

test("failed compensation exposes only recovery ID, never raw SDK errors", async () => {
  const f = fixture({ rpcFails: true, cleanupFails: true });
  await assert.rejects(createBusinessMember(input, f.access), (error) => {
    assert.match(error.message, /compensación pendiente.*user_id=/);
    assert.ok(!error.message.includes(input.password));
    assert.ok(!error.message.includes(input.pin));
    return true;
  });
  assert.equal(f.users.size, 1);
});

test("lost RPC response reconciles committed membership instead of deleting Auth", async () => {
  const f = fixture({ lostResponse: true });
  const result = await createBusinessMember(input, f.access);
  assert.equal(result.memberId, "member-1");
  assert.equal(f.users.size, 1);
  assert.equal(
    f.calls.some(([name]) => name === "auth.delete"),
    false,
  );
});

test("bootstrap repeated with case change creates no second business, user or member", async () => {
  const f = fixture();
  await bootstrapFirstOwner(f.admin, env);
  await assert.rejects(
    bootstrapFirstOwner(f.admin, { ...env, BOOTSTRAP_OWNER_USERNAME: "OWNER" }),
    /ya existe/,
  );
  assert.equal(f.businesses.size, 1);
  assert.equal(f.users.size, 1);
  assert.equal(f.members.size, 1);
  assert.equal(f.calls.filter(([name]) => name === "auth.create").length, 1);
});

test("failed bootstrap deletes only its own empty business", async () => {
  for (const existingBusiness of [false, true]) {
    const f = fixture({ rpcFails: true, existingBusiness });
    await assert.rejects(bootstrapFirstOwner(f.admin, env));
    assert.equal(f.users.size, 0);
    assert.equal(f.businesses.size, existingBusiness ? 1 : 0);
  }
});

test("concurrent bootstraps compensate the losing Auth user after the unique constraint", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    bootstrapFirstOwner(f.admin, env),
    bootstrapFirstOwner(f.admin, env),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(f.businesses.size, 1);
  assert.equal(f.members.size, 1);
  assert.equal(f.users.size, 1);
});

test("Auth failure never calls provisioning and cleans up new empty business", async () => {
  const f = fixture({ authFails: true });
  await assert.rejects(bootstrapFirstOwner(f.admin, env), /Auth no confirmó/);
  assert.equal(
    f.calls.some(([name]) => name === "admin_provision_member"),
    false,
  );
  assert.equal(f.businesses.size, 0);
});

test("bootstrap validates environment before creating business or Auth", async () => {
  const f = fixture();
  await assert.rejects(
    bootstrapFirstOwner(f.admin, { ...env, BOOTSTRAP_OWNER_PIN: "" }),
  );
  assert.equal(f.calls.length, 0);
  assert.equal(readBootstrapInput(env).member.username, "Owner");
});

test("bootstrap can generate a hidden Auth password for PIN-only workstation access", async () => {
  const f = fixture();
  const inputWithoutPassword = { ...env };
  delete inputWithoutPassword.BOOTSTRAP_OWNER_PASSWORD;

  await bootstrapFirstOwner(f.admin, inputWithoutPassword);

  const auth = f.calls.find(([name]) => name === "auth.create")[1];
  assert.equal(typeof auth.password, "string");
  assert.ok(auth.password.length >= 12);
  assert.notEqual(auth.password, input.pin);
});

test("existing Auth provisioning links the supplied identity without creating Auth", async () => {
  const f = fixture();
  const userId = "33333333-3333-4333-8333-333333333333";
  const result = await provisionExistingAuthMember(
    {
      businessId,
      userId,
      firstName: "Zeferino",
      lastName: "Zeferino",
      displayName: "Zeferino",
      username: "zeferino",
      role: "owner",
      pin: "1234",
    },
    f.access,
  );

  assert.equal(result.alreadyLinked, false);
  assert.equal(result.userId, userId);
  assert.equal(
    f.calls.some(([name]) => name === "auth.create"),
    false,
  );
  const rpc = f.calls.find(([name]) => name === "admin_provision_member")[1];
  assert.equal(rpc.p_user_id, userId);
  assert.equal(rpc.p_role, "owner");
  assert.equal(rpc.p_pin, "1234");
});

test("existing Auth provisioning is idempotent and only resets the existing PIN", async () => {
  const f = fixture();
  const owner = {
    businessId,
    userId: "33333333-3333-4333-8333-333333333333",
    firstName: "Zeferino",
    lastName: "Zeferino",
    displayName: "Zeferino",
    username: "zeferino",
    role: "owner",
    pin: "1234",
  };

  await provisionExistingAuthMember(owner, f.access);
  const second = await provisionExistingAuthMember(owner, f.access);

  assert.equal(second.alreadyLinked, true);
  assert.equal(
    f.calls.filter(([name]) => name === "admin_provision_member").length,
    1,
  );
  assert.equal(
    f.calls.filter(([name]) => name === "admin_set_member_pin").length,
    1,
  );
  assert.equal(f.pins.get("member-1"), "1234");
  assert.equal(
    f.calls.some(([name]) => name === "auth.create"),
    false,
  );
});

test("existing username linked to another Auth identity is never overwritten", async () => {
  const f = fixture({
    existingMember: {
      userId: "44444444-4444-4444-8444-444444444444",
    },
  });
  await assert.rejects(
    provisionExistingAuthMember(
      {
        businessId,
        userId: "33333333-3333-4333-8333-333333333333",
        firstName: "Zeferino",
        lastName: "Zeferino",
        displayName: "Zeferino",
        username: "zeferino",
        role: "owner",
        pin: "1234",
      },
      f.access,
    ),
    /otra identidad/,
  );
  assert.equal(
    f.calls.some(([name]) => name === "admin_set_member_pin"),
    false,
  );
  assert.equal(
    f.calls.some(([name]) => name === "admin_provision_member"),
    false,
  );
});

test("Auth lookup matches the exact email without exposing a password flow", async () => {
  const userId = "33333333-3333-4333-8333-333333333333";
  const f = fixture({
    authUsers: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        email: "other@example.com",
      },
      { id: userId, email: "Zeferino@CashControl.com" },
    ],
  });
  const result = await findAuthUserByEmail(f.admin, "zeferino@cashcontrol.com");
  assert.deepEqual(result, {
    id: userId,
    email: "Zeferino@CashControl.com",
  });
  assert.equal(
    f.calls.some(([name]) => name === "auth.create"),
    false,
  );
});
