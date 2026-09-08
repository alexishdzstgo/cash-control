const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

// Run real context methods with a small synchronous hook harness, without a new dependency.
let stores = new Map();
let currentStore;
let cursor = 0;
let effects = [];
let dirty = false;
const react = {
  createContext: (value) => {
    const context = { value };
    context.Provider = { context };
    return context;
  },
  useContext: (context) => context.value,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (initial) => {
    const index = cursor++;
    if (!(index in currentStore)) currentStore[index] = { current: initial };
    return currentStore[index];
  },
  useState: (initial) => {
    const store = currentStore;
    const index = cursor++;
    if (!(index in store))
      store[index] = typeof initial === "function" ? initial() : initial;
    return [
      store[index],
      (value) => {
        const next = typeof value === "function" ? value(store[index]) : value;
        if (!Object.is(store[index], next)) dirty = true;
        store[index] = next;
      },
    ];
  },
  useEffect: (fn, deps) => {
    const index = cursor++;
    const previous = currentStore[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous[i])))
      effects.push(fn);
    currentStore[index] = deps;
  },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react") return react;
  if (request === "lucide-react")
    return new Proxy({}, { get: (_, name) => name });
  if (request === "next/link") return "Link";
  for (const component of [
    "CashClosingConfirmation",
    "CashClosingResult",
    "CashMovementBreakdown",
    "MovementDetailsModal",
    "ShiftClosingHeader",
  ]) {
    if (request.endsWith(`/${component}`)) return { [component]: component };
  }
  if (request === "react/jsx-runtime")
    return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
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
const {
  MockSessionProvider,
} = require("../src/components/session/MockSessionContext.tsx");
const { ShiftProvider } = require("../src/components/shifts/ShiftContext.tsx");
const {
  BusinessFundsProvider,
} = require("../src/components/business-funds/BusinessFundsContext.tsx");
const {
  CommissionRulesProvider,
} = require("../src/components/commissions/CommissionRulesContext.tsx");
const {
  getShiftActivitySummary,
  getRecentShiftActivity,
} = require("../src/lib/shiftActivity.ts");
const { canCloseShift, createInitialShift } = require("../src/lib/shifts.ts");
const {
  buildInitialZeroCash,
  buildInitialZeroBanks,
} = require("../src/components/balances/balanceMockData.ts");
const { getOperationCorrectionSnapshot } = require("../src/lib/finance.ts");
const {
  CashClosingPage,
} = require("../src/components/cash-closing/CashClosingPage.tsx");

let session;
let shift;
let funds;
function renderProvider(provider) {
  if (!stores.has(provider)) stores.set(provider, []);
  currentStore = stores.get(provider);
  cursor = 0;
  const element = provider({ children: null });
  element.type.context.value = element.props.value;
  return element.props.value;
}
function render() {
  let attempts = 0;
  do {
    dirty = false;
    effects = [];
    renderProvider(CommissionRulesProvider);
    session = renderProvider(MockSessionProvider);
    shift = renderProvider(ShiftProvider);
    funds = renderProvider(BusinessFundsProvider);
    for (const effect of effects) effect();
    assert.ok(++attempts < 5, "Providers should settle without a render loop");
  } while (dirty);
}
function reset(open = true) {
  stores = new Map();
  render();
  if (open) {
    login("maria-lopez", "María López", "owner");

    expectSuccess(
      act(() => shift.startShift({ cash: funds.cash, banks: funds.banks })),
    );
  }
}
function act(fn) {
  const result = fn();
  render();
  return result;
}
function expectSuccess(result) {
  assert.equal(result.success, true, result.error);
  return result;
}
function summary() {
  return getShiftActivitySummary(
    shift.currentShift.id,
    funds.operations,
    funds.movements,
  );
}
function activity() {
  return getRecentShiftActivity(
    shift.currentShift.id,
    funds.operations,
    funds.movements,
  );
}
function login(userId, userName, systemRole = "employee") {
  act(() =>
    session.unlockSession({
      userId,
      userName,
      systemRole,
      hasActiveParticipation: true,
    }),
  );
}
function addFunds(resourceId = "cash") {
  return expectSuccess(
    act(() =>
      funds.registerMovement({
        movementType: "income",
        resourceId,
        amountCents: 1000000,
        createdByUserId: "maria-lopez",
        createdByUserName: "María López",
      }),
    ),
  ).movement;
}
function operation(id, type = "retiro", status = "entregado") {
  return {
    id,
    type,
    status,
    amount: 1000,
    commission: status === "pendiente" ? 0 : 12,
    total: status === "pendiente" ? 1000 : type === "deposito" ? 1012 : 1000,
    bankFolio: id,
    bankResourceId: "bank-azteca",
    bankFrom: type === "retiro" ? "Banco Azteca" : "Caja fisica",
    bankTo: type === "retiro" ? "Caja fisica" : "Banco Azteca",
    destinationAccountLast4: "1234",
    receiverName: "Cliente",
    senderName: "",
    withdrawalCommissionMode: status === "pendiente" ? undefined : "cash",
    customerCashReceived: 1000,
    bankMovementAmount: 1000,
    createdAt: new Date().toISOString(),
    createdBy: "María López",
    createdByUserId: "maria-lopez",
  };
}
const actor = {
  actorUserId: "maria-lopez",
  actorUserName: "María López",
  actorSystemRole: "owner",
  actorHasActiveParticipation: true,
};

