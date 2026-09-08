import type { AdministrativeMovement } from "@/types/administrativeMovement";
import type {
  BankAccountBalance,
  CashBalance,
  ReservedOperation,
} from "@/types/balance";
import type {
  BankClosingMovement,
  BankClosingStory,
  CashClosingStory,
  CashMovement,
  CashMovementCategory,
  CashMovementCategorySummary,
  CommissionLocationBreakdownItem,
  FinancialTimeline,
  FinancialTimelineEvent,
  FinancialTimelineImpact,
  ShiftCommissionProfitSummary,
} from "@/types/cash-closing";
import type { Operation } from "@/types/operation";
import type { Shift } from "@/types/shift";
import {
  getWithdrawalBankCreditAmount,
  getWithdrawalCashDeliveryAmount,
} from "./finance";

export const CASH_CLOSING_CATEGORY_META: Record<
  CashMovementCategory,
  {
    label: string;
    helperText: string;
    direction: "in" | "out";
  }
> = {
  opening_balance: {
    label: "Caja al iniciar",
    helperText: "Es el efectivo registrado cuando comenzó el turno.",
    direction: "in",
  },
  cash_deposit: {
    label: "Depósitos recibidos",
    helperText: "Efectivo que entregaron clientes para realizar depósitos.",
    direction: "in",
  },
  cash_commission: {
    label: "Comisiones en caja",
    helperText: "Comisiones que quedaron físicamente en la caja.",
    direction: "in",
  },
  bank_commission: {
    label: "Comisiones en bancos",
    helperText: "Comisiones que quedaron depositadas en una cuenta bancaria.",
    direction: "in",
  },
  delivered_withdrawal: {
    label: "Retiros entregados",
    helperText: "Efectivo que salió de caja para entregar a clientes.",
    direction: "out",
  },
  reserved_withdrawal: {
    label: "Retiros pendientes",
    helperText: "Efectivo apartado que permanece físicamente en caja.",
    direction: "out",
  },
  business_fund_income: {
    label: "Fondos agregados al negocio",
    helperText: "Dinero interno agregado a caja; no es ganancia.",
    direction: "in",
  },
  business_fund_withdrawal: {
    label: "Fondos retirados del negocio",
    helperText: "Dinero interno retirado de caja; no es operación de cliente.",
    direction: "out",
  },
};

type ShiftOperationStage = {
  operation: Operation;
  delivery: boolean;
  reservedDelta: number;
};

// A pending withdrawal has two financial moments, possibly in different shifts.
function getShiftOperationStages(
  shiftId: string,
  operations: Operation[],
): ShiftOperationStage[] {
  const stages: ShiftOperationStage[] = [];
  for (const operation of operations) {
    if (operation.status === "cancelado") continue;
    const wasPending =
      operation.type === "retiro" &&
      (operation.status === "pendiente" || Boolean(operation.pendingDelivery));
    if (operation.shiftId === shiftId) {
      stages.push({
        operation: wasPending
          ? {
              ...operation,
              status: "pendiente",
              commission: 0,
              total: operation.amount,
              withdrawalCommissionMode: undefined,
              customerCashReceived: operation.amount,
              bankMovementAmount: operation.amount,
            }
          : operation,
        delivery: false,
        reservedDelta: wasPending ? operation.amount : 0,
      });
    }
    if (
      operation.type === "retiro" &&
      operation.status !== "pendiente" &&
      operation.pendingDelivery?.shiftId === shiftId
    ) {
      stages.push({
        operation: {
          ...operation,
          createdAt: operation.pendingDelivery.deliveredAt,
          createdBy: operation.pendingDelivery.deliveredBy,
        },
        delivery: true,
        reservedDelta: -operation.amount,
      });
    }
  }
  return stages;
}

