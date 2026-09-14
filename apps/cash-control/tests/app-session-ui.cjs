const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

let appSession = {
  state: "loading",
  operator: null,
  refresh: async () => true,
  lock: async () => true,
  close: async () => true,
};
let routerCalls = [];
let refs = [];
let refCursor = 0;

const react = {
  useEffect: (effect) => effect(),
  useRef: (initial) => {
    const index = refCursor++;
    if (!(index in refs)) refs[index] = { current: initial };
    return refs[index];
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react") return react;
  if (request === "react/jsx-runtime") {
    const createNode = (type, props) => ({ type, props: props ?? {} });
    return { Fragment: "Fragment", jsx: createNode, jsxs: createNode };
  }
  if (request === "next/navigation")
    return {
      useRouter: () => ({
        push: (href) => routerCalls.push({ method: "push", href }),
        replace: (href) => routerCalls.push({ method: "replace", href }),
      }),
    };
  if (request === "@/components/session/RealAppSessionProvider")
    return require(
      path.resolve(
        __dirname,
        "../src/components/session/RealAppSessionProvider.tsx",
      ),
    );
  if (request === "@/components/workstation/RealWorkstationSessionProvider")
    return {
      RealWorkstationSessionProvider: "RealWorkstationSessionProvider",
      useRealWorkstationSession: () => appSession,
    };
  if (request.startsWith("@/"))
    request = path.resolve(__dirname, "../src", request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};

for (const extension of [".ts", ".tsx"]) {
  Module._extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(
      fs.readFileSync(filename, "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
        },
      },
    );
    module._compile(outputText, filename);
  };
}

const { SessionGuard } = require("../src/components/guards/SessionGuard.tsx");
const {
  OwnerOnlyGuard,
} = require("../src/components/guards/OwnerOnlyGuard.tsx");
const {
  useRealAppSession,
} = require("../src/components/session/RealAppSessionProvider.tsx");

function renderGuard(guard, state, operator = null) {
  appSession = { ...appSession, state, operator };
  routerCalls = [];
  refs = [];
  refCursor = 0;
  return guard({ children: { type: "protected-content", props: {} } });
}

function source(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

test("ACTIVE permite acceso a las rutas internas", () => {
  const result = renderGuard(SessionGuard, "ACTIVE", {
    identity: { role: "owner" },
    operatorExpiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(result.type, "Fragment");
  assert.deepEqual(routerCalls, []);
});

test("NO_WORKSTATION redirige a workstation", () => {
  assert.equal(renderGuard(SessionGuard, "NO_WORKSTATION"), null);
  assert.deepEqual(routerCalls, [{ method: "replace", href: "/workstation" }]);
});

test("NO_OPERATOR redirige a workstation", () => {
  assert.equal(renderGuard(SessionGuard, "NO_OPERATOR"), null);
  assert.deepEqual(routerCalls, [{ method: "replace", href: "/workstation" }]);
});

test("INVALID_SESSION redirige a workstation", () => {
  assert.equal(renderGuard(SessionGuard, "INVALID_SESSION"), null);
  assert.deepEqual(routerCalls, [{ method: "replace", href: "/workstation" }]);
});

test("la recarga usa resolve y no el estado anterior de React", () => {
  const provider = source(
    "src/components/workstation/RealWorkstationSessionProvider.tsx",
  );
  assert.match(provider, /fetch\("\/api\/workstation\/resolve"/);
  assert.match(provider, /useEffect\(\(\) => \{/);
  assert.match(provider, /void refresh\(\)/);
});

test("WorkstationPage no monta un provider real duplicado", () => {
  const workstationPage = source(
    "src/components/workstation/WorkstationPage.tsx",
  );
  const rootLayout = source("src/app/layout.tsx");
  const appProvider = source(
    "src/components/session/RealAppSessionProvider.tsx",
  );

  assert.doesNotMatch(workstationPage, /RealWorkstationSessionProvider/);
  assert.match(workstationPage, /<RealWorkstationPanel\s*\/>/);
  assert.match(rootLayout, /<RealAppSessionProvider>/);
  assert.match(appProvider, /<RealWorkstationSessionProvider>/);
});

test("lock conserva la workstation y pasa a NO_OPERATOR", () => {
  const provider = source(
    "src/components/workstation/RealWorkstationSessionProvider.tsx",
  );
  assert.match(provider, /setOperator\(null\);\s*setState\("NO_OPERATOR"\)/s);
  assert.match(
    source("src/app/api/workstation/lock/route.ts"),
    /clearOperatorCookie/,
  );
});

test("close limpia la sesión real y pasa a NO_WORKSTATION", () => {
  const provider = source(
    "src/components/workstation/RealWorkstationSessionProvider.tsx",
  );
  assert.match(
    provider,
    /setOperator\(null\);\s*setActivatedMembers\(\[\]\);\s*setState\("NO_WORKSTATION"\)/s,
  );
  assert.match(
    source("src/app/api/workstation/close/route.ts"),
    /clearSessionCookies/,
  );
});

test("OwnerOnlyGuard usa el rol real y la fachada no expone IDs de sesión", () => {
  const owner = {
    identity: { memberId: "member-owner", role: "owner" },
    operatorExpiresAt: "2099-01-01T00:00:00.000Z",
    operatorSessionId: "must-not-reach-ui",
    workstationSessionId: "must-not-reach-ui",
  };
  appSession = { ...appSession, state: "ACTIVE", operator: owner };
  const safeSession = useRealAppSession();
  assert.equal(safeSession.operator?.identity.memberId, "member-owner");
  assert.equal("operatorSessionId" in (safeSession.operator ?? {}), false);
  assert.equal("workstationSessionId" in (safeSession.operator ?? {}), false);

  const ownerResult = renderGuard(OwnerOnlyGuard, "ACTIVE", owner);
  assert.equal(ownerResult.type, "Fragment");
  assert.deepEqual(routerCalls, []);

  const employee = {
    ...owner,
    identity: { ...owner.identity, role: "employee" },
  };
  assert.equal(renderGuard(OwnerOnlyGuard, "ACTIVE", employee), null);
  assert.deepEqual(routerCalls, [{ method: "replace", href: "/" }]);
});

test("selectedUserId no es autoridad de sesión real", () => {
  const guardSource = source("src/components/guards/SessionGuard.tsx");
  const ownerSource = source("src/components/guards/OwnerOnlyGuard.tsx");
  const appSource = source("src/components/session/RealAppSessionProvider.tsx");
  assert.doesNotMatch(guardSource, /selectedUserId|MockSessionContext/);
  assert.doesNotMatch(ownerSource, /selectedUserId|MockSessionContext/);
  assert.doesNotMatch(appSource, /selectedUserId|localStorage|sessionStorage/);
});

test("SessionGuard evita ciclos de redirección", () => {
  appSession = { ...appSession, state: "NO_OPERATOR", operator: null };
  routerCalls = [];
  refs = [];
  refCursor = 0;
  SessionGuard({ children: null });
  refCursor = 0;
  SessionGuard({ children: null });
  assert.deepEqual(routerCalls, [{ method: "replace", href: "/workstation" }]);
});
