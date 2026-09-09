const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const { NextRequest } = require("next/server");
let calls = [];
let refresh = async () => ({ data: null, error: null });
const cookieStore = { getAll: () => [], set: () => {} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "next/headers") return { cookies: async () => cookieStore };
  if (request === "@supabase/ssr")
    return {
      createBrowserClient: (...args) => {
        calls.push({ type: "browser", args });
        return {};
      },
      createServerClient: (...args) => {
        calls.push({ type: "server", args });
        return { auth: { getClaims: () => refresh(args[2]) } };
      },
    };
  if (request === "@supabase/supabase-js")
    return {
      createClient: (...args) => {
        calls.push({ type: "admin", args });
        return {};
      },
    };
  return originalLoad.call(this, request, parent, isMain);
};
Module._extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  module._compile(outputText, filename);
};
const browser = require("../src/lib/supabase/client.ts");
const server = require("../src/lib/supabase/server.ts");
const admin = require("../src/lib/supabase/admin.ts");
const { updateSession } = require("../src/lib/supabase/proxy.ts");
const envNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];
async function withEnv(configured, run) {
  const before = envNames.map((name) => process.env[name]);
  calls = [];
  for (const name of envNames) delete process.env[name];
  if (configured) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public";
    process.env.SUPABASE_SECRET_KEY = "test-server-only";
  }
  try {
    await run();
  } finally {
    envNames.forEach((name, i) => {
      if (before[i] === undefined) delete process.env[name];
      else process.env[name] = before[i];
    });
  }
}

test("missing config: proxy passes through; explicit factories fail clearly without creating clients", async () => {
  await withEnv(false, async () => {
    assert.equal(calls.length, 0);
    const response = await updateSession(
      new NextRequest("http://localhost/shifts"),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.throws(() => browser.createClient(), /NEXT_PUBLIC_SUPABASE/);
    await assert.rejects(server.createClient(), /NEXT_PUBLIC_SUPABASE/);
    assert.throws(() => admin.createAdminClient(), /SUPABASE_SECRET_KEY/);
    assert.equal(calls.length, 0);
  });
});

test("proxy verifies claims and preserves request/response cookies and SDK cache headers across writes", async () => {
  await withEnv(true, async () => {
    let claimsCalls = 0;
    refresh = async ({ cookies }) => {
      claimsCalls++;
      cookies.setAll(
        [
          {
            name: "sb-first",
            value: "refreshed",
            options: { httpOnly: true, path: "/" },
          },
        ],
        {
          "Cache-Control": "private, no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      );
      cookies.setAll(
        [{ name: "sb-second", value: "chunk", options: { path: "/" } }],
        {},
      );
      return { data: { claims: { sub: "test-user" } }, error: null };
    };
    const request = new NextRequest("http://localhost/users");
    const response = await updateSession(request);
    assert.equal(claimsCalls, 1);
    assert.equal(request.cookies.get("sb-first").value, "refreshed");
    assert.equal(request.cookies.get("sb-second").value, "chunk");
    assert.equal(response.cookies.get("sb-first").httpOnly, true);
    assert.equal(response.cookies.get("sb-second").value, "chunk");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("location"), null);
    await updateSession(new NextRequest("http://localhost/users"));
    assert.equal(calls.length, 2, "one client per request");
  });
});

test("public factories never receive service role; admin is stateless and server-only", async () => {
  await withEnv(true, async () => {
    browser.createClient();
    await server.createClient();
    admin.createAdminClient();
    assert.equal(calls[0].args[1], "test-public");
    assert.equal(calls[1].args[1], "test-public");
    assert.equal(calls[2].args[1], "test-server-only");
    assert.deepEqual(calls[2].args[2].auth, {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    });
    assert.match(
      fs.readFileSync(
        path.resolve(__dirname, "../src/lib/supabase/admin.ts"),
        "utf8",
      ),
      /import "server-only";/,
    );
    const writes = [];
    cookieStore.set = (...args) => writes.push(args);
    calls[1].args[2].cookies.setAll([
      { name: "session", value: "new", options: { path: "/" } },
    ]);
    assert.equal(writes[0][1], "new");
    cookieStore.set = () => {
      throw new Error("Read-only Server Component");
    };
    assert.doesNotThrow(() =>
      calls[1].args[2].cookies.setAll([{ name: "session", value: "new" }]),
    );
  });
});