export function buildCashClosingStory({
  shiftId,
  openingBalances,
  banks,
  operations,
  administrativeMovements,
}: {
  shiftId: string;
  openingBalances: Shift["openingBalances"];
  cash: CashBalance;
  banks: BankAccountBalance[];
  operations: Operation[];
  administrativeMovements: AdministrativeMovement[];
}): CashClosingStory {
  const stages = getShiftOperationStages(shiftId, operations);
  const shiftMovements = administrativeMovements.filter(
    (movement) => movement.shiftId === shiftId,
  );
  const operationMovements = stages.flatMap(({ operation }) =>
    operationToCashMovements(operation),
  );
  const bankMovements = [
    ...stages.flatMap((stage) =>
      operationToBankMovements(stage.operation, banks)
        .map((movement) =>
          stage.delivery
            ? {
                ...movement,
                id: `${movement.id}-delivery`,
                description: "Comisión depositada al entregar retiro pendiente",
                amount:
                  stage.operation.withdrawalCommissionMode === "deposited"
                    ? stage.operation.commission
                    : 0,
              }
            : movement,
        )
        .filter((movement) => movement.amount !== 0),
    ),
    ...shiftMovements
      .filter((movement) => movement.resourceType === "bank")
      .map(administrativeMovementToBankMovement),
  ];
  const allMovements = [
    ...operationMovements,
    ...shiftMovements
      .filter((movement) => movement.resourceType === "cash")
      .map(administrativeMovementToCashMovement),
  ];
  const totalEntries = sumMovements(allMovements, "in");
  const totalOutputs = sumMovements(allMovements, "out");
  const openingBalance = openingBalances.cashPhysical;
  const expectedCash = openingBalance + totalEntries - totalOutputs;
  const reservedTotal =
    openingBalances.cashReserved +
    stages.reduce((sum, stage) => sum + stage.reservedDelta, 0);
  const reservedMovements = operations
    .filter(
      (operation) =>
        operation.shiftId === shiftId &&
        operation.type === "retiro" &&
        operation.status === "pendiente",
    )
    .map((operation) =>
      reservedToCashMovement({
        id: operation.id,
        folio: operation.bankFolio,
        type: "retiro",
        customerName: operation.receiverName || operation.senderName,
        amount: operation.amount,
        registeredAt: operation.createdAt,
        registeredBy: operation.createdBy,
        status: "pending",
      }),
    );
  return {
    openingBalance,
    entries: summarizeCategories(allMovements, "in"),
    outputs: summarizeCategories(allMovements, "out"),
    allMovements,
    totalEntries,
    totalOutputs,
    expectedCash,
    reservedCash: { total: reservedTotal, movements: reservedMovements },
    availableCash: expectedCash - reservedTotal,
    bankStories: buildBankStories(banks, bankMovements, openingBalances),
    timeline: buildFinancialTimeline({
      openingBalances,
      banks,
      stages,
      administrativeMovements: shiftMovements,
    }),
    commissionProfit: buildCommissionProfitSummary(
      stages
        .filter((stage) => stage.operation.status !== "pendiente")
        .map((stage) => stage.operation),
      banks,
    ),
  };
}

function operationToCashMovements(operation: Operation): CashMovement[] {
  if (operation.type === "retiro" && operation.status === "pendiente")
    return [];
  const commission = operation.commission ?? 0;

  if (operation.type === "deposito") {
    return [
      {
        id: `${operation.id}-cash`,
        folio: operation.bankFolio,
        category: "cash_deposit",
        direction: "in",
        description: `Efectivo recibido de ${operation.senderName}`,
        amount: operation.amount,
        registeredAt: operation.createdAt,
        registeredBy: operation.createdBy,
        sourceType: "operation",
        sourceId: operation.id,
        customerName: operation.senderName,
      },
      ...(commission > 0
        ? [
            {
              id: `${operation.id}-commission-cash`,
              folio: operation.bankFolio,
              category: "cash_commission" as const,
              direction: "in" as const,
              description: "Comisión de depósito cobrada en caja",
              amount: commission,
              registeredAt: operation.createdAt,
              registeredBy: operation.createdBy,
              sourceType: "operation" as const,
              sourceId: operation.id,
              customerName: operation.senderName,
            },
          ]
        : []),
    ];
  }

  const cashDelivered =
    operation.customerCashReceived ??
    (operation.withdrawalCommissionMode === "deducted"
      ? Math.max(0, operation.amount - commission)
      : operation.amount);
  const isCashCommission = operation.withdrawalCommissionMode === "cash";

  return [
    {
      id: `${operation.id}-cash`,
      folio: operation.bankFolio,
      category: "delivered_withdrawal",
      direction: "out",
      description: `Efectivo entregado a ${operation.receiverName || "cliente"}`,
      amount: cashDelivered,
      registeredAt: operation.createdAt,
      registeredBy: operation.createdBy,
      sourceType: "operation",
      sourceId: operation.id,
      customerName: operation.receiverName || operation.senderName,
    },
    ...(isCashCommission && commission > 0
      ? [
          {
            id: `${operation.id}-commission-cash`,
            folio: operation.bankFolio,
            category: "cash_commission" as const,
            direction: "in" as const,
            description: "Comisión de retiro pagada en efectivo",
            amount: commission,
            registeredAt: operation.createdAt,
            registeredBy: operation.createdBy,
            sourceType: "operation" as const,
            sourceId: operation.id,
            customerName: operation.receiverName || operation.senderName,
          },
        ]
      : []),
  ];
}