test("initial shift has one stable identity, readable folio and detached opening balances", () => {
  reset();
  const initial = structuredClone(shift.currentShift);
  assert.equal(initial.folio, "TUR-000001");
  assert.equal(initial.status, "open");
  assert.equal(shift.shifts.length, 1);
  assert.equal(shift.getCurrentShift().id, initial.id);
  assert.equal(shift.getShiftById(initial.id).folio, initial.folio);
  assert.equal(shift.getShiftById("missing"), undefined);
  assert.equal(shift.isShiftOpen(), true);
  assert.ok(Number.isFinite(Date.parse(initial.openedAt)));
  assert.equal("operations" in initial, false);
  assert.equal("activity" in initial, false);
  addFunds();
  assert.equal(funds.cash.physicalBalance, 10000);
  assert.deepEqual(shift.currentShift.openingBalances, initial.openingBalances);
  assert.equal(shift.currentShift.id, initial.id);

  const cash = {
    ...buildInitialZeroCash(),
    physicalBalance: 20000,
    reservedOperations: [{ amount: 5000 }],
  };
  const banks = buildInitialZeroBanks();
  banks[0].realBalance = 8000;
  const snapshot = createInitialShift({
    id: "snapshot",
    openedAt: initial.openedAt,
    responsible: { userId: "a", userName: "A" },
    cash,
    banks,
  });
  banks[0].realBalance = 0;
  assert.equal(snapshot.openingBalances.cashPhysical, 20000);
  assert.equal(snapshot.openingBalances.cashReserved, 5000);
  assert.equal(snapshot.openingBalances.banks[0].balance, 8000);
});

test("A-D: deposits, delivered/pending withdrawals and funds are stamped and counted", () => {
  reset();
  const cashMovement = addFunds();
  addFunds("bank-azteca");
  const id = shift.currentShift.id;
  assert.equal(cashMovement.shiftId, id);
  for (const input of [
    operation("DEP-1", "deposito", "completado"),
    operation("RET-1"),
    operation("RET-2", "retiro", "pendiente"),
  ]) {
    const result = expectSuccess(
      act(() =>
        funds.registerClientOperation({
          ...input,
          shiftId: "caller-supplied-wrong-shift",
        }),
      ),
    );
    assert.equal(result.operation.shiftId, id);
  }
  assert.deepEqual(summary(), {
    deposits: 1,
    withdrawals: 2,
    pendingWithdrawals: 1,
    fundsMovements: 2,
    corrections: 0,
    clarifications: 0,
  });
  for (const type of [
    "deposit_registered",
    "withdrawal_registered",
    "pending_withdrawal_registered",
    "funds_movement",
  ])
    assert.ok(activity().some((event) => event.type === type));
});

