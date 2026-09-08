const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.startsWith("@/"))
    request = path.resolve(__dirname, "../src", request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};
for (const extension of [".ts", ".tsx"])
  Module._extensions[extension] = (module, filename) => {
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText,
      filename,
    );
  };
const { buildCashClosingStory } = require("../src/lib/cashClosing.ts");
const { buildShiftClosing } = require("../src/lib/shifts.ts");
const { getOperationFinancialImpact } = require("../src/lib/finance.ts");
const bank = {
  id: "bank-azteca",
  bankName: "Banco Azteca",
  accountName: "Cuenta principal",
  realBalance: 987654,
  reservedOperations: [],
  status: "available",
};
const opening = {
  cashPhysical: 20000,
  cashReserved: 0,
  banks: [{ bankId: bank.id, bankName: bank.bankName, balance: 3000 }],
};
const pending = {
  id: "RET-P",
  shiftId: "A",
  type: "retiro",
  status: "pendiente",
  amount: 5000,
  commission: 0,
  total: 5000,
  customerCashReceived: 5000,
  bankMovementAmount: 5000,
  bankResourceId: bank.id,
  bankFrom: bank.bankName,
  bankFolio: "RET-5000",
  createdAt: "2026-09-08T10:00:00Z",
  createdBy: "Ana",
  senderName: "",
  receiverName: "Cliente",
};
function story(
  operations = [],
  movements = [],
  balances = opening,
  shiftId = "A",
) {
  return buildCashClosingStory({
    shiftId,
    openingBalances: balances,
    banks: [bank],
    cash: {
      physicalBalance: 999999,
      reservedOperations: [{ id: "unrelated", amount: 999 }],
      updatedAt: "",
    },
    operations,
    administrativeMovements: movements,
  });
}
function delivered(mode, shiftId = "A") {
  return {
    ...pending,
    status: "entregado",
    commission: 100,
    withdrawalCommissionMode: mode,
    customerCashReceived: mode === "deducted" ? 4900 : 5000,
    bankMovementAmount: mode === "deposited" ? 5100 : 5000,
    pendingDelivery: {
      shiftId,
      deliveredAt: "2026-09-08T12:00:00Z",
      deliveredBy: "Pedro",
    },
  };
}
function assertTimelineMatches(result) {
  assert.equal(result.timeline.initialCash, result.openingBalance);
  assert.equal(result.timeline.finalCash, result.expectedCash);
  assert.equal(result.timeline.finalReservedCash, result.reservedCash.total);
  assert.equal(result.timeline.finalAvailableCash, result.availableCash);
  assert.equal(
    result.timeline.finalBanks[0].finalBalance,
    result.bankStories[0].expectedBalance,
  );
}
test("D: pending registration preserves physical cash and adds bank balance and reservation", () => {
  const result = story([pending]);
  assert.equal(result.expectedCash, 20000);
  assert.equal(result.reservedCash.total, 5000);
  assert.equal(result.availableCash, 15000);
  assert.equal(result.totalOutputs, 0);
  assert.equal(result.allMovements.length, 0);
  assert.equal(result.bankStories[0].expectedBalance, 8000);
  assert.equal(result.commissionProfit.totalCommissionProfit, 0);
  assert.equal(result.timeline.events.length, 1);
  assertTimelineMatches(result);
});
for (const mode of ["cash", "deposited", "deducted"]) {
  test(`E: same-shift pending delivery is counted once (${mode})`, () => {
    const op = delivered(mode);
    const result = story([op]);
    const impact = getOperationFinancialImpact(op);
    assert.equal(result.expectedCash, opening.cashPhysical + impact.cashDelta);
    assert.equal(
      result.bankStories[0].expectedBalance,
      3000 + impact.bankDeltas[0].amount,
    );
    assert.equal(result.reservedCash.total, 0);
    assert.equal(
      result.allMovements.filter(
        (movement) => movement.category === "delivered_withdrawal",
      ).length,
      1,
    );
    assert.equal(result.totalOutputs, mode === "deducted" ? 4900 : 5000);
    assert.equal(result.commissionProfit.totalCommissionProfit, 100);
    assert.equal(result.timeline.events.length, 2);
    assert.equal(result.timeline.events[1].actor, "Pedro");
    assert.equal(
      result.timeline.events[1].occurredAt,
      op.pendingDelivery.deliveredAt,
    );
    assertTimelineMatches(result);
  });
  test(`cross-shift delivery releases opening reserve without repeating bank principal (${mode})`, () => {
    const op = delivered(mode, "B");
    const registration = story([op]);
    assert.equal(registration.expectedCash, 20000);
    assert.equal(registration.reservedCash.total, 5000);
    assert.equal(registration.bankStories[0].expectedBalance, 8000);
    assert.equal(registration.commissionProfit.totalCommissionProfit, 0);
    const nextOpening = {
      cashPhysical: 20000,
      cashReserved: 5000,
      banks: [{ ...opening.banks[0], balance: 8000 }],
    };
    const delivery = story([op], [], nextOpening, "B");
    assert.equal(delivery.expectedCash, mode === "deposited" ? 15000 : 15100);
    assert.equal(delivery.reservedCash.total, 0);
    assert.equal(
      delivery.bankStories[0].expectedBalance,
      mode === "deposited" ? 8100 : 8000,
    );
    assert.equal(delivery.timeline.events.length, 1);
    assert.equal(delivery.totalOutputs, mode === "deducted" ? 4900 : 5000);
    assertTimelineMatches(delivery);
  });
}
test("F-G: foreign, legacy and cancelled operations and foreign funds never enter the current cut", () => {
  const foreign = { ...pending, id: "foreign", shiftId: "B" };
  const legacy = { ...pending, id: "legacy", shiftId: undefined };
  const cancelled = { ...pending, id: "cancelled", status: "cancelado" };
  const movement = {
    id: "funds",
    shiftId: "B",
    movementType: "income",
    resourceType: "cash",
    resourceId: "cash",
    amountCents: 700000,
    createdAt: pending.createdAt,
    createdByUserName: "Pedro",
    status: "active",
  };
  const result = story(
    [foreign, legacy, cancelled],
    [
      movement,
      {
        ...movement,
        id: "bank-funds",
        resourceType: "bank",
        resourceId: bank.id,
      },
    ],
  );
  assert.equal(result.expectedCash, opening.cashPhysical);
  assert.equal(result.bankStories[0].expectedBalance, opening.banks[0].balance);
  assert.equal(result.reservedCash.total, 0);
  assert.equal(result.allMovements.length, 0);
  assert.equal(result.timeline.events.length, 0);
  assertTimelineMatches(result);
});
test("normal deposits, withdrawals and corrected funds use shift opening balances and existing impacts", () => {
  const deposit = {
    ...pending,
    id: "DEP",
    type: "deposito",
    status: "completado",
    amount: 1000,
    commission: 12,
  };
  const withdrawal = {
    ...delivered("cash"),
    id: "RET",
    pendingDelivery: undefined,
  };
  const movement = {
    id: "M",
    shiftId: "A",
    movementType: "income",
    resourceType: "cash",
    resourceId: "cash",
    resourceName: "Caja física",
    amountCents: 100000,
    createdAt: pending.createdAt,
    createdByUserName: "Ana",
    status: "corrected",
  };
  const result = story([deposit, withdrawal], [movement]);
  const impacts = [deposit, withdrawal].map(getOperationFinancialImpact);
  assert.equal(
    result.expectedCash,
    20000 + 1000 + impacts.reduce((sum, impact) => sum + impact.cashDelta, 0),
  );
  assert.equal(result.timeline.events.length, 3);
  assertTimelineMatches(result);
});
test("opening reserved cash remains part of physical cash, even without new operations", () => {
  const result = story([], [], { ...opening, cashReserved: 3000 });
  assert.equal(result.expectedCash, 20000);
  assert.equal(result.reservedCash.total, 3000);
  assert.equal(result.availableCash, 17000);
  assertTimelineMatches(result);
});
test("closing snapshot counts reserved difference only inside physical cash and validates amounts", () => {
  const input = {
    shiftId: "A",
    expectedCashPhysical: 20000,
    countedCashPhysical: 19900,
    expectedReservedCash: 5000,
    countedReservedCash: 4900,
    banks: [
      {
        bankId: bank.id,
        bankName: bank.bankName,
        expectedBalance: 8000,
        countedBalance: 8000,
      },
    ],
    observations: "Faltante",
  };
  const result = buildShiftClosing(
    input,
    { userId: "ana", userName: "Ana" },
    "2026-09-08T14:00:00Z",
  );
  assert.equal(result.closing.totalDifference, -100);
  assert.equal(result.closing.status, "shortage");
  assert.equal(
    buildShiftClosing(
      { ...input, countedCashPhysical: NaN },
      { userId: "a", userName: "A" },
      "now",
    ).closing,
    undefined,
  );
  assert.equal(
    buildShiftClosing(
      { ...input, countedReservedCash: 30000 },
      { userId: "a", userName: "A" },
      "now",
    ).closing,
    undefined,
  );
});