function operationToBankMovements(
  operation: Operation,
  banks: BankAccountBalance[],
): BankClosingMovement[] {
  const bank = getOperationBank(operation, banks);
  if (!bank) return [];

  const commission = operation.commission ?? 0;

  if (operation.type === "deposito") {
    return [
      {
        id: `${operation.id}-bank`,
        folio: operation.bankFolio,
        bankId: bank.id,
        bankName: bank.bankName,
        direction: "out",
        description: `Depósito enviado desde ${bank.bankName}`,
        amount: operation.amount,
        registeredAt: operation.createdAt,
        registeredBy: operation.createdBy,
        sourceType: "operation",
        sourceId: operation.id,
        customerName: operation.senderName,
      },
    ];
  }

  const bankAmount =
    operation.bankMovementAmount ??
    (operation.withdrawalCommissionMode === "deposited"
      ? operation.amount + commission
      : operation.amount);

  return [
    {
      id: `${operation.id}-bank`,
      folio: operation.bankFolio,
      bankId: bank.id,
      bankName: bank.bankName,
      direction: "in",
      description:
        operation.withdrawalCommissionMode === "deposited"
          ? `Retiro recibido en ${bank.bankName} con comisión depositada`
          : `Retiro recibido en ${bank.bankName}`,
      amount: bankAmount,
      registeredAt: operation.createdAt,
      registeredBy: operation.createdBy,
      sourceType: "operation",
      sourceId: operation.id,
      customerName: operation.receiverName || operation.senderName,
    },
  ];
}

function administrativeMovementToCashMovement(
  movement: AdministrativeMovement,
): CashMovement {
  const isIncome = movement.movementType === "income";

  return {
    id: movement.id,
    folio: movement.id,
    category: isIncome ? "business_fund_income" : "business_fund_withdrawal",
    direction: isIncome ? "in" : "out",
    description:
      movement.explanation ??
      (isIncome
        ? "Ingreso interno a fondos del negocio"
        : "Retiro interno de fondos del negocio"),
    amount: movement.amountCents / 100,
    registeredAt: movement.createdAt,
    registeredBy: movement.createdByUserName,
    sourceType: "administrative_movement",
    sourceId: movement.id,
  };
}

function administrativeMovementToBankMovement(
  movement: AdministrativeMovement,
): BankClosingMovement {
  const isIncome = movement.movementType === "income";

  return {
    id: movement.id,
    folio: movement.id,
    bankId: movement.resourceId,
    bankName: movement.resourceName,
    direction: isIncome ? "in" : "out",
    description:
      movement.explanation ??
      (isIncome ? "Ingreso interno a banco" : "Retiro interno desde banco"),
    amount: movement.amountCents / 100,
    registeredAt: movement.createdAt,
    registeredBy: movement.createdByUserName,
    sourceType: "administrative_movement",
    sourceId: movement.id,
  };
}

function reservedToCashMovement(operation: ReservedOperation): CashMovement {
  return {
    id: operation.id,
    folio: operation.folio,
    category: "reserved_withdrawal",
    direction: "out",
    description: `Retiro pendiente para ${operation.customerName}`,
    amount: operation.amount,
    registeredAt: operation.registeredAt,
    registeredBy: operation.registeredBy,
    sourceType: "reserved_withdrawal",
    sourceId: operation.id,
    customerName: operation.customerName,
  };
}

