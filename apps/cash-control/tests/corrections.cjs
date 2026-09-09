const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

// Load project TypeScript without adding a test runtime dependency.
const originalLoad = Module._load;
let state = [];
let cursor = 0;
const react = {
  createContext: () => ({ Provider: "provider" }),
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
  useState: (initial) => {
    const index = cursor++;
    if (!(index in state))
      state[index] = typeof initial === "function" ? initial() : initial;
    return [
      state[index],
      (value) => {
        state[index] =
          typeof value === "function" ? value(state[index]) : value;
      },
    ];
  },
};
Module._load = function (request, parent, isMain) {
  if (request.endsWith("/badge")) return { Badge: "Badge" };
  if (request === "lucide-react")
    return new Proxy({}, { get: (_, name) => name });
  if (request.includes("shared/ActionMenu"))
    return { ActionMenu: "ActionMenu" };
  if (request === "react/jsx-runtime")
    return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    };
  if (request === "react") return react;
  if (request.includes("session/MockSessionContext"))
    return {
      useMockSession: () => ({ authenticatedUser: null, participants: [] }),
    };
  if (request.includes("CommissionRulesContext"))
    return { useCommissionRules: () => ({ rules: [] }) };
  if (request.includes("shifts/ShiftContext"))
    return {
      useShift: () => ({
        getCurrentShift: () => ({ id: "test-shift", status: "open" }),
      }),
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
const { canCorrectRecord } = require("../src/lib/correctionPermissions.ts");
const {
  applyAdministrativeCorrection,
  previewAdministrativeCorrection,
  getAdministrativeResources,
} = require("../src/lib/administrativeMovements.ts");
const {
  BusinessFundsProvider,
} = require("../src/components/business-funds/BusinessFundsContext.tsx");
const actor = (id = "A", role = "employee", active = true) => ({
  actorUserId: id,
  actorUserName: id,
  actorSystemRole: role,
  actorHasActiveParticipation: active,
});
const movement = (amount = 5000, type = "income", resourceId = "cash") => ({
  id: "m",
  shiftId: "test-shift",
  movementType: type,
  resourceId,
  resourceType: resourceId === "cash" ? "cash" : "bank",
  resourceName: resourceId,
  amountCents: amount * 100,
  createdByUserId: "A",
  createdByUserName: "A",
  createdAt: "2026-09-01",
  balanceBeforeCents: 1000000,
  balanceAfterCents: 1500000,
});
const cash = (balance, reserved = 0) => ({
  physicalBalance: balance,
  reservedOperations: reserved ? [{ amount: reserved }] : [],
  updatedAt: "",
});
const banks = (balance = 0, reserved = 0) => [
  {
    id: "bbva",
    bankName: "BBVA",
    realBalance: balance,
    reservedOperations: reserved ? [{ amount: reserved }] : [],
    status: "available",
  },
];
function provider(cashState, bankState, moves = [], operations = []) {
  state = [cashState, bankState, moves, operations, 0];
  cursor = 0;
  return BusinessFundsProvider({ children: null }).props.value;
}

test("permission policy: own records, other employee, inactive, owner and legacy", () => {
  for (const record of [
    movement(),
    { createdByUserId: "A", createdBy: "Same name" },
  ]) {
    assert.equal(canCorrectRecord(record, actor()), true);
    assert.equal(canCorrectRecord(record, actor("B")), false);
    assert.equal(
      canCorrectRecord(record, actor("A", "employee", false)),
      false,
    );
    assert.equal(canCorrectRecord(record, actor("O", "owner", false)), true);
  }
  assert.equal(canCorrectRecord({ createdBy: "A" }, actor()), false);
  assert.equal(canCorrectRecord({}, actor("O", "owner", false)), true);
});

for (const [name, current, before, after, expected] of [
  ["income reduction", 15000, movement(5000), movement(4000), 14000],
  [
    "withdrawal increase",
    9000,
    movement(1000, "withdrawal"),
    movement(1500, "withdrawal"),
    8500,
  ],
  [
    "tight withdrawal increase",
    1000,
    movement(1000, "withdrawal"),
    movement(1500, "withdrawal"),
    500,
  ],
  [
    "withdrawal reduction",
    9000,
    movement(1000, "withdrawal"),
    movement(500, "withdrawal"),
    9500,
  ],
  [
    "income increase without intermediate funds",
    100,
    movement(5000),
    movement(6000),
    1100,
  ],
  ["type change", 2000, movement(1000), movement(500, "withdrawal"), 500],
]) {
  test(name, () => {
    const result = applyAdministrativeCorrection({
      cash: cash(current),
      banks: banks(),
      original: before,
      corrected: after,
    });
    assert.equal(result.error, null);
    assert.equal(result.cash.physicalBalance, expected);
    const preview = previewAdministrativeCorrection({
      resources: getAdministrativeResources(cash(current), banks()),
      original: before,
      corrected: after,
    });
    assert.equal(preview[0].availableAfterCents, expected * 100);
  });
}
test("resource change and reserved funds: validate all resources atomically", () => {
  const original = movement(5000);
  const corrected = movement(5000, "income", "bbva");
  const success = applyAdministrativeCorrection({
    cash: cash(15000),
    banks: banks(),
    original,
    corrected,
  });
  assert.equal(success.cash.physicalBalance, 10000);
  assert.equal(success.banks[0].realBalance, 5000);
  for (const [c, b, from, to] of [
    [
      cash(10000, 8000),
      banks(),
      movement(1000, "withdrawal"),
      movement(3500, "withdrawal"),
    ],
    [cash(4000), banks(), original, corrected],
    [
      cash(10000),
      banks(10000, 8000),
      movement(5000, "income", "bbva"),
      movement(2500, "income", "bbva"),
    ],
  ]) {
    const result = applyAdministrativeCorrection({
      cash: c,
      banks: b,
      original: from,
      corrected: to,
    });
    assert.match(result.error, /fondos disponibles insuficientes/);
    assert.strictEqual(result.cash, c);
    assert.strictEqual(result.banks, b);
  }
});
test("correctClientOperation rejects unauthorized direct calls without changing state", () => {
  for (const a of [actor("B"), actor("A", "employee", false)]) {
    const context = provider(
      cash(10000),
      banks(),
      [],
      [{ id: "op", shiftId: "test-shift", createdByUserId: "A" }],
    );
    const before = structuredClone(state);
    const result = context.correctClientOperation({
      operationId: "op",
      reason: "Error",
      ...a,
    });
    assert.equal(
      result.error,
      "No tienes permiso para corregir esta operación.",
    );
    assert.deepEqual(state, before);
  }
});
test("correctMovement enforces identity, preserves creator and commits correction metadata", () => {
  for (const a of [
    actor(),
    actor("B"),
    actor("O", "owner"),
    actor("A", "employee", false),
  ]) {
    const original = movement();
    const context = provider(cash(15000), banks(), [original]);
    const before = structuredClone(state);
    const result = context.correctMovement({
      movementId: "m",
      movementType: "income",
      resourceId: "cash",
      amountCents: 400000,
      editReason: "Error",
      ...a,
    });
    assert.equal(
      result.success,
      a.actorSystemRole === "owner" ||
        (a.actorUserId === "A" && a.actorHasActiveParticipation),
    );
    if (!result.success) {
      assert.deepEqual(state, before);
      continue;
    }
    assert.equal(state[0].physicalBalance, 14000);
    assert.equal(result.movement.createdByUserId, "A");
    assert.equal(result.movement.createdByUserName, "A");
    assert.equal(result.movement.createdAt, original.createdAt);
    assert.equal(result.movement.editedByUserId, a.actorUserId);
    assert.equal(result.movement.isEdited, true);
    assert.equal(
      result.movement.correctionBalances[0].realBalanceAfterCents,
      1400000,
    );
  }
});
test("failed two-resource domain correction does not update movement or balances", () => {
  const context = provider(cash(4000), banks(), [movement()]);
  const before = structuredClone(state);
  const result = context.correctMovement({
    movementId: "m",
    movementType: "income",
    resourceId: "bbva",
    amountCents: 500000,
    editReason: "Error",
    ...actor(),
  });
  assert.equal(result.success, false);
  assert.deepEqual(state, before);
});
const { OperationRow } = require("../src/components/history/OperationRow.tsx");
function descendants(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}
test("history row exposes correction only to authorized actors and preserves other actions", () => {
  const operation = {
    id: "op",
    createdByUserId: "A",
    createdBy: "A",
    createdAt: "2026-09-01",
    bankFolio: "123",
    status: "pendiente",
    amount: 1000,
  };
  for (const a of [
    actor(),
    actor("B"),
    actor("O", "owner"),
    actor("A", "employee", false),
  ]) {
    const nodes = descendants(
      OperationRow({
        operation,
        canDeliver: true,
        canCorrect: canCorrectRecord(operation, a),
      }),
    );
    const menu = nodes.find((node) => node.type === "ActionMenu");
    assert.equal(
      menu.props.items.length,
      canCorrectRecord(operation, a) ? 2 : 1,
    );
    assert.equal(menu.props.items.at(-1).label, "Agregar aclaraci\u00f3n");
    assert.ok(nodes.some((node) => node.props?.title === "Ver detalle"));
    assert.ok(
      nodes.some(
        (node) =>
          node.type === "button" &&
          descendants(node).length > 0 &&
          JSON.stringify(node).includes("Entregar"),
      ),
    );
  }
});