test("E-F: multiple corrections and clarifications retain registration shift and add activity", () => {
  reset();
  addFunds();
  expectSuccess(act(() => funds.registerClientOperation(operation("RET-1"))));
  const id = shift.currentShift.id;
  for (const amount of [1100, 1200]) {
    const result = expectSuccess(
      act(() =>
        funds.correctClientOperation({
          ...actor,
          operationId: "RET-1",
          amount,
          reason: "Monto incorrecto",
        }),
      ),
    );
    assert.equal(result.operation.shiftId, id);
    assert.equal(result.correction.shiftId, id);
  }
  for (const note of ["Primera nota", "Segunda nota"]) {
    const result = expectSuccess(
      act(() =>
        funds.addOperationClarification({
          operationId: "RET-1",
          reason: "Aclaración",
          note,
          createdBy: "Juan Pérez",
        }),
      ),
    );
    assert.equal(result.operation.shiftId, id);
    assert.equal(result.operation.clarifications[0].shiftId, id);
  }
  assert.equal(summary().withdrawals, 1);
  assert.equal(summary().corrections, 2);
  assert.equal(summary().clarifications, 2);
  assert.equal(
    activity().filter((event) => event.type === "operation_corrected").length,
    2,
  );
  assert.equal(
    activity().filter((event) => event.type === "operation_clarified").length,
    2,
  );
  assert.match(
    activity().find((event) => event.type === "withdrawal_registered").detail,
    /1,000/,
  );
});

test("funds correction preserves original shift and does not duplicate registrations", () => {
  reset();
  const movement = addFunds();
  const result = expectSuccess(
    act(() =>
      funds.correctMovement({
        ...actor,
        movementId: movement.id,
        movementType: "income",
        resourceId: "cash",
        amountCents: 900000,
        editReason: "Monto incorrecto",
      }),
    ),
  );
  assert.equal(result.movement.shiftId, movement.shiftId);
  assert.equal(summary().fundsMovements, 1);
});

test("delivery by another participant preserves registration and its own event after correction", () => {
  reset();
  addFunds();
  expectSuccess(
    act(() =>
      funds.registerClientOperation(operation("RET-P", "retiro", "pendiente")),
    ),
  );
  const id = shift.currentShift.id;
  login("juan-perez", "Juan Pérez");
  const result = expectSuccess(
    act(() =>
      funds.deliverPendingWithdrawal({
        operationId: "RET-P",
        receiverName: "Cliente",
        deliveredBy: "Juan Pérez",
        commissionMode: "cash",
        commissionAmount: 12,
        customerCashReceived: 1000,
        bankMovementAmount: 1000,
        appliedCommissionSnapshot: {
          operationAmountCents: 100000,
          calculatedCommissionCents: 1200,
          finalCommissionCents: 1200,
          ruleId: "retiro-commission-v1-4",
          ruleVersion: 1,
          calculationType: "fixed",
          location: "cash",
          appliedAt: new Date().toISOString(),
        },
      }),
    ),
  );
  assert.equal(result.operation.shiftId, id);
  assert.equal(result.operation.pendingDelivery.shiftId, id);
  const delivery = structuredClone(result.operation.pendingDelivery);
  expectSuccess(
    act(() =>
      funds.correctClientOperation({
        ...actor,
        operationId: "RET-P",
        amount: 1100,
        reason: "Monto incorrecto",
      }),
    ),
  );
  assert.deepEqual(funds.operations[0].pendingDelivery, delivery);
  assert.equal(summary().pendingWithdrawals, 0);
  assert.equal(summary().withdrawals, 1);
  assert.equal(
    activity().find((event) => event.type === "pending_withdrawal_delivered")
      .performedBy,
    "Juan Pérez",
  );
  assert.ok(
    activity().some((event) => event.type === "pending_withdrawal_registered"),
  );
});

test("G-I: responsibility transfer keeps the shift; only active responsible may close", () => {
  reset();
  const initial = structuredClone(shift.currentShift);
  assert.equal(shift.canCloseCurrentShift(), true);

  login("maria-lopez", "María López", "owner");
  assert.equal(shift.canCloseCurrentShift(), true);
  expectSuccess(
    act(() =>
      session.transferResponsibility("maria-lopez", "juan-perez", "1234"),
    ),
  );
  assert.equal(shift.currentShift.id, initial.id);
  assert.equal(shift.currentShift.openedAt, initial.openedAt);
  assert.deepEqual(shift.currentShift.openingBalances, initial.openingBalances);
  assert.equal(shift.currentShift.responsibleUserName, "Juan Pérez");
  assert.equal(shift.getShiftById(initial.id).responsibleUserId, "juan-perez");
  assert.equal(shift.shifts.length, 1);
  assert.equal(shift.canCloseCurrentShift(), false, "owner is now support");
  login("juan-perez", "Juan Pérez");
  assert.equal(shift.canCloseCurrentShift(), true);
  login("carlos-martinez", "Carlos Martínez", "owner");
  assert.equal(
    shift.canCloseCurrentShift(),
    false,
    "owner without participation cannot close",
  );
  assert.equal(
    canCloseShift(
      { ...initial, status: "closed" },
      "juan-perez",
      session.participants,
    ),
    false,
  );
  assert.equal(
    canCloseShift(
      initial,
      "juan-perez",
      session.participants.map((p) => ({ ...p, status: "ended" })),
    ),
    false,
  );
  act(() => session.lockSession());
  assert.equal(shift.canCloseCurrentShift(), false);
});