function buildBankStories(
  banks: BankAccountBalance[],
  movements: BankClosingMovement[],
  openingBalances: Shift["openingBalances"],
): BankClosingStory[] {
  return banks.map((bank) => {
    const bankMovements = movements.filter(
      (movement) => movement.bankId === bank.id,
    );
    const entries = bankMovements.filter(
      (movement) => movement.direction === "in",
    );
    const outputs = bankMovements.filter(
      (movement) => movement.direction === "out",
    );
    const totalEntries = entries.reduce(
      (sum, movement) => sum + movement.amount,
      0,
    );
    const totalOutputs = outputs.reduce(
      (sum, movement) => sum + movement.amount,
      0,
    );
    const openingBalance =
      openingBalances.banks.find((opening) => opening.bankId === bank.id)
        ?.balance ?? 0;

    return {
      bankId: bank.id,
      bankName: bank.bankName,
      accountName: bank.accountName,
      openingBalance,
      entries,
      outputs,
      totalEntries,
      totalOutputs,
      expectedBalance: openingBalance + totalEntries - totalOutputs,
    };
  });
}

function summarizeCategories(
  movements: CashMovement[],
  direction: "in" | "out",
): CashMovementCategorySummary[] {
  const map = new Map<CashMovementCategory, CashMovementCategorySummary>();

  for (const movement of movements) {
    if (movement.direction !== direction) continue;

    const meta = CASH_CLOSING_CATEGORY_META[movement.category];
    const existing = map.get(movement.category);
    if (existing) {
      existing.total += movement.amount;
      existing.count += 1;
      existing.movements.push(movement);
      continue;
    }

    map.set(movement.category, {
      category: movement.category,
      label: meta.label,
      helperText: meta.helperText,
      total: movement.amount,
      count: 1,
      direction,
      movements: [movement],
    });
  }

  return Array.from(map.values());
}

function buildCommissionProfitSummary(
  operations: Operation[],
  banks: BankAccountBalance[],
): ShiftCommissionProfitSummary {
  const cashMovements: CashMovement[] = [];
  const bankMovements: CashMovement[] = [];

  for (const operation of operations) {
    const commission = operation.commission ?? 0;
    if (commission <= 0) continue;

    if (operation.type === "deposito") {
      cashMovements.push({
        id: `${operation.id}-profit-cash`,
        folio: operation.bankFolio,
        category: "cash_commission",
        direction: "in",
        description: "Comisión generada por depósito",
        amount: commission,
        registeredAt: operation.createdAt,
        registeredBy: operation.createdBy,
        sourceType: "operation",
        sourceId: operation.id,
        customerName: operation.senderName,
      });
      continue;
    }

    if (operation.withdrawalCommissionMode === "deposited") {
      const bankName = getOperationBankName(operation, banks);
      bankMovements.push({
        id: `${operation.id}-profit-bank`,
        folio: operation.bankFolio,
        category: "bank_commission",
        direction: "in",
        description: "Comisión de retiro depositada por el cliente",
        amount: commission,
        registeredAt: operation.createdAt,
        registeredBy: operation.createdBy,
        sourceType: "operation",
        sourceId: operation.id,
        bankName,
        customerName: operation.receiverName || operation.senderName,
      });
      continue;
    }

    cashMovements.push({
      id: `${operation.id}-profit-cash`,
      folio: operation.bankFolio,
      category: "cash_commission",
      direction: "in",
      description:
        operation.withdrawalCommissionMode === "deducted"
          ? "Comisión descontada del retiro"
          : "Comisión de retiro pagada en efectivo",
      amount: commission,
      registeredAt: operation.createdAt,
      registeredBy: operation.createdBy,
      sourceType: "operation",
      sourceId: operation.id,
      customerName: operation.receiverName || operation.senderName,
    });
  }

  const bankBreakdown = summarizeCommissionBanks(bankMovements);
  const cashCommissionProfit = cashMovements.reduce(
    (sum, movement) => sum + movement.amount,
    0,
  );
  const bankCommissionProfit = bankBreakdown.reduce(
    (sum, bank) => sum + bank.amount,
    0,
  );

  return {
    totalCommissionProfit: cashCommissionProfit + bankCommissionProfit,
    cashCommissionProfit,
    bankCommissionProfit,
    depositCommissionProfit: operations
      .filter((operation) => operation.type === "deposito")
      .reduce((sum, operation) => sum + (operation.commission ?? 0), 0),
    withdrawalCommissionProfit: operations
      .filter((operation) => operation.type === "retiro")
      .reduce((sum, operation) => sum + (operation.commission ?? 0), 0),
    bankBreakdown,
    cashMovements,
    bankMovements,
  };
}

