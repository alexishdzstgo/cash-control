"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildInitialZeroBanks,
  buildInitialZeroCash,
} from "@/components/balances/balanceMockData";
import { useCommissionRules } from "@/components/commissions/CommissionRulesContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { useShift } from "@/components/shifts/ShiftContext";
import { getBankLabel } from "@/config/banks";
import {
  applyAdministrativeCorrection,
  applyAdministrativeMovement,
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
  type CorrectionActor,
  canCorrectRecord,
} from "@/lib/correctionPermissions";
import {
  applyOperationFinancialDelta,
  applyOperationFinancialImpact,
  getOperationCorrectionSnapshot,
  normalizeWithdrawalBankReference,
  validateOperationFinancialImpact,
} from "@/lib/finance";
import {
  type ShiftReconciliationInput,
  validateShiftReconciliation,
} from "@/lib/shiftReconciliation";
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
};
type CorrectAdministrativeMovementInput = CorrectionActor & {
  movementId: string;
  movementType: AdministrativeMovementType;
  resourceId: string;
  amountCents: number;
  explanation?: string;
  editReason: string;
};

type AddOperationClarificationInput = {
  operationId: string;
  reason: string;
  note: string;
  reference?: string;
  createdBy: string;
};
type CorrectClientOperationInput = CorrectionActor & {
  operationId: string;
  amount?: number;
  bankResourceId?: string;
  bankFolio?: string;
  destinationAccountLast4?: string;
  receiverName?: string;
  reason: string;
  reasonDetails?: string;
};

type BusinessFundsContextValue = {
  cash: CashBalance;
  banks: BankAccountBalance[];
  operations: Operation[];
  movements: AdministrativeMovement[];
  resetVersion: number;
  resources: ReturnType<typeof getAdministrativeResources>;
  registerClientOperation: (operation: Operation) => Promise<{
    success: boolean;
    operation?: Operation;
    error?: string;
  }>;
  canDeliverPendingWithdrawal: () => boolean;
  deliverPendingWithdrawal: (input: {
    operationId: string;
    receiverName: string;
    commissionMode?: WithdrawalCommissionMode;
    commissionAmount?: number;
    customerCashReceived?: number;
    bankMovementAmount?: number;
    appliedCommissionSnapshot?: AppliedCommissionSnapshot;
  }) => Promise<{
    success: boolean;
    operation?: Operation;
    error?: string;
  }>;
  addOperationClarification: (input: AddOperationClarificationInput) => Promise<{
    success: boolean;
    operation?: Operation;
    error?: string;
  }>;
  correctClientOperation: (input: CorrectClientOperationInput) => Promise<{
    success: boolean;
    operation?: Operation;
    correction?: OperationCorrection;
    error?: string;
  }>;
  registerMovement: (input: RegisterAdministrativeMovementInput) => Promise<{
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  }>;
  correctMovement: (input: CorrectAdministrativeMovementInput) => Promise<{
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  }>;
  resetFinancialState: () => void;
  validateReconciliation: (input: ShiftReconciliationInput) => string | null;
  refreshFinancialData: () => Promise<void>;

  reconcileAfterShiftClosing: (input: ShiftReconciliationInput) => {
    success: boolean;
    error?: string;
  };
};

const BusinessFundsContext = createContext<BusinessFundsContextValue | null>(
  null,
);

