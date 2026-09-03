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
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { getBankLabel } from "@/config/banks";
import {
  applyAdministrativeMovement,
  calculateAdministrativeCorrectionImpact,
  getAdministrativeResources,
  validateAdministrativeWithdrawal,
} from "@/lib/administrativeMovements";
import {
  calculateCommission,
  centsToPesos,
  NO_COMMISSION_RULE_MESSAGE,
  pesosToCents,
} from "@/lib/commission";
import {
  applyOperationFinancialDelta,
  applyOperationFinancialImpact,
  getOperationCorrectionSnapshot,
  normalizeWithdrawalBankReference,
  validateOperationFinancialImpact,
} from "@/lib/finance";
import type {
  AdministrativeMovement,
  AdministrativeMovementType,
} from "@/types/administrativeMovement";
import type { BankAccountBalance, CashBalance } from "@/types/balance";
import type {
  AppliedCommissionSnapshot,
  CommissionLocation,
  CommissionOperationType,
} from "@/types/commission";
import type { Operation, OperationCorrection } from "@/types/operation";
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

type AddOperationClarificationInput = {
  operationId: string;
  reason: string;
  note: string;
  reference?: string;
  createdBy: string;
};

type CorrectClientOperationInput = {
  operationId: string;
  amount?: number;
  bankResourceId?: string;
  bankFolio?: string;
  destinationAccountLast4?: string;
  receiverName?: string;
  reason: string;
  reasonDetails?: string;
  correctedBy: string;
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
  addOperationClarification: (input: AddOperationClarificationInput) => {
    success: boolean;
    operation?: Operation;
    error?: string;
  };
  correctClientOperation: (input: CorrectClientOperationInput) => {
    success: boolean;
    operation?: Operation;
    correction?: OperationCorrection;
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
  const { rules: commissionRules } = useCommissionRules();
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

  function addOperationClarification(input: AddOperationClarificationInput): {
    success: boolean;
    operation?: Operation;
    error?: string;
  } {
    const reason = input.reason.trim();
    const note = input.note.trim();
    const reference = input.reference?.trim();
    const createdBy = input.createdBy.trim() || "Usuario no disponible";

    if (!reason) {
      return {
        success: false,
        error: "Selecciona el motivo de la aclaración.",
      };
    }

    if (!note) {
      return { success: false, error: "Captura la nota de aclaración." };
    }

    const original = operations.find(
      (operation) => operation.id === input.operationId,
    );
    if (!original) {
      return { success: false, error: "Operación no encontrada." };
    }

    const clarification = {
      id: `op-clarification-${Date.now()}-${crypto.randomUUID()}`,
      reason,
      note,
      reference: reference || undefined,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    const clarifiedOperation: Operation = {
      ...original,
      clarifications: [clarification, ...(original.clarifications ?? [])],
    };

    setOperations((currentOperations) =>
      currentOperations.map((operation) =>
        operation.id === original.id ? clarifiedOperation : operation,
      ),
    );

    return { success: true, operation: clarifiedOperation };
  }

  function calculateOperationCommission({
    amount,
    operationType,
    effectiveAt,
    appliedAt,
    location,
  }: {
    amount: number;
    operationType: CommissionOperationType;
    effectiveAt: string;
    appliedAt: string;
    location: CommissionLocation;
  }): { commission: number; snapshot: AppliedCommissionSnapshot } | null {
    const calculation = calculateCommission({
      amountCents: pesosToCents(amount),
      operationType,
      rules: commissionRules,
      effectiveAt,
    });
    if (!calculation) return null;

    const commission = centsToPesos(calculation.commissionAmountCents);

    return {
      commission,
      snapshot: {
        operationAmountCents: calculation.operationAmountCents,
        calculatedCommissionCents: calculation.commissionAmountCents,
        finalCommissionCents: calculation.commissionAmountCents,
        ruleId: calculation.ruleId,
        ruleVersion: calculation.ruleVersion,
        calculationType: calculation.calculationType,
        location,
        appliedAt,
      },
    };
  }

  function correctClientOperation(input: CorrectClientOperationInput): {
    success: boolean;
    operation?: Operation;
    correction?: OperationCorrection;
    error?: string;
  } {
    const original = operations.find(
      (operation) => operation.id === input.operationId,
    );
    if (!original) {
      return { success: false, error: "Operación no encontrada." };
    }

    const reason = getCorrectionReason(input.reason, input.reasonDetails);
    if (!reason) {
      return { success: false, error: "Selecciona el motivo de corrección." };
    }

    const correctedBy = input.correctedBy.trim() || "Usuario no disponible";
    const now = new Date().toISOString();
    const amount =
      input.amount === undefined ? original.amount : roundMoney(input.amount);
    if (amount <= 0) {
      return { success: false, error: "Captura un monto válido." };
    }

    let corrected: Operation = {
      ...original,
      amount,
    };

    if (original.type === "deposito") {
      if (original.status !== "completado") {
        return {
          success: false,
          error: "Solo se pueden corregir depósitos completados.",
        };
      }

      const bankResourceId =
        input.bankResourceId?.trim() || original.bankResourceId;
      const destinationAccountLast4 =
        input.destinationAccountLast4?.trim() ??
        original.destinationAccountLast4 ??
        "";
      const receiverName =
        input.receiverName === undefined
          ? original.receiverName
          : input.receiverName.trim();

      if (!bankResourceId) {
        return { success: false, error: "Selecciona el banco de emisión." };
      }
      if (!/^\d{4}$/.test(destinationAccountLast4)) {
        return {
          success: false,
          error: "Captura exactamente los últimos 4 dígitos.",
        };
      }

      const commissionResult = calculateOperationCommission({
        amount,
        operationType: "deposito",
        effectiveAt: original.createdAt,
        appliedAt: original.appliedCommissionSnapshot?.appliedAt ?? now,
        location: "cash",
      });
      if (!commissionResult) {
        return { success: false, error: NO_COMMISSION_RULE_MESSAGE };
      }

      corrected = {
        ...corrected,
        bankResourceId,
        bankFrom: "Caja fisica",
        bankTo: getBankLabel(bankResourceId),
        destinationAccountLast4,
        destinationReference: `**** ${destinationAccountLast4}`,
        receiverName,
        commission: commissionResult.commission,
        total: amount + commissionResult.commission,
        appliedCommissionSnapshot: commissionResult.snapshot,
        commissionLocation: "cash",
        commissionStatus: "realized",
      };
    } else {
      if (original.status !== "entregado" && original.status !== "pendiente") {
        return {
          success: false,
          error: "Solo se pueden corregir retiros entregados o pendientes.",
        };
      }

      const bankResourceId =
        input.bankResourceId?.trim() || original.bankResourceId;
      const bankFolio = normalizeWithdrawalBankReference(
        input.bankFolio ?? original.bankFolio,
      );
      if (!bankFolio) {
        return {
          success: false,
          error: "Captura el folio o referencia bancaria.",
        };
      }
      if (!bankResourceId) {
        return { success: false, error: "Selecciona el banco receptor." };
      }

      const duplicatedReference = operations.some(
        (operation) =>
          operation.id !== original.id &&
          operation.type === "retiro" &&
          operation.bankResourceId === bankResourceId &&
          normalizeWithdrawalBankReference(operation.bankFolio) === bankFolio,
      );
      if (duplicatedReference) {
        return {
          success: false,
          error:
            "Ya existe otro retiro con esta referencia en el banco seleccionado.",
        };
      }

      corrected = {
        ...corrected,
        bankFolio,
        bankResourceId,
        bankFrom: getBankLabel(bankResourceId),
        bankTo: "Caja fisica",
      };

      if (original.status === "pendiente") {
        corrected = {
          ...corrected,
          commission: 0,
          total: amount,
          appliedCommissionSnapshot: undefined,
          commissionLocation: "pending",
          commissionStatus: "pending",
          withdrawalCommissionMode: undefined,
          customerCashReceived: amount,
          bankMovementAmount: amount,
        };
      } else {
        const commissionMode = original.withdrawalCommissionMode;
        if (!commissionMode) {
          return {
            success: false,
            error: "La forma de comisión original no está disponible.",
          };
        }

        const receiverName =
          input.receiverName === undefined
            ? original.receiverName
            : input.receiverName.trim();
        if (!receiverName) {
          return {
            success: false,
            error: "Captura el nombre de quien recibe.",
          };
        }

        const commissionResult = calculateOperationCommission({
          amount,
          operationType: "retiro",
          effectiveAt: original.createdAt,
          appliedAt: original.appliedCommissionSnapshot?.appliedAt ?? now,
          location: commissionMode === "deposited" ? "bank" : "cash",
        });
        if (!commissionResult) {
          return { success: false, error: NO_COMMISSION_RULE_MESSAGE };
        }

        const total =
          commissionMode === "deposited"
            ? amount + commissionResult.commission
            : amount;
        const customerCashReceived =
          commissionMode === "deducted"
            ? Math.max(0, amount - commissionResult.commission)
            : amount;

        corrected = {
          ...corrected,
          receiverName,
          commission: commissionResult.commission,
          total,
          appliedCommissionSnapshot: commissionResult.snapshot,
          commissionLocation: commissionMode === "deposited" ? "bank" : "cash",
          commissionStatus: "realized",
          withdrawalCommissionMode: commissionMode,
          customerCashReceived,
          bankMovementAmount: total,
        };
      }
    }

    if (!hasOperationCorrectionChanges(original, corrected)) {
      return {
        success: false,
        error: "No realizaste ningún cambio en la operación.",
      };
    }

    const nextBalances = applyOperationFinancialDelta({
      cash,
      banks,
      original,
      corrected,
    });
    if (nextBalances.error) {
      return { success: false, error: nextBalances.error };
    }

    const correction: OperationCorrection = {
      id: `op-correction-${Date.now()}-${crypto.randomUUID()}`,
      reason,
      createdAt: now,
      createdBy: correctedBy,
      before: getOperationCorrectionSnapshot(original),
      after: getOperationCorrectionSnapshot(corrected),
    };

    const correctedOperation: Operation = {
      ...corrected,
      isEdited: true,
      editedAt: now,
      editedBy: correctedBy,
      corrections: [correction, ...(original.corrections ?? [])],
    };

    setCash(nextBalances.cash);
    setBanks(nextBalances.banks);
    setOperations((currentOperations) =>
      currentOperations.map((operation) =>
        operation.id === original.id ? correctedOperation : operation,
      ),
    );

    return {
      success: true,
      operation: correctedOperation,
      correction,
    };
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
        addOperationClarification,
        correctClientOperation,
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCorrectionReason(reason: string, reasonDetails?: string): string {
  const trimmedReason = reason.trim();
  const trimmedDetails = reasonDetails?.trim();

  if (!trimmedReason) return "";
  if (trimmedReason === "Otro") return trimmedDetails ?? "";

  return trimmedDetails ? `${trimmedReason}: ${trimmedDetails}` : trimmedReason;
}

function hasOperationCorrectionChanges(
  original: Operation,
  corrected: Operation,
): boolean {
  const originalSnapshot = getOperationCorrectionSnapshot(original);
  const correctedSnapshot = getOperationCorrectionSnapshot(corrected);

  return JSON.stringify(originalSnapshot) !== JSON.stringify(correctedSnapshot);
}