function summarizeCommissionBanks(
  movements: CashMovement[],
): CommissionLocationBreakdownItem[] {
  const map = new Map<string, CommissionLocationBreakdownItem>();

  for (const movement of movements) {
    const id = movement.bankName ?? "Banco no identificado";
    const existing = map.get(id);
    if (existing) {
      existing.amount += movement.amount;
      existing.count += 1;
      existing.movements.push(movement);
      continue;
    }
    map.set(id, {
      id,
      label: id,
      amount: movement.amount,
      count: 1,
      movements: [movement],
    });
  }

  return Array.from(map.values());
}

function getOperationBankName(
  operation: Operation,
  banks: BankAccountBalance[],
): string {
  const bankReference =
    operation.bankResourceId ??
    (operation.type === "deposito" ? operation.bankTo : operation.bankFrom);
  return (
    banks.find((bank) => bank.id === bankReference)?.bankName ??
    bankReference ??
    "Banco no identificado"
  );
}

function getOperationBank(
  operation: Operation,
  banks: BankAccountBalance[],
): BankAccountBalance | undefined {
  const bankReference =
    operation.bankResourceId ??
    (operation.type === "deposito" ? operation.bankTo : operation.bankFrom);

  return banks.find(
    (bank) => bank.id === bankReference || bank.bankName === bankReference,
  );
}

