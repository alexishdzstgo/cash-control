import type { ShiftParticipant } from "@/types/shift";
import { activeShift } from "@/components/shifts/shiftsMockData";
import { mockOperations } from "@/components/history/mockOperations";

/**
 * Datos de demostración para el Centro de Control del owner.
 *
 * Regla: NO duplicar fuentes de verdad existentes.
 * - Saldos: `balanceMockData` + `computeFinancialTotals()`.
 * - Turno: `shiftsMockData` + `MockSessionContext`.
 * - Operaciones: `mockOperations`.
 *
 * Este archivo SOLO centraliza datos que aún no existen en otra fuente
 * y son necesarios para la demostración visual.
 */

// ─────────────────────────────────────────────────────────────
// Comisiones — aún no existe estructura real
// ─────────────────────────────────────────────────────────────
export type CommissionConfigStatus =
  | "pending_configuration"
  | "configured";

export const commissionSettings: {
  status: CommissionConfigStatus;
  note: string;
} = {
  status: "pending_configuration",
  note: "Las comisiones se configurarán al conectar la base de datos.",
};

// ─────────────────────────────────────────────────────────────
// Histórico de ganancias — pendiente de persistencia
// ─────────────────────────────────────────────────────────────
export type FinancialHistoryStatus = "pending_db";

export const profitHistory: Record<
  "weekly" | "monthly" | "yearly",
  { status: FinancialHistoryStatus; label: string }
> = {
  weekly: {
    status: "pending_db",
    label: "Disponible al conectar base de datos",
  },
  monthly: {
    status: "pending_db",
    label: "Disponible al conectar base de datos",
  },
  yearly: {
    status: "pending_db",
    label: "Disponible al conectar base de datos",
  },
};

// ─────────────────────────────────────────────────────────────
// Métricas por empleado — pendiente de persistencia
// ─────────────────────────────────────────────────────────────
export type EmployeeMetricsStatus = "pending_db";

export const employeeMetricsPlaceholder: {
  status: EmployeeMetricsStatus;
  label: string;
} = {
  status: "pending_db",
  label: "Las métricas por empleado estarán disponibles al conectar la base de datos.",
};

// ─────────────────────────────────────────────────────────────
// Acciones administrativas que aún no tienen flujo real
// ─────────────────────────────────────────────────────────────
export type PendingAdminActionId =
  | "admin-income"
  | "admin-withdrawal"
  | "configure-commissions"
  | "manage-banks";

export const pendingAdminActions: Array<{
  id: PendingAdminActionId;
  label: string;
  description: string;
}> = [
  {
    id: "admin-income",
    label: "Registrar ingreso administrativo",
    description: "Se habilitará en la siguiente fase",
  },
  {
    id: "admin-withdrawal",
    label: "Registrar retiro administrativo",
    description: "Se habilitará en la siguiente fase",
  },
  {
    id: "configure-commissions",
    label: "Configurar comisiones",
    description: "Pendiente de configurar",
  },
  {
    id: "manage-banks",
    label: "Administrar bancos",
    description: "Se habilitará en la siguiente fase",
  },
];

// ─────────────────────────────────────────────────────────────
// Participantes de demostración del turno activo
// ─────────────────────────────────────────────────────────────
export const ownerShiftParticipants: ShiftParticipant[] = activeShift.participants;

// ─────────────────────────────────────────────────────────────
// Datos derivados para el resumen de empleados
// (sin métricas de productividad inventadas)
// ─────────────────────────────────────────────────────────────
export type EmployeeActivitySummary = {
  userId: string;
  name: string;
  systemRole: "owner" | "employee";
  status: ShiftParticipant["status"];
  shiftRole: ShiftParticipant["shiftRole"];
  joinedAt: string;
};

export const employeeActivityFromShift: EmployeeActivitySummary[] =
  ownerShiftParticipants.map((participant) => ({
    userId: participant.userId,
    name: participant.name,
    systemRole: participant.systemRole,
    status: participant.status,
    shiftRole: participant.shiftRole,
    joinedAt: participant.joinedAt,
  }));

// ─────────────────────────────────────────────────────────────
// Auditoría: operaciones editadas derivadas de mockOperations
// ─────────────────────────────────────────────────────────────
export const editedOperations = mockOperations.filter(
  (operation) => operation.isEdited === true,
);

// ─────────────────────────────────────────────────────────────
// Nota visual de desarrollo para datos simulados
// ─────────────────────────────────────────────────────────────
export const demoDataNotice = {
  source: "mock",
  label: "Datos de demostración",
  detail:
    "La información marcada como simulación se reemplazará al conectar la base de datos.",
} as const;