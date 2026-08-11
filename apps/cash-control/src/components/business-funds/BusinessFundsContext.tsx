"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  bankAccounts,
  cashBalance,
} from "@/components/balances/balanceMockData";
import { mockOperations } from "@/components/history/mockOperations";
import {
  applyAdministrativeMovement,
  calculateAdministrativeCorrectionImpact,
  getAdministrativeResources,
  validateAdministrativeWithdrawal,
} from "@/lib/administrativeMovements";
import {
  applyOperationFinancialImpact,
  validateOperationFinancialImpact,
} from "@/lib/finance";
import type {
  AdministrativeMovement,
  AdministrativeMovementType,
} from "@/types/administrativeMovement";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type { Operation } from "@/types/operation";
import { initialAdministrativeMovements } from "./businessFundsMockData";

type RegisterAdministrativeMovementInput = {
  movementType: AdministrativeMovementType;
  resourceId: string;
  amountCents: number;
  explanation?: string;
  createdByUserId: string;
  createdByUserName: string;
  shiftId?: string;
};

type CorrectAdministrativeMovementInput = {
  movementId: string;
  movementType: AdministrativeMovementType;
  resourceId: string;
  amountCents: number;
  explanation?: string;
  editReason: string;
  editedByUserId: string;
  editedByUserName: string;
};

type BusinessFundsContextValue = {
  cash: CashBalance;
  banks: BankAccountBalance[];
  operations: Operation[];
  movements: AdministrativeMovement[];
  resources: ReturnType<typeof getAdministrativeResources>;
  registerClientOperation: (operation: Operation) => {
    success: boolean;
    operation?: Operation;
    error?: string;
  };
  registerMovement: (input: RegisterAdministrativeMovementInput) => {
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  };
  correctMovement: (input: CorrectAdministrativeMovementInput) => {
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  };
};

const BusinessFundsContext = createContext<BusinessFundsContextValue | null>(
  null,
);

export function BusinessFundsProvider({ children }: { children: ReactNode }) {
  const [cash, setCash] = useState<CashBalance>(cashBalance);
  const [banks, setBanks] = useState<BankAccountBalance[]>(bankAccounts);
  const [movements, setMovements] = useState<AdministrativeMovement[]>(
    initialAdministrativeMovements,
  );
  const [operations, setOperations] = useState<Operation[]>(mockOperations);

  const resources = useMemo(
    () => getAdministrativeResources(cash, banks),
    [cash, banks],
  );

  function registerMovement(input: RegisterAdministrativeMovementInput): {
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  } {
    const resource = resources.find((item) => item.id === input.resourceId);
    if (!resource) return { success: false, error: "Recurso no disponible." };

    const validation = validateAdministrativeWithdrawal({
      movementType: input.movementType,
      resource,
      amountCents: input.amountCents,
    });
    if (validation) return { success: false, error: validation };

    const balanceAfterCents =
      resource.realBalanceCents +
      (input.movementType === "income"
        ? input.amountCents
        : -input.amountCents);

    const movement: AdministrativeMovement = {
      id: `adm-mov-${Date.now()}`,
      movementType: input.movementType,
      resourceType: resource.type,
      resourceId: resource.id,
      resourceName: resource.name,
      amountCents: input.amountCents,
      balanceBeforeCents: resource.realBalanceCents,
      balanceAfterCents,
      explanation: input.explanation?.trim() || undefined,
      createdByUserId: input.createdByUserId,
      createdByUserName: input.createdByUserName,
      createdAt: new Date().toISOString(),
      shiftId: input.shiftId,
      status: "active",
      isEdited: false,
    };

    const nextBalances = applyAdministrativeMovement({ cash, banks, movement });
    setCash(nextBalances.cash);
    setBanks(nextBalances.banks);
    setMovements((current) => [movement, ...current]);
    return { success: true, movement };
  }

  function registerClientOperation(operation: Operation): {
    success: boolean;
    operation?: Operation;
    error?: string;
  } {
    const validation = validateOperationFinancialImpact({
      cash,
      banks,
      operation,
    });
    if (validation) return { success: false, error: validation };

    const nextBalances = applyOperationFinancialImpact({
      cash,
      banks,
      operation,
    });

    setCash(nextBalances.cash);
    setBanks(nextBalances.banks);
    setOperations((current) => [operation, ...current]);

    return { success: true, operation };
  }

  function correctMovement(input: CorrectAdministrativeMovementInput): {
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  } {
    if (!input.editReason.trim()) {
      return {
        success: false,
        error: "El motivo de corrección es obligatorio.",
      };
    }

    const original = movements.find(
      (movement) => movement.id === input.movementId,
    );
    if (!original)
      return { success: false, error: "Movimiento no encontrado." };

    const resource = resources.find((item) => item.id === input.resourceId);
    if (!resource) return { success: false, error: "Recurso no disponible." };

    const corrected: AdministrativeMovement = {
      ...original,
      movementType: input.movementType,
      resourceType: resource.type,
      resourceId: resource.id,
      resourceName: resource.name,
      amountCents: input.amountCents,
      explanation: input.explanation?.trim() || undefined,
      status: "corrected",
      isEdited: true,
      editedAt: new Date().toISOString(),
      editedByUserId: input.editedByUserId,
      editedByUserName: input.editedByUserName,
      editReason: input.editReason.trim(),
      previousAmountCents: original.amountCents,
      previousResourceId: original.resourceId,
      previousResourceName: original.resourceName,
      previousMovementType: original.movementType,
    };

    const impacts = calculateAdministrativeCorrectionImpact({
      original,
      corrected,
    });

    let nextCash = cash;
    let nextBanks = banks;
    for (const impact of impacts) {
      const impactResource = getAdministrativeResources(
        nextCash,
        nextBanks,
      ).find((item) => item.id === impact.resourceId);
      if (!impactResource) {
        return { success: false, error: "Recurso no disponible." };
      }
      const validation = validateAdministrativeWithdrawal({
        movementType: impact.movementType,
        resource: impactResource,
        amountCents: impact.amountCents,
      });
      if (validation) return { success: false, error: validation };

      const nextBalances = applyAdministrativeMovement({
        cash: nextCash,
        banks: nextBanks,
        movement: impact,
      });
      nextCash = nextBalances.cash;
      nextBanks = nextBalances.banks;
    }

    setCash(nextCash);
    setBanks(nextBanks);
    setMovements((current) =>
      current.map((movement) =>
        movement.id === original.id ? corrected : movement,
      ),
    );
    return { success: true, movement: corrected };
  }

  return (
    <BusinessFundsContext.Provider
      value={{
        cash,
        banks,
        operations,
        movements,
        resources,
        registerClientOperation,
        registerMovement,
        correctMovement,
      }}
    >
      {children}
    </BusinessFundsContext.Provider>
  );
}

export function useBusinessFunds(): BusinessFundsContextValue {
  const context = useContext(BusinessFundsContext);
  if (!context) {
    throw new Error(
      "useBusinessFunds must be used within BusinessFundsProvider",
    );
  }
  return context;
}