function buildFinancialTimeline({
  openingBalances,
  banks,
  stages,
  administrativeMovements,
}: {
  openingBalances: Shift["openingBalances"];
  banks: BankAccountBalance[];
  stages: ShiftOperationStage[];
  administrativeMovements: AdministrativeMovement[];
}): FinancialTimeline {
  const rawEvents = [
    ...stages.map((stage) => {
      const seed = operationToTimelineSeed(stage.operation, banks);
      if (!seed) return null;
      seed.resourceDeltas.availableCash =
        (seed.resourceDeltas.availableCash ?? 0) - stage.reservedDelta;
      if (stage.reservedDelta !== 0)
        seed.resourceDeltas.reservedCash = stage.reservedDelta;
      if (stage.delivery) {
        seed.id = `${seed.id}-delivery`;
        seed.title = "Entrega de retiro pendiente";
        seed.note =
          "Se libera el apartado y se entrega el efectivo. El importe del retiro ya ingresó al banco al registrarlo.";
        const bank = getOperationBank(stage.operation, banks);
        seed.resourceDeltas.banks =
          bank && stage.operation.withdrawalCommissionMode === "deposited"
            ? { [bank.id]: stage.operation.commission }
            : {};
      } else if (stage.operation.status === "pendiente") {
        seed.title = "Registro de retiro pendiente";
        seed.cashDetail =
          "Se aparta efectivo disponible; no hay salida física de caja.";
        seed.reservedCashDetail =
          "Este efectivo sigue físicamente en el negocio.";
      }
      return seed;
    }),
    ...administrativeMovements.map(administrativeMovementToTimelineSeed),
  ]
    .filter((event): event is TimelineSeed => event !== null)
    .sort(
      (a, b) =>
        getTimelineSortTime(a.occurredAt) - getTimelineSortTime(b.occurredAt),
    );
  const balances = {
    availableCash: openingBalances.cashPhysical - openingBalances.cashReserved,
    reservedCash: openingBalances.cashReserved,
    banks: new Map(
      banks.map((bank) => [
        bank.id,
        openingBalances.banks.find((opening) => opening.bankId === bank.id)
          ?.balance ?? 0,
      ]),
    ),
  };

  const initialAvailableCash = balances.availableCash;
  const initialReservedCash = balances.reservedCash;
  const initialCash = initialAvailableCash + initialReservedCash;
  const initialBanks = banks.map((bank) => ({
    bankId: bank.id,
    bankName: bank.bankName,
    accountName: bank.accountName,
    initialBalance: balances.banks.get(bank.id) ?? 0,
    finalBalance: balances.banks.get(bank.id) ?? 0,
  }));
  const events: FinancialTimelineEvent[] = [];

  for (const seed of rawEvents) {
    const impacts: FinancialTimelineImpact[] = [];

    if (seed.resourceDeltas.availableCash !== undefined) {
      const before = balances.availableCash;
      const amount = seed.resourceDeltas.availableCash;
      const after = before + amount;
      impacts.push({
        resourceId: "cash_available",
        resourceName: "Caja disponible",
        resourceType: "cash",
        before,
        amount,
        after,
        detail: seed.cashDetail,
      });
      balances.availableCash = after;
    }

    if (seed.resourceDeltas.reservedCash !== undefined) {
      const before = balances.reservedCash;
      const amount = seed.resourceDeltas.reservedCash;
      const after = before + amount;
      impacts.push({
        resourceId: "cash_reserved",
        resourceName: "Caja de retiros apartados",
        resourceType: "reserved_cash",
        before,
        amount,
        after,
        detail: seed.reservedCashDetail,
      });
      balances.reservedCash = after;
    }

    for (const [bankId, amount] of Object.entries(seed.resourceDeltas.banks)) {
      const bank = banks.find((item) => item.id === bankId);
      if (!bank) continue;

      const before = balances.banks.get(bankId) ?? 0;
      const after = before + amount;
      impacts.push({
        resourceId: bankId,
        resourceName: bank.bankName,
        resourceType: "bank",
        before,
        amount,
        after,
      });
      balances.banks.set(bankId, after);
    }

    events.push({
      id: seed.id,
      type: seed.type,
      title: seed.title,
      badge: seed.badge,
      occurredAt: seed.occurredAt,
      actor: seed.actor,
      description: seed.description,
      details: seed.details,
      impacts,
      commissionInfo: seed.commissionInfo,
      note: seed.note,
    });
  }

  const finalBanks = banks.map((bank) => ({
    bankId: bank.id,
    bankName: bank.bankName,
    accountName: bank.accountName,
    initialBalance:
      initialBanks.find((item) => item.bankId === bank.id)?.initialBalance ?? 0,
    finalBalance: balances.banks.get(bank.id) ?? 0,
  }));
  const totalBanks = finalBanks.reduce(
    (sum, bank) => sum + bank.finalBalance,
    0,
  );
  const reconstructionIssues: string[] = [];
  const reconstructedTotalCash = balances.availableCash + balances.reservedCash;

  return {
    initialCash,
    initialReservedCash,
    initialAvailableCash,
    initialBanks,
    events,
    finalCash: reconstructedTotalCash,
    finalReservedCash: balances.reservedCash,
    finalAvailableCash: balances.availableCash,
    finalBanks,
    totalBanks,
    totalControlled: reconstructedTotalCash + totalBanks,
    reconstructionIssues,
  };
}

type TimelineSeed = {
  id: string;
  type: FinancialTimelineEvent["type"];
  title: string;
  badge: string;
  occurredAt: string;
  actor: string;
  description: string;
  details: Array<{ label: string; value: string }>;
  resourceDeltas: {
    availableCash?: number;
    reservedCash?: number;
    banks: Record<string, number>;
  };
  cashDetail?: string;
  reservedCashDetail?: string;
  commissionInfo?: string;
  note?: string;
};

