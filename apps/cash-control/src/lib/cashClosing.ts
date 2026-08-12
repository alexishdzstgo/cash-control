import type { AdministrativeMovement } from "@/types/administrativeMovement";
import type {
  BankAccountBalance,
  CashBalance,
  ReservedOperation,
} from "@/types/balance";
import type {
  CashClosingStory,
  CashMovement,
  CashMovementCategory,
  CashMovementCategorySummary,
  CommissionLocationBreakdownItem,
  ShiftCommissionProfitSummary,
} from "@/types/cash-closing";
import type { Operation } from "@/types/operation";

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

export function buildCashClosingStory({
  cash,
  banks,
  operations,
  administrativeMovements,
  fallbackOpeningBalance,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  operations: Operation[];
  administrativeMovements: AdministrativeMovement[];
  fallbackOpeningBalance: number;
}): CashClosingStory {
  const shiftOperations = operations.filter(isCurrentShiftOperation);
  const operationMovements = shiftOperations.flatMap(operationToCashMovements);
  const administrativeCashMovements = administrativeMovements
    .filter((movement) => movement.resourceType === "cash")
    .map(administrativeMovementToCashMovement);
  const allMovements = [...operationMovements, ...administrativeCashMovements];
  const totalEntries = sumMovements(allMovements, "in");
  const totalOutputs = sumMovements(allMovements, "out");
  const reconstructedOpeningBalance =
    cash.physicalBalance - totalEntries + totalOutputs;
  const openingBalance =
    reconstructedOpeningBalance >= 0
      ? reconstructedOpeningBalance
      : fallbackOpeningBalance;
  const expectedCash = openingBalance + totalEntries - totalOutputs;
  const reservedMovements = cash.reservedOperations.map(reservedToCashMovement);
  const reservedTotal = reservedMovements.reduce(
    (sum, movement) => sum + movement.amount,
    0,
  );

  return {
    openingBalance,
    entries: summarizeCategories(allMovements, "in"),
    outputs: summarizeCategories(allMovements, "out"),
    allMovements,
    totalEntries,
    totalOutputs,
    expectedCash,
    reservedCash: {
      total: reservedTotal,
      movements: reservedMovements,
    },
    availableCash: expectedCash - reservedTotal,
    commissionProfit: buildCommissionProfitSummary(shiftOperations, banks),
  };
}

function isCurrentShiftOperation(operation: Operation): boolean {
  return operation.id.startsWith("operation-");
}

function operationToCashMovements(operation: Operation): CashMovement[] {
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
  const cashCommissionModes = ["cash", "deducted"];
  const isCashCommission = cashCommissionModes.includes(
    operation.withdrawalCommissionMode ?? "",
  );

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
            description:
              operation.withdrawalCommissionMode === "deducted"
                ? "Comisión descontada del retiro; quedó en caja"
                : "Comisión de retiro pagada en efectivo",
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

function reservedToCashMovement(operation: ReservedOperation): CashMovement {
  return {
    id: operation.id,
    folio: operation.folio,
    category: "delivered_withdrawal",
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

function sumMovements(
  movements: CashMovement[],
  direction: "in" | "out",
): number {
  return movements
    .filter((movement) => movement.direction === direction)
    .reduce((sum, movement) => sum + movement.amount, 0);
}
