import type {
  AdministrativeMovement,
  AdministrativeMovementFilters,
  AdministrativeMovementSummary,
  AdministrativeMovementType,
  AdministrativeResource,
} from "@/types/administrativeMovement";
import type { BankAccountBalance, CashBalance } from "@/types/balance";

export function pesosToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToPesos(value: number): number {
  return value / 100;
}

export function parseCurrencyToCents(value: string): number | null {
  const trimmedValue = value.trim();
  if (trimmedValue === "") return null;

  const normalizedValue = trimmedValue.replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) return null;

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue)) return null;

  return Math.round(numericValue * 100);
}

export function getAdministrativeResources(
  cash: CashBalance,
  banks: BankAccountBalance[],
): AdministrativeResource[] {
  const cashReservedCents = pesosToCents(
    cash.reservedOperations.reduce(
      (sum, operation) => sum + operation.amount,
      0,
    ),
  );
  const cashRealCents = pesosToCents(cash.physicalBalance);

  return [
    {
      id: "cash",
      name: "Caja física",
      type: "cash",
      realBalanceCents: cashRealCents,
      reservedCents: cashReservedCents,
      availableCents: cashRealCents - cashReservedCents,
    },
    ...banks
      .filter((bank) => !["unavailable", "inconsistent"].includes(bank.status))
      .map((bank) => {
        const reservedCents = pesosToCents(
          bank.reservedOperations.reduce(
            (sum, operation) => sum + operation.amount,
            0,
          ),
        );
        const realBalanceCents = pesosToCents(bank.realBalance);
        return {
          id: bank.id,
          name: bank.bankName,
          type: "bank" as const,
          realBalanceCents,
          reservedCents,
          availableCents: realBalanceCents - reservedCents,
        };
      }),
  ];
}

export function getAdministrativeMovementsSummary(
  movements: AdministrativeMovement[],
  now = new Date(),
): AdministrativeMovementSummary {
  const today = getDateKey(now.toISOString());
  const movementsToday = movements.filter(
    (movement) => getDateKey(movement.createdAt) === today,
  );
  const incomeTodayCents = sumByType(movementsToday, "income");
  const withdrawalTodayCents = sumByType(movementsToday, "withdrawal");

  return {
    incomeTodayCents,
    withdrawalTodayCents,
    netTodayCents: incomeTodayCents - withdrawalTodayCents,
    movementsToday: movementsToday.length,
  };
}

export function filterAdministrativeMovements(
  movements: AdministrativeMovement[],
  filters: AdministrativeMovementFilters,
): AdministrativeMovement[] {
  const search = filters.search.trim().toLowerCase();

  return movements.filter((movement) => {
    const matchesSearch =
      search === "" ||
      movement.explanation?.toLowerCase().includes(search) ||
      movement.resourceName.toLowerCase().includes(search) ||
      movement.createdByUserName.toLowerCase().includes(search);

    const matchesType =
      filters.movementType === "all" ||
      movement.movementType === filters.movementType;
    const matchesResource =
      filters.resourceId === "all" ||
      movement.resourceId === filters.resourceId;
    const matchesUser =
      filters.userName === "all" ||
      movement.createdByUserName === filters.userName;
    const matchesDate =
      filters.date === "" || getDateKey(movement.createdAt) === filters.date;

    return (
      matchesSearch &&
      matchesType &&
      matchesResource &&
      matchesUser &&
      matchesDate
    );
  });
}

export function validateAdministrativeWithdrawal({
  movementType,
  resource,
  amountCents,
}: {
  movementType: AdministrativeMovementType;
  resource: AdministrativeResource;
  amountCents: number;
}): string | null {
  if (amountCents <= 0) {
    return "El monto debe ser mayor que cero.";
  }

  if (movementType === "withdrawal" && amountCents > resource.availableCents) {
    return `No hay fondos disponibles suficientes en ${resource.name} para realizar este retiro.`;
  }

  return null;
}