export function BusinessFundsProvider({ children }: { children: ReactNode }) {
  const { getCurrentShift, resetShifts } = useShift();
  const { authenticatedUser, participants } = useMockSession();

  const { rules: commissionRules } = useCommissionRules();
  const [cash, setCash] = useState<CashBalance>(() => buildInitialZeroCash());
  const [banks, setBanks] = useState<BankAccountBalance[]>([]);
  const [movements, setMovements] = useState<AdministrativeMovement[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [resetVersion, setResetVersion] = useState(0);

  const latestBanks = useRef(banks);

  latestBanks.current = banks;
  const deliverySession = useRef({ authenticatedUser, participants });
  deliverySession.current = { authenticatedUser, participants };

  async function refreshFinancialData() {
    try {
      const [banksRes, movesRes, opsRes, cashRes] = await Promise.all([
        fetch(`/api/banks?t=${Date.now()}`),
        fetch(`/api/movements?t=${Date.now()}`),
        fetch(`/api/operations?t=${Date.now()}`),
        fetch(`/api/cash-boxes?t=${Date.now()}`)
      ]);

      if (banksRes.ok) {
        const data = await banksRes.json();
        if (data.ok && data.accounts) {
          setBanks((currentBanks) => {
            return data.accounts.map((acc: any) => {
              const existingIdx = currentBanks.findIndex((b) => b.id === acc.id);
              const reservedOps = existingIdx >= 0 ? currentBanks[existingIdx].reservedOperations : [];
              return {
                id: acc.id,
                bankName: acc.accountName,
                accountName: `**** ${acc.accountLastDigits || "0000"}`,
                rawAccountName: acc.accountName || "",
                rawAccountLastDigits: acc.accountLastDigits || "",
                realBalance: acc.realBalance || 0,
                reservedOperations: reservedOps,
                status: acc.status === "active" ? "available" : "unavailable",
              };
            });
          });
        }
      }

      if (movesRes.ok) {
        const movesData = await movesRes.json();
        if (movesData.ok) {
          setMovements(movesData.movements);
        }
      }

      if (opsRes.ok) {
        const opsData = await opsRes.json();
        if (opsData.ok) {
          setOperations(opsData.operations);
        }
      }

      if (cashRes.ok) {
        const cashData = await cashRes.json();
        if (cashData.ok && cashData.cashBoxes && cashData.cashBoxes.length > 0) {
          const box = cashData.cashBoxes[0];
          setCash((current) => ({
            ...current,
            id: box.id,
            name: box.name,
            physicalBalance: box.realBalance,
            lowBalanceThreshold: box.lowBalanceThreshold,
            criticalBalanceThreshold: box.criticalBalanceThreshold
          }));
        }
      }
    } catch (e) {
      console.error("Failed to refresh financial data", e);
    }
  }


  useEffect(() => {
    refreshFinancialData();
  }, []);

  const resources = useMemo(
    () => getAdministrativeResources(cash, banks),
    [cash, banks],
  );

  async function registerMovement(input: RegisterAdministrativeMovementInput): Promise<{
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  }> {
    const currentShift = getCurrentShift();
    if (!currentShift)
      return { success: false, error: "No hay un turno abierto." };
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

    const payload = {
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
      shiftId: currentShift.id,
      status: "active",
      isEdited: false,
    };

    try {
      const resp = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        return { success: false, error: data.error || "Falla en conexión." };
      }

      const movement = data.movement as AdministrativeMovement;
      await refreshFinancialData();
      return { success: true, movement };
    } catch (err) {
      return { success: false, error: "Falla de conectividad de red." };
    }
  }

  async function registerClientOperation(input: Operation): Promise<{
    success: boolean;
    operation?: Operation;
    error?: string;
  }> {
    const currentShift = getCurrentShift();
    if (!currentShift)
      return { success: false, error: "No hay un turno abierto." };
    const operationInput: Operation = { ...input, shiftId: currentShift.id, id: "" };

    // We pass operationInput without ID just to calculate validity
    const validation = validateOperationFinancialImpact({
      cash,
      banks,
      operation: operationInput,
    });
    if (validation) return { success: false, error: validation };

    try {
      const resp = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operationInput),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) return { success: false, error: data.error };

      const operation = data.operation as Operation;
      await refreshFinancialData();
      setOperations((current) => [operation, ...current]);

      return { success: true, operation };
    } catch (err) {
      return { success: false, error: "Falla de red en backend." };
    }
  }

  function canDeliverPendingWithdrawal() {
    const { authenticatedUser: actor, participants } = deliverySession.current;
    return Boolean(
      getCurrentShift()?.status === "open" &&
      actor &&
      participants.some(
        (participant) =>
          participant.userId === actor.userId &&
          participant.status === "active",
      ),
    );
  }

  async function deliverPendingWithdrawal(input: {
    operationId: string;
    receiverName: string;
    commissionMode?: WithdrawalCommissionMode;
    commissionAmount?: number;
    customerCashReceived?: number;
    bankMovementAmount?: number;
    appliedCommissionSnapshot?: AppliedCommissionSnapshot;
  }): Promise<{ success: boolean; operation?: Operation; error?: string }> {
    const currentShift = getCurrentShift();
    if (!currentShift)
      return { success: false, error: "No hay un turno abierto." };
    const actor = deliverySession.current.authenticatedUser;
    if (!canDeliverPendingWithdrawal() || !actor)
      return {
        success: false,
        error: "No tienes una participación activa para entregar este retiro.",
      };
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

    const payload = {
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
      editedBy: actor.userName,
      pendingDelivery: {
        deliveredAt: new Date().toISOString(),
        deliveredBy: actor.userName,
        deliveredByUserId: actor.userId,
        shiftId: currentShift.id,
      },
    };

    try {
      const resp = await fetch(`/api/operations/${original.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        return { success: false, error: data.error };
      }

      const deliveredOperation = data.operation as Operation;
      await refreshFinancialData();
      setOperations((currentOperations) =>
        currentOperations.map((operation) =>
          operation.id === original.id ? deliveredOperation : operation,
        ),
      );

      return { success: true, operation: deliveredOperation };
    } catch (e) {
      return { success: false, error: "Error de conexión." };
    }
  }

  async function addOperationClarification(input: AddOperationClarificationInput): Promise<{
    success: boolean;
    operation?: Operation;
    error?: string;
  }> {
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
      shiftId: getCurrentShift()?.id,
      reason,
      note,
      reference: reference || undefined,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    const payload = {
      clarifications: [clarification, ...(original.clarifications ?? [])],
    };

    try {
      const resp = await fetch(`/api/operations/${original.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) return { success: false, error: data.error };

      const clarifiedOperation = data.operation as Operation;
      setOperations((currentOperations) =>
        currentOperations.map((operation) =>
          operation.id === original.id ? clarifiedOperation : operation,
        ),
      );

      return { success: true, operation: clarifiedOperation };
    } catch (e) {
      return { success: false, error: "Error de red al registrar aclaración." };
    }
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

  async function correctClientOperation(input: CorrectClientOperationInput): Promise<{
    success: boolean;
    operation?: Operation;
    correction?: OperationCorrection;
    error?: string;
  }> {
    const original = operations.find(
      (operation) => operation.id === input.operationId,
    );
    if (!original) {
      return { success: false, error: "Operación no encontrada." };
    }
    const activeShift = getCurrentShift();

    if (!activeShift || original.shiftId !== activeShift.id) {
      return {
        success: false,
        error:
          "Esta operación pertenece a un turno cerrado y ya no puede corregirse.",
      };
    }

    if (!canCorrectRecord(original, input)) {
      return {
        success: false,
        error: "No tienes permiso para corregir esta operación.",
      };
    }

    const reason = getCorrectionReason(input.reason, input.reasonDetails);
    if (!reason) {
      return { success: false, error: "Selecciona el motivo de corrección." };
    }
    const correctedBy = input.actorUserName.trim() || "Usuario no disponible";
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
        bankTo: getBankLabel(latestBanks.current, bankResourceId),
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
        bankFrom: getBankLabel(latestBanks.current, bankResourceId),
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
      shiftId: getCurrentShift()?.id,
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

    try {
      const resp = await fetch(`/api/operations/${original.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correctedOperation),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) return { success: false, error: data.error };

      const validatedOperation = data.operation as Operation;
      setCash(nextBalances.cash);
      setBanks(nextBalances.banks);
      setOperations((currentOperations) =>
        currentOperations.map((operation) =>
          operation.id === original.id ? validatedOperation : operation,
        ),
      );

      return {
        success: true,
        operation: validatedOperation,
        correction,
      };
    } catch (e) {
      return { success: false, error: "Error de red al registrar corrección." };
    }
  }

  async function correctMovement(input: CorrectAdministrativeMovementInput): Promise<{
    success: boolean;
    movement?: AdministrativeMovement;
    error?: string;
  }> {
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
    const activeShift = getCurrentShift();

    if (!activeShift || original.shiftId !== activeShift.id) {
      return {
        success: false,
        error:
          "Este movimiento pertenece a un turno cerrado y ya no puede corregirse.",
      };
    }

    if (!canCorrectRecord(original, input)) {
      return {
        success: false,
        error: "No tienes permiso para corregir este movimiento.",
      };
    }
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
      editedByUserId: input.actorUserId,
      editedByUserName: input.actorUserName,
      editReason: input.editReason.trim(),
      registeredResourceName:
        original.registeredResourceName ?? original.resourceName,
      previousAmountCents: original.amountCents,
      previousResourceId: original.resourceId,
      previousResourceName: original.resourceName,
      previousMovementType: original.movementType,
    };
    const nextBalances = applyAdministrativeCorrection({
      cash,
      banks,
      original,
      corrected,
    });
    if (nextBalances.error)
      return { success: false, error: nextBalances.error };
    corrected.correctionBalances = nextBalances.preview;
    try {
      const resp = await fetch(`/api/movements/${original.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corrected),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) return { success: false, error: data.error };

      const validatedMovement = data.movement as AdministrativeMovement;
      await refreshFinancialData();
      setMovements((current) =>
        current.map((movement) =>
          movement.id === original.id ? validatedMovement : movement,
        ),
      );
      return { success: true, movement: validatedMovement };
    } catch (e) {
      return { success: false, error: "Error de conexión al corregir." };
    }
  }

  function validateReconciliation(input: ShiftReconciliationInput) {
    return validateShiftReconciliation(input, latestBanks.current);
  }

  function reconcileAfterShiftClosing(input: ShiftReconciliationInput) {
    const error = validateReconciliation(input);

    if (error) return { success: false, error };

    const counted = new Map(
      input.banks.map((bank) => [bank.bankId, bank.countedBalance]),
    );

    // Counts update actual balances only; every outstanding obligation survives.

    setCash((current) => ({
      ...current,
      physicalBalance: input.countedCashPhysical,
      updatedAt: new Date().toISOString(),
    }));

    setBanks((current) =>
      current.map((bank) => ({
        ...bank,
        realBalance: counted.get(bank.id) ?? bank.realBalance,
      })),
    );

    return { success: true };
  }

  function resetFinancialState() {
    resetShifts();

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
        canDeliverPendingWithdrawal,
        deliverPendingWithdrawal,
        addOperationClarification,
        correctClientOperation,
        registerMovement,
        correctMovement,
        resetFinancialState,
        validateReconciliation,
        reconcileAfterShiftClosing,
        refreshFinancialData,
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