test("activity filters every event by its own shift, excludes legacy records, sorts and limits", () => {
  const current = operation("current");
  current.shiftId = "current";
  const other = { ...operation("other"), shiftId: "other" };
  const snapshot = getOperationCorrectionSnapshot(other);
  other.corrections = [
    {
      id: "c",
      shiftId: "current",
      createdAt: "2026-09-08T14:00:00Z",
      createdBy: "Ana",
      reason: "Corrección",
      before: snapshot,
      after: snapshot,
    },
  ];
  other.clarifications = [
    {
      id: "a",
      shiftId: "other",
      createdAt: "2026-09-08T15:00:00Z",
      createdBy: "Ana",
      reason: "Nota",
      note: "Nota",
    },
  ];
  const ops = [current, other, operation("legacy")];
  assert.deepEqual(getShiftActivitySummary("current", ops, []), {
    deposits: 0,
    withdrawals: 1,
    pendingWithdrawals: 0,
    fundsMovements: 0,
    corrections: 1,
    clarifications: 0,
  });
  assert.equal(getRecentShiftActivity("current", ops, []).length, 2);
  const many = Array.from({ length: 15 }, (_, i) => ({
    ...current,
    id: `${i}`,
    createdAt: `2026-09-08T12:${String(i).padStart(2, "0")}:00Z`,
  }));
  const events = getRecentShiftActivity("current", many, []);
  assert.equal(events.length, 10);
  assert.equal(events[0].id, "registration-14");
  assert.equal(events[9].id, "registration-5");
});

test("Day 1 reset clears derived activity without another reset system or a new shift", () => {
  reset();
  addFunds();
  expectSuccess(
    act(() =>
      funds.registerClientOperation(operation("RET-P", "retiro", "pendiente")),
    ),
  );
  expectSuccess(
    act(() =>
      funds.addOperationClarification({
        operationId: "RET-P",
        reason: "Nota",
        note: "Nota",
        createdBy: "Ana",
      }),
    ),
  );
  const version = funds.resetVersion;
  act(() => funds.resetFinancialState());
  assert.equal(funds.resetVersion, version + 1);
  assert.equal(shift.currentShift, null);
  assert.deepEqual(shift.shifts, []);
  assert.deepEqual(funds.operations, []);
  assert.deepEqual(funds.movements, []);
  assert.equal(funds.cash.physicalBalance, 0);
});

function closingInput() {
  const { buildCashClosingStory } = require("../src/lib/cashClosing.ts");
  const story = buildCashClosingStory({
    shiftId: shift.currentShift.id,
    openingBalances: shift.currentShift.openingBalances,
    cash: funds.cash,
    banks: funds.banks,
    operations: funds.operations,
    administrativeMovements: funds.movements,
  });
  return {
    shiftId: shift.currentShift.id,
    expectedCashPhysical: story.expectedCash,
    countedCashPhysical: story.expectedCash,
    expectedReservedCash: story.reservedCash.total,
    countedReservedCash: story.reservedCash.total,
    banks: story.bankStories.map((bank) => ({
      bankId: bank.bankId,
      bankName: bank.bankName,
      expectedBalance: bank.expectedBalance,
      countedBalance: bank.expectedBalance,
    })),
  };
}

test("closing domain blocks support, inactive owners and stale permission callbacks", () => {
  reset();
  const input = closingInput();
  login("juan-perez", "Juan Pérez");
  assert.equal(act(() => shift.closeCurrentShift(input)).success, false);
  login("carlos-martinez", "Carlos Martínez", "owner");
  assert.equal(act(() => shift.closeCurrentShift(input)).success, false);
  login("maria-lopez", "María López", "owner");
  const staleClose = shift.closeCurrentShift;
  expectSuccess(
    act(() =>
      session.transferResponsibility("maria-lopez", "juan-perez", "1234"),
    ),
  );
  assert.equal(
    staleClose(input).success,
    false,
    "old owner callback must see current support role",
  );
  assert.equal(shift.currentShift.status, "open");
});