function operationToTimelineSeed(
  operation: Operation,
  banks: BankAccountBalance[],
): TimelineSeed | null {
  const bank = getOperationBank(operation, banks);
  const commission = operation.commission ?? 0;

  if (operation.type === "deposito") {
    const cashDelta = operation.amount + commission;
    return {
      id: operation.id,
      type: "deposit",
      title: "Depósito de cliente",
      badge: "DEPÓSITO",
      occurredAt: operation.createdAt,
      actor: operation.createdBy,
      description: operation.senderName,
      details: [
        {
          label: "Monto enviado",
          value: formatPlainCurrency(operation.amount),
        },
        { label: "Comisión", value: formatPlainCurrency(commission) },
        {
          label: "Banco de emisión",
          value: bank?.bankName ?? "Banco no identificado",
        },
      ],
      resourceDeltas: {
        availableCash: cashDelta,
        banks: bank ? { [bank.id]: -operation.amount } : {},
      },
      cashDetail:
        commission > 0
          ? `Incluye ${formatPlainCurrency(commission)} de comisión que permanecen en Caja física.`
          : undefined,
      commissionInfo:
        commission > 0
          ? `${formatPlainCurrency(commission)} quedó en Caja física.`
          : undefined,
    };
  }

  const bankDelta = getWithdrawalBankCreditAmount(operation);
  const cashDeliveryAmount = getWithdrawalCashDeliveryAmount(operation);
  const cashDelta =
    operation.status === "pendiente"
      ? operation.withdrawalCommissionMode === "cash"
        ? commission
        : 0
      : operation.withdrawalCommissionMode === "cash"
        ? -operation.amount + commission
        : -cashDeliveryAmount;
  const cashDetail =
    operation.withdrawalCommissionMode === "cash"
      ? `Se entregó ${formatPlainCurrency(operation.amount)} y el cliente pagó ${formatPlainCurrency(commission)} en efectivo.`
      : operation.withdrawalCommissionMode === "deducted"
        ? `El cliente recibe ${formatPlainCurrency(Math.max(0, operation.amount - commission))}; la comisión permanece en Caja física sin sumarse otra vez.`
        : undefined;
  const commissionInfo =
    commission > 0
      ? operation.withdrawalCommissionMode === "deposited"
        ? `${formatPlainCurrency(commission)} quedó en ${bank?.bankName ?? "banco"}.`
        : `${formatPlainCurrency(commission)} quedó en Caja física.`
      : undefined;

  return {
    id: operation.id,
    type: "withdrawal",
    title: "Retiro de cliente",
    badge: "RETIRO",
    occurredAt: operation.createdAt,
    actor: operation.createdBy,
    description: operation.receiverName || operation.senderName,
    details: [
      {
        label: "Monto del retiro",
        value: formatPlainCurrency(operation.amount),
      },
      { label: "Comisión", value: formatPlainCurrency(commission) },
      {
        label: "Banco de recepción",
        value: bank?.bankName ?? "Banco no identificado",
      },
      ...(operation.status === "pendiente"
        ? [{ label: "Estado", value: "Pendiente de entrega" }]
        : []),
    ],
    resourceDeltas: {
      availableCash: cashDelta,
      banks: bank ? { [bank.id]: bankDelta } : {},
    },
    cashDetail,
    commissionInfo,
  };
}

function administrativeMovementToTimelineSeed(
  movement: AdministrativeMovement,
): TimelineSeed {
  const isIncome = movement.movementType === "income";
  const amount = movement.amountCents / 100;
  const delta = isIncome ? amount : -amount;
  const isCash = movement.resourceType === "cash";

  return {
    id: movement.id,
    type: isIncome ? "business_fund_income" : "business_fund_withdrawal",
    title: "Fondos del negocio",
    badge: `FONDOS DEL NEGOCIO · ${isIncome ? "INGRESO" : "RETIRO"}`,
    occurredAt: movement.createdAt,
    actor: movement.createdByUserName,
    description: movement.resourceName,
    details: [
      { label: "Recurso", value: movement.resourceName },
      { label: "Monto", value: formatPlainCurrency(amount) },
      { label: "Motivo", value: movement.explanation ?? "Sin explicación." },
    ],
    resourceDeltas: {
      availableCash: isCash ? delta : undefined,
      banks: isCash ? {} : { [movement.resourceId]: delta },
    },
    note: "No es ganancia.",
  };
}

function getTimelineSortTime(value: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isNaN(parsed)) return parsed;

  const match = value.match(/(\d{1,2}):(\d{2})\s*a\.\s*m\./i);
  if (match) {
    const [, hour, minutes] = match;
    return Number(hour) * 60 + Number(minutes);
  }

  return Number.MAX_SAFE_INTEGER;
}

function formatPlainCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function sumMovements(
  movements: CashMovement[],
  direction: "in" | "out",
): number {
  return movements
    .filter((movement) => movement.direction === direction)
    .reduce((sum, movement) => sum + movement.amount, 0);
}