export function applyAdministrativeMovement({
  cash,
  banks,
  movement,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  movement: AdministrativeMovement;
}): { cash: CashBalance; banks: BankAccountBalance[] } {
  const deltaPesos = centsToPesos(
    movement.movementType === "income"
      ? movement.amountCents
      : -movement.amountCents,
  );

  if (movement.resourceType === "cash") {
    return {
      cash: {
        ...cash,
        physicalBalance: cash.physicalBalance + deltaPesos,
        updatedAt: "Ahora",
      },
      banks,
    };
  }

  return {
    cash,
    banks: banks.map((bank) =>
      bank.id === movement.resourceId
        ? { ...bank, realBalance: bank.realBalance + deltaPesos }
        : bank,
    ),
  };
}
type MovementImpact = Pick<
  AdministrativeMovement,
  "resourceId" | "movementType" | "amountCents"
>;
export function calculateAdministrativeCorrectionImpact({
  original,
  corrected,
}: {
  original: MovementImpact;
  corrected: MovementImpact;
}): { resourceId: string; deltaCents: number }[] {
  const impact = (movement: MovementImpact) =>
    movement.movementType === "income"
      ? movement.amountCents
      : -movement.amountCents;
  const deltas = new Map<string, number>();
  deltas.set(original.resourceId, -impact(original));
  deltas.set(
    corrected.resourceId,
    (deltas.get(corrected.resourceId) ?? 0) + impact(corrected),
  );
  return Array.from(deltas, ([resourceId, deltaCents]) => ({
    resourceId,
    deltaCents,
  }));
}
export const ADMINISTRATIVE_CORRECTION_FUNDS_ERROR =
  "No se puede aplicar esta corrección porque dejaría fondos disponibles insuficientes.";
export function previewAdministrativeCorrection({
  resources,
  original,
  corrected,
}: {
  resources: AdministrativeResource[];
  original: MovementImpact;
  corrected: MovementImpact;
}) {
  return calculateAdministrativeCorrectionImpact({ original, corrected }).map(
    ({ resourceId, deltaCents }) => {
      const resource = resources.find((item) => item.id === resourceId);
      return {
        resourceId,
        resourceName: resource?.name ?? resourceId,
        deltaCents,
        realBalanceAfterCents: resource
          ? resource.realBalanceCents + deltaCents
          : NaN,
        availableAfterCents: resource
          ? resource.availableCents + deltaCents
          : NaN,
      };
    },
  );
}
export function applyAdministrativeCorrection({
  cash,
  banks,
  original,
  corrected,
}: {
  cash: CashBalance;
  banks: BankAccountBalance[];
  original: MovementImpact;
  corrected: MovementImpact;
}) {
  const preview = previewAdministrativeCorrection({
    resources: getAdministrativeResources(cash, banks),
    original,
    corrected,
  });
  if (
    !Number.isSafeInteger(corrected.amountCents) ||
    corrected.amountCents <= 0
  ) {
    return {
      cash,
      banks,
      preview,
      error:
        "El monto debe ser mayor que cero y expresarse en centavos válidos.",
    };
  }
  if (preview.some((item) => !Number.isFinite(item.availableAfterCents))) {
    return { cash, banks, preview, error: "Recurso no disponible." };
  }
  if (
    preview.some(
      (item) => item.realBalanceAfterCents < 0 || item.availableAfterCents < 0,
    )
  ) {
    return {
      cash,
      banks,
      preview,
      error: ADMINISTRATIVE_CORRECTION_FUNDS_ERROR,
    };
  }
  const cashImpact = preview.find((item) => item.resourceId === "cash");
  return {
    cash: cashImpact
      ? {
          ...cash,
          physicalBalance: centsToPesos(cashImpact.realBalanceAfterCents),
          updatedAt: "Ahora",
        }
      : cash,
    banks: banks.map((bank) => {
      const impact = preview.find((item) => item.resourceId === bank.id);
      return impact
        ? { ...bank, realBalance: centsToPesos(impact.realBalanceAfterCents) }
        : bank;
    }),
    preview,
    error: null,
  };
}

export function getMovementTypeLabel(type: AdministrativeMovementType): string {
  return type === "income" ? "Ingreso" : "Retiro";
}

function sumByType(
  movements: AdministrativeMovement[],
  type: AdministrativeMovementType,
): number {
  return movements
    .filter((movement) => movement.movementType === type)
    .reduce((sum, movement) => sum + movement.amountCents, 0);
}

function getDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