test("H-I: successful close saves result, clears current shift, and blocks double submission synchronously", () => {
  reset();
  addFunds();
  login("maria-lopez", "María López", "owner");
  const input = closingInput();
  const financialState = structuredClone({
    cash: funds.cash,
    banks: funds.banks,
    operations: funds.operations,
    movements: funds.movements,
  });
  const close = shift.closeCurrentShift;
  const result = expectSuccess(close(input));
  assert.equal(
    close(input).success,
    false,
    "double-click before rerender is rejected",
  );
  render();
  assert.equal(shift.currentShift, null);
  assert.equal(shift.getCurrentShift(), null);
  assert.equal(shift.isShiftOpen(), false);
  assert.equal(shift.canCloseCurrentShift(), false);
  assert.equal(shift.shifts.length, 1);
  const saved = shift.getShiftById(input.shiftId);
  assert.equal(saved.status, "closed");
  assert.equal(saved.closedAt, saved.closing.closedAt);
  assert.equal(saved.closing.status, "balanced");
  assert.equal(saved.closing.closedByUserId, "maria-lopez");
  assert.equal(saved.closing.countedCashPhysical, 10000);
  assert.deepEqual(saved, result.shift);
  assert.deepEqual(
    {
      cash: funds.cash,
      banks: funds.banks,
      operations: funds.operations,
      movements: funds.movements,
    },
    financialState,
    "closing does not reconcile or mutate balances",
  );
  assert.equal(act(() => shift.closeCurrentShift(input)).success, false);
  assert.equal(shift.currentShift, null, "no automatic next shift");
});

function renderPage() {
  if (!stores.has(CashClosingPage)) stores.set(CashClosingPage, []);
  currentStore = stores.get(CashClosingPage);
  cursor = 0;
  return CashClosingPage();
}
function findNode(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  return findNode(node.props?.children, predicate);
}
function confirmation() {
  return findNode(
    renderPage(),
    (node) => node.type === "CashClosingConfirmation",
  );
}
function startCount() {
  const ready = findNode(
    renderPage(),
    (node) => node.type?.name === "ReadyToCountCard",
  );
  ready.props.onStartCount();
}
function fillCount(input = closingInput()) {
  confirmation().props.onCountedAvailableCashChange(
    String(input.countedCashPhysical - input.countedReservedCash),
  );
  confirmation().props.onCountedReservedCashChange(
    String(input.countedReservedCash),
  );
  for (const bank of input.banks)
    confirmation().props.onCountedBankChange(
      bank.bankId,
      String(bank.countedBalance),
    );
}

test("A-C: page guards manual start and confirm, including responsibility lost during counting", () => {
  reset();
  global.window = { setTimeout: () => 0 };
  login("juan-perez", "Juan Pérez");
  const ready = findNode(
    renderPage(),
    (node) => node.type?.name === "ReadyToCountCard",
  );
  assert.equal(ready.props.canStart, false);
  ready.props.onStartCount();
  assert.equal(confirmation(), null, "manual start is blocked for support");
  login("maria-lopez", "María López", "owner");
  startCount();
  fillCount();
  assert.equal(confirmation().props.canConfirm, true);
  const staleConfirm = confirmation().props.onConfirm;
  expectSuccess(
    act(() =>
      session.transferResponsibility("maria-lopez", "juan-perez", "1234"),
    ),
  );
  assert.equal(confirmation().props.canConfirm, false);
  confirmation().props.onConfirm("");
  staleConfirm("");
  assert.equal(
    shift.currentShift.status,
    "open",
    "both current and stale callbacks blocked",
  );
  assert.equal(
    findNode(renderPage(), (node) => node.type === "CashClosingResult"),
    null,
  );
  delete global.window;
});

