"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  buildInitialZeroBanks,
  buildInitialZeroCash,
} from "@/components/balances/balanceMockData";
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
import type { AppliedCommissionSnapshot } from "@/types/commission";
import type { Operation } from "@/types/operation";
import type { WithdrawalCommissionMode } from "@/types/withdrawal";
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
  resetVersion: number;
  resources: ReturnType<typeof getAdministrativeResources>;
  registerClientOperation: (operation: Operation) => {
    success: boolean;
    operation?: Operation;
    error?: string;
  };
  deliverPendingWithdrawal: (input: {
    operationId: string;
    receiverName: string;
    deliveredBy: string;
    commissionMode?: WithdrawalCommissionMode;
    commissionAmount?: number;
    customerCashReceived?: number;
    bankMovementAmount?: number;
    appliedCommissionSnapshot?: AppliedCommissionSnapshot;
  }) => {
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
  resetFinancialState: () => void;
};

const BusinessFundsContext = createContext<BusinessFundsContextValue | null>(
  null,
);

export function BusinessFundsProvider({ children }: { children: ReactNode }) {
  const [cash, setCash] = useState<CashBalance>(() => buildInitialZeroCash());
  const [banks, setBanks] = useState<BankAccountBalance[]>(() =>
    buildInitialZeroBanks(),
  );
  const [movements, setMovements] = useState<AdministrativeMovement[]>(
    initialAdministrativeMovements,
  );
  const [operations, setOperations] = useState<Operation[]>([]);
  const [resetVersion, setResetVersion] = useState(0);

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

  function deliverPendingWithdrawal(input: {
    operationId: string;
    receiverName: string;
    deliveredBy: string;
    commissionMode?: WithdrawalCommissionMode;
    commissionAmount?: number;
    customerCashReceived?: number;
    bankMovementAmount?: number;
    appliedCommissionSnapshot?: AppliedCommissionSnapshot;
  }): { success: boolean; operation?: Operation; error?: string } {
    const receiverName = input.receiverName.trim();
    if (!receiverName) {
      return {
        success: false,
        error: "Captura el nombre de quien recibe.",
      };
    }

    const original = operations.find(
      (operation) =>
        operation.id === input.operationId &&
        operation.type === "retiro" &&
        operation.status === "pendiente",
    );
    if (!original) {
      return { success: false, error: "Retiro pendiente no encontrado." };
    }

    if (
      !input.commissionMode ||
      input.commissionAmount === undefined ||
      input.customerCashReceived === undefined ||
      input.bankMovementAmount === undefined ||
      !input.appliedCommissionSnapshot
    ) {
      return {
        success: false,
        error: "Selecciona cómo se cobrará la comisión.",
      };
    }

    const amountToDeliver = input.customerCashReceived;
    const cashCommission =
      input.commissionMode === "cash" ? input.commissionAmount : 0;
    const bankCommission =
      input.commissionMode === "deposited" ? input.commissionAmount : 0;

    if (cash.physicalBalance - amountToDeliver < 0) {
      return {
        success: false,
        error: "No hay efectivo físico suficiente para confirmar la entrega.",
      };
    }

    if (
      bankCommission > 0 &&
      !banks.some((bank) => bank.id === original.bankResourceId)
    ) {
      return { success: false, error: "Banco receptor no disponible." };
    }

    const deliveredOperation: Operation = {
      ...original,
      status: "entregado",
      receiverName,
      commission: input.commissionAmount,
      total: input.bankMovementAmount,
      appliedCommissionSnapshot: input.appliedCommissionSnapshot,
      commissionLocation:
        input.commissionMode === "deposited" ? "bank" : "cash",
      commissionStatus: "realized",
      withdrawalCommissionMode: input.commissionMode,
      customerCashReceived: amountToDeliver,
      bankMovementAmount: input.bankMovementAmount,
      editedAt: new Date().toISOString(),
      editedBy: input.deliveredBy,
    };

    setCash((currentCash) => ({
      ...currentCash,
      physicalBalance:
        currentCash.physicalBalance - amountToDeliver + cashCommission,
      reservedOperations: currentCash.reservedOperations.filter(
        (operation) => operation.id !== original.id,
      ),
      updatedAt: new Date().toISOString(),
    }));
    if (bankCommission > 0) {
      setBanks((currentBanks) =>
        currentBanks.map((bank) =>
          bank.id === original.bankResourceId
            ? { ...bank, realBalance: bank.realBalance + bankCommission }
            : bank,
        ),
      );
    }
    setOperations((currentOperations) =>
      currentOperations.map((operation) =>
        operation.id === original.id ? deliveredOperation : operation,
      ),
    );

    return { success: true, operation: deliveredOperation };
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

  function resetFinancialState() {
    setCash(buildInitialZeroCash());
    setBanks(buildInitialZeroBanks());
    setMovements([]);
    setOperations([]);
    setResetVersion((current) => current + 1);
  }

  return (
    <BusinessFundsContext.Provider
      value={{
        cash,
        banks,
        operations,
        movements,
        resetVersion,
        resources,
        registerClientOperation,
        deliverPendingWithdrawal,
        registerMovement,
        correctMovement,
        resetFinancialState,
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
