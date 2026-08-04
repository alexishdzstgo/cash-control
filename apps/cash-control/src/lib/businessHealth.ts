import { computeFinancialTotals, computeBankMovementAlerts } from "@/lib/finance";
import { mockOperations } from "@/components/history/mockOperations";
import { activeShift } from "@/components/shifts/shiftsMockData";

export type BusinessHealthStatus = "stable" | "attention" | "critical";

export type HealthCause = {
  id: string;
  message: string;
  severity: "warning" | "critical";
};

export type BusinessHealth = {
  status: BusinessHealthStatus;
  title: string;
  description: string;
  causes: HealthCause[];
  hasActiveShift: boolean;
  hasOpenCloseReview: boolean;
};

/**
 * Deriva el estado del negocio únicamente de señales existentes:
 * - Estados de saldo (caja y bancos)
 * - Alertas bancarias (límite de movimientos, saldo bajo)
 * - Operaciones pendientes (retiros/depósitos)
 * - Turno activo o inactivo
 * - Diferencias de cierre pendientes de revisión
 *
 * Prioridad: critical > attention > stable
 */
export function computeBusinessHealth(): BusinessHealth {
  const totals = computeFinancialTotals();
  const bankAlerts = computeBankMovementAlerts();

  const causes: HealthCause[] = [];

  // ── Caja física ──
  if (totals.cashIsCritical) {
    causes.push({
      id: "cash-critical",
      message: "Caja física con saldo disponible crítico",
      severity: "critical",
    });
  } else if (totals.cashIsLow) {
    causes.push({
      id: "cash-low",
      message: "Caja física con saldo disponible bajo",
      severity: "warning",
    });
  }

  // ── Bancos: saldo y movimientos ──
  for (const bank of totals.bankBreakdown) {
    const alert = bankAlerts.find((a) => a.bankId === bank.bankId);

    if (bank.resourceStatus === "critical") {
      if (bank.isCritical) {
        causes.push({
          id: `bank-critical-${bank.bankId}`,
          message: `${bank.bankName} alcanzó su saldo crítico`,
          severity: "critical",
        });
      }
      if (alert?.isAtLimit) {
        causes.push({
          id: `bank-limit-${bank.bankId}`,
          message: `${bank.bankName} alcanzó el límite de movimientos visibles`,
          severity: "critical",
        });
      }
    } else if (bank.resourceStatus === "warning") {
      if (bank.isLow) {
        causes.push({
          id: `bank-low-${bank.bankId}`,
          message: `${bank.bankName} tiene saldo disponible bajo`,
          severity: "warning",
        });
      }
      if (alert?.isNearLimit) {
        causes.push({
          id: `bank-near-limit-${bank.bankId}`,
          message: `${bank.bankName} está cerca del límite de movimientos visibles`,
          severity: "warning",
        });
      }
    }
  }

  // ── Operaciones pendientes ──
  const pendingWithdrawals = mockOperations.filter(
    (operation) => operation.type === "retiro" && operation.status === "pendiente",
  );
  const pendingDeposits = mockOperations.filter(
    (operation) => operation.type === "deposito" && operation.status === "pendiente",
  );

  if (pendingWithdrawals.length > 0) {
    causes.push({
      id: "pending-withdrawals",
      message: `${pendingWithdrawals.length} retiro${pendingWithdrawals.length === 1 ? "" : "s"} pendiente${pendingWithdrawals.length === 1 ? "" : "s"} por entregar`,
      severity: "warning",
    });
  }

  if (pendingDeposits.length > 0) {
    causes.push({
      id: "pending-deposits",
      message: `${pendingDeposits.length} depósito${pendingDeposits.length === 1 ? "" : "s"} pendiente${pendingDeposits.length === 1 ? "" : "s"} por confirmar`,
      severity: "warning",
    });
  }

  // ── Diferencia de cierre pendiente de revisión ──
  const hasOpenCloseReview =
    activeShift.status === "closed_review_required" ||
    activeShift.closingResult === "shortage" ||
    activeShift.closingResult === "surplus";
  if (hasOpenCloseReview) {
    causes.push({
      id: "close-difference",
      message: "Existe una diferencia de caja pendiente de revisión",
      severity: "critical",
    });
  }

  // ── Turno ──
  const hasActiveShift = activeShift.status === "active";

  // ── Clasificación según prioridad ──
  let status: BusinessHealthStatus = "stable";
  if (causes.some((cause) => cause.severity === "critical")) {
    status = "critical";
  } else if (causes.length > 0) {
    status = "attention";
  }

  const summaries: Record<BusinessHealthStatus, { title: string; description: string }> = {
    stable: {
      title: "Todo bajo control",
      description: "Caja con saldo suficiente, bancos disponibles y turno activo.",
    },
    attention: {
      title: "Hay situaciones que revisar",
      description: "Existen pendientes o alertas que requieren tu atención.",
    },
    critical: {
      title: "Se requiere atención antes del cierre",
      description: "Hay señales críticas que deben resolverse antes de cerrar el turno.",
    },
  };

  return {
    status,
    ...summaries[status],
    causes: causes.slice(0, 3),
    hasActiveShift,
    hasOpenCloseReview,
  };
}