test("lifecycle A-B: clean start, responsible permission, snapshot and duplicate start", () => {
  reset(false);
  assert.equal(shift.currentShift, null);
  assert.equal(shift.canStartShift(), false);
  for (const type of ["deposito", "retiro"])
    assert.equal(
      funds.registerClientOperation(operation(type, type)).success,
      false,
    );
  assert.equal(
    funds.registerMovement({
      movementType: "income",
      resourceId: "cash",
      amountCents: 100,
    }).success,
    false,
  );
  assert.equal(
    funds.deliverPendingWithdrawal({ operationId: "missing" }).success,
    false,
  );
  for (const [id, role] of [
    ["juan-perez", "employee"],
    ["juan-perez", "owner"],
    ["carlos-martinez", "owner"],
  ]) {
    login(id, id, role);
    assert.equal(shift.canStartShift(), false);
    assert.equal(
      shift.startShift({ cash: funds.cash, banks: funds.banks }).success,
      false,
    );
  }
  login("maria-lopez", "María López", "employee");
  assert.equal(shift.canStartShift(), true);
  const start = shift.startShift;
  const first = expectSuccess(
    start({ cash: funds.cash, banks: funds.banks }),
  ).shift;
  assert.equal(start({ cash: funds.cash, banks: funds.banks }).success, false);
  render();
  assert.equal(first.folio, "TUR-000001");
  assert.equal(first.status, "open");
  assert.equal(first.openingBalances.cashPhysical, funds.cash.physicalBalance);
  assert.deepEqual(
    first.openingBalances.banks.map((bank) => bank.balance),
    funds.banks.map((bank) => bank.realBalance),
  );
  assert.equal(shift.shifts.length, 1);
});

test("opening and reconciliation reject invalid amounts and bank identities without writes", () => {
  reset(false);
  login("maria-lopez", "María López", "owner");
  const valid = {
    countedCashPhysical: 100,
    banks: funds.banks.map((bank) => ({ bankId: bank.id, countedBalance: 0 })),
  };
  const before = structuredClone({ cash: funds.cash, banks: funds.banks });
  for (const input of [
    { ...valid, countedCashPhysical: -1 },
    { ...valid, countedCashPhysical: NaN },
    { ...valid, countedCashPhysical: Infinity },
    { ...valid, banks: valid.banks.slice(1) },
    { ...valid, banks: [...valid.banks, valid.banks[0]] },
    {
      ...valid,
      banks: valid.banks.map((bank, i) =>
        i === 0 ? { ...bank, bankId: "invented" } : bank,
      ),
    },
    {
      ...valid,
      banks: valid.banks.map((bank) => ({ ...bank, countedBalance: -1 })),
    },
    {
      ...valid,
      banks: valid.banks.map((bank) => ({ ...bank, countedBalance: Infinity })),
    },
  ]) {
    assert.ok(funds.validateReconciliation(input));
    assert.equal(
      act(() => funds.reconcileAfterShiftClosing(input)).success,
      false,
    );
    assert.deepEqual({ cash: funds.cash, banks: funds.banks }, before);
  }
  for (const cash of [
    { ...funds.cash, physicalBalance: -1 },
    { ...funds.cash, physicalBalance: NaN },
    { ...funds.cash, reservedOperations: [{ amount: 1 }] },
  ])
    assert.equal(shift.startShift({ cash, banks: funds.banks }).success, false);
  assert.equal(
    shift.startShift({
      cash: funds.cash,
      banks: funds.banks.map((bank) => ({ ...bank, realBalance: -1 })),
    }).success,
    false,
  );
  assert.equal(shift.currentShift, null);
  assert.deepEqual(shift.shifts, []);
});

for (const shortage of [false, true]) {
  test(`lifecycle C-I: close, reconcile ${shortage ? "shortages" : "exact counts"}, reopen, deliver and preserve history`, () => {
    reset();
    global.window = { setTimeout: () => 0 };
    addFunds();
    addFunds();
    const originalMovement = addFunds("bank-azteca");
    addFunds("bank-azteca");
    addFunds("bank-azteca");
    const pending = {
      ...operation("pending", "retiro", "pendiente"),
      amount: 5000,
      total: 5000,
      customerCashReceived: 5000,
      bankMovementAmount: 5000,
    };
    expectSuccess(act(() => funds.registerClientOperation(pending)));
    const firstId = shift.currentShift.id;
    const participants = structuredClone(session.participants);
    const reserves = structuredClone(funds.cash.reservedOperations);
    const bankReserves = structuredClone(
      funds.banks.map((bank) => bank.reservedOperations),
    );
    const counts = closingInput();
    assert.equal(counts.expectedCashPhysical, 20000);
    assert.equal(counts.expectedReservedCash, 5000);
    if (shortage) {
      counts.countedCashPhysical = 19800;
      counts.countedReservedCash = 4800;
      counts.banks.find(
        (bank) => bank.bankId === "bank-azteca",
      ).countedBalance = 29700;
    }
    startCount();
    fillCount(counts);
    let reconciliations = 0;
    const reconcile = funds.reconcileAfterShiftClosing;
    funds.reconcileAfterShiftClosing = (input) => {
      reconciliations++;
      return reconcile(input);
    };
    const callback = confirmation().props.onConfirm;
    callback(shortage ? "Faltante contado" : "");
    callback(shortage ? "Faltante contado" : "");
    render();
    assert.equal(reconciliations, 1);
    assert.equal(shift.currentShift, null);
    assert.equal(funds.cash.physicalBalance, shortage ? 19800 : 20000);
    assert.deepEqual(funds.cash.reservedOperations, reserves);
    assert.deepEqual(
      funds.banks.map((bank) => bank.reservedOperations),
      bankReserves,
    );
    assert.deepEqual(session.participants, participants);
    assert.equal(
      funds.cash.physicalBalance -
        reserves.reduce((sum, reserve) => sum + reserve.amount, 0),
      shortage ? 14800 : 15000,
    );
    assert.equal(
      shift.shifts[0].closing.countedReservedCash,
      shortage ? 4800 : 5000,
    );
    for (const role of ["employee", "owner"]) {
      const result = funds.correctClientOperation({
        ...actor,
        actorSystemRole: role,
        operationId: "pending",
        amount: 4000,
        reason: "Error",
      });
      assert.match(result.error, /turno cerrado/);
      assert.match(
        funds.correctMovement({
          ...actor,
          actorSystemRole: role,
          movementId: originalMovement.id,
          editReason: "Error",
        }).error,
        /turno cerrado/,
      );
    }
    const savedOperations = structuredClone(funds.operations);
    const savedMovements = structuredClone(funds.movements);
    const second = expectSuccess(
      act(() => shift.startShift({ cash: funds.cash, banks: funds.banks })),
    ).shift;
    assert.equal(second.folio, "TUR-000002");
    assert.equal(second.openingBalances.cashPhysical, shortage ? 19800 : 20000);
    assert.equal(second.openingBalances.cashReserved, 5000);
    assert.equal(
      second.openingBalances.banks.find((bank) => bank.bankId === "bank-azteca")
        .balance,
      shortage ? 29700 : 35000,
    );
    assert.deepEqual(funds.operations, savedOperations);
    assert.deepEqual(funds.movements, savedMovements);
    assert.match(
      funds.correctClientOperation({
        ...actor,
        operationId: "pending",
        amount: 4000,
        reason: "Error",
      }).error,
      /turno cerrado/,
    );
    const delivered = expectSuccess(
      act(() =>
        funds.deliverPendingWithdrawal({
          operationId: "pending",
          receiverName: "Cliente",
          deliveredBy: "María López",
          commissionMode: "cash",
          commissionAmount: 15,
          customerCashReceived: 5000,
          bankMovementAmount: 5000,
          appliedCommissionSnapshot: {
            operationAmountCents: 500000,
            calculatedCommissionCents: 1500,
            finalCommissionCents: 1500,
            ruleId: "test",
            ruleVersion: 1,
            calculationType: "fixed",
            location: "cash",
            appliedAt: new Date().toISOString(),
          },
        }),
      ),
    ).operation;
    assert.equal(delivered.shiftId, firstId);
    assert.equal(delivered.pendingDelivery.shiftId, second.id);
    const finalCounts = closingInput();
    assert.equal(finalCounts.expectedCashPhysical, funds.cash.physicalBalance);
    assert.equal(finalCounts.expectedReservedCash, 0);
    assert.equal(
      finalCounts.banks.find((bank) => bank.bankId === "bank-azteca")
        .expectedBalance,
      second.openingBalances.banks.find((bank) => bank.bankId === "bank-azteca")
        .balance,
    );
    expectSuccess(act(() => shift.closeCurrentShift(finalCounts)));
    expectSuccess(act(() => funds.reconcileAfterShiftClosing(finalCounts)));
    assert.equal(shift.currentShift, null);
    assert.deepEqual(
      shift.shifts.map((item) => item.folio),
      ["TUR-000001", "TUR-000002"],
    );
    assert.ok(
      shift.shifts.every((item) => item.status === "closed" && item.closing),
    );
    delete global.window;
  });
}

test("consecutive folios use largest valid suffix, not array length", () => {
  const { getNextShiftFolio } = require("../src/lib/shifts.ts");
  assert.equal(getNextShiftFolio([]), "TUR-000001");
  assert.equal(getNextShiftFolio([{ folio: "TUR-000001" }]), "TUR-000002");
  assert.equal(
    getNextShiftFolio(
      ["TUR-000009", "TUR-000003", "other", "TUR-999oops"].map((folio) => ({
        folio,
      })),
    ),
    "TUR-000010",
  );
  assert.equal(getNextShiftFolio([{ folio: "TUR-999999" }]), "TUR-1000000");
});

test("reconciliation preserves nonempty bank reservations and creates no records", () => {
  reset(false);
  const store = stores.get(BusinessFundsProvider);
  store[1] = store[1].map((bank, index) =>
    index === 0
      ? {
          ...bank,
          realBalance: 30000,
          reservedOperations: [
            { id: "bank-obligation", amount: 5000, status: "pending" },
          ],
        }
      : bank,
  );
  render();
  const before = structuredClone(funds.banks[0].reservedOperations);
  expectSuccess(
    act(() =>
      funds.reconcileAfterShiftClosing({
        countedCashPhysical: 19800,
        banks: funds.banks.map((bank) => ({
          bankId: bank.id,
          countedBalance: 29700,
        })),
      }),
    ),
  );
  assert.deepEqual(funds.banks[0].reservedOperations, before);
  assert.equal(funds.banks[0].realBalance, 29700);
  assert.equal(funds.cash.physicalBalance, 19800);
  assert.ok(Number.isFinite(Date.parse(funds.cash.updatedAt)));
  assert.deepEqual(funds.operations, []);
  assert.deepEqual(funds.movements, []);
});

test("start modal is informational and rechecks permission on manual confirmation", () => {
  reset(false);
  login("maria-lopez", "María López", "owner");
  const {
    StartShiftModal,
  } = require("../src/components/shifts/StartShiftModal.tsx");
  stores.set(StartShiftModal, []);
  currentStore = stores.get(StartShiftModal);
  cursor = 0;
  let closed = false;
  const modal = StartShiftModal({
    cash: funds.cash,
    banks: funds.banks,
    onClose: () => {
      closed = true;
    },
  });
  assert.equal(
    findNode(modal, (node) => node.type === "input"),
    null,
  );
  const confirm = findNode(
    modal.props.footer,
    (node) => node.type === "button" && node.props.disabled === false,
  );
  assert.ok(confirm);
  login("juan-perez", "Juan Pérez", "owner");
  confirm.props.onClick();
  assert.equal(shift.currentShift, null);
  assert.equal(closed, false);
  login("maria-lopez", "María López", "owner");
  confirm.props.onClick();
  render();
  assert.equal(shift.currentShift.folio, "TUR-000001");
  assert.equal(closed, true);
});

test("page validates reconciliation before close and does not report completion on reconciliation failure", () => {
  reset();
  global.window = { setTimeout: () => 0 };
  startCount();
  fillCount();
  const validate = funds.validateReconciliation;
  funds.validateReconciliation = () => "Banco inválido";
  confirmation().props.onConfirm("");
  assert.equal(shift.currentShift.status, "open");
  funds.validateReconciliation = validate;
  funds.reconcileAfterShiftClosing = () => ({
    success: false,
    error: "Reconciliación rechazada",
  });
  confirmation().props.onConfirm("");
  render();
  assert.equal(
    findNode(renderPage(), (node) => node.type === "CashClosingResult"),
    null,
  );
  delete global.window;
});

test("page marks completion only after successful close and preserves the saved result", () => {
  reset();
  global.window = { setTimeout: () => 0 };
  login("maria-lopez", "María López", "owner");
  startCount();
  fillCount();
  const realClose = shift.closeCurrentShift;
  shift.closeCurrentShift = () => ({
    success: false,
    error: "Cierre rechazado",
  });
  confirmation().props.onConfirm("");
  assert.equal(
    findNode(renderPage(), (node) => node.type === "CashClosingResult"),
    null,
  );
  assert.equal(shift.currentShift.status, "open");
  shift.closeCurrentShift = realClose;
  confirmation().props.onConfirm("");
  render();
  const result = findNode(
    renderPage(),
    (node) => node.type === "CashClosingResult",
  );
  assert.ok(result);
  assert.equal(result.props.shift.status, "closed");
  assert.equal(result.props.shift.closing.status, "balanced");
  assert.equal(shift.currentShift, null);
  delete global.window;
});
