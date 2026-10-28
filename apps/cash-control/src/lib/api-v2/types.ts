/**
 * Contratos de tipos TypeScript para Cash-Control v2.
 *
 * Basado estrictamente en las funciones SQL reales de:
 * supabase/migrations/20261027150000_v2_fase_c_core.sql
 */

// -----------------------------------------------------------------------------
// Códigos de Error Normalizados
// -----------------------------------------------------------------------------

export type V2ErrorCode =
  // Validación de Entidades
  | "BUSINESS_NOT_FOUND"
  | "FORBIDDEN_BUSINESS_ACCESS"
  | "WORKSTATION_INACTIVE"
  | "WORKSTATION_ALREADY_HAS_OPEN_SHIFT"
  | "NO_OPEN_SHIFT"
  | "NO_ACTIVE_SHIFT"
  | "INVALID_OPERATOR_PIN"
  | "INVALID_OPERATOR_CREDENTIALS"
  | "OPERATOR_INACTIVE"
  | "OPERATIONAL_SESSION_EXPIRED"
  | "OPERATIONAL_SESSION_REVOKED"
  // Idempotencia y Concurrencia
  | "IDEMPOTENCY_CONFLICT"
  | "CONCURRENT_OPERATION_IN_PROGRESS"
  | "SEQUENCE_MISMATCH"
  | "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC"
  | "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
  // Reglas Financieras y Administrativas
  | "INSUFFICIENT_FUNDS"
  | "SUPERVISOR_APPROVAL_REQUIRED"
  | "SUPERVISOR_REQUIRED_FOR_CORRECTION"
  | "INVALID_SUPERVISOR_PIN"
  | "OWNER_EXCLUSIVE"
  | "INVALID_TRANSFER_RESOURCES"
  | "ORIGIN_REQUIRED"
  | "DESTINATION_REQUIRED"
  | "INVALID_AMOUNT"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_INACTIVE"
  // Correcciones
  | "ORIGINAL_OPERATION_NOT_FOUND"
  | "ORIGINAL_NOT_COMPLETED"
  | "ALREADY_CORRECTED"
  // Cortes e Incidencias (Fase D5)
  | "SUSPENSE_ACCOUNT_NOT_FOUND"
  | "INCIDENCE_NOT_FOUND"
  | "INCIDENCE_ALREADY_RESOLVED"
  | "OVER_RESOLUTION"
  // Errores Genéricos / Infraestructura
  | "UNAUTHORIZED"
  | "AUTH_REQUIRED"
  | "LOCAL_DATABASE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR"
  | "VALIDATION_ERROR";

export interface V2ApiError {
  ok: false;
  code: V2ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface V2ApiSuccess<T> {
  ok: true;
  data: T;
}

export type V2ApiResponse<T> = V2ApiSuccess<T> | V2ApiError;

// -----------------------------------------------------------------------------
// Contratos RPC: Turnos y Sesión Operativa (Fase D2)
// -----------------------------------------------------------------------------

export interface OpenShiftParams {
  businessId: string;
  workstationId: string;
  operatorMemberId: string;
  pin: string;
  folio?: string | null;
}

export interface OpenShiftResult {
  shift_id: string;
  folio: string;
  status: "open";
  operator_member_id: string;
  session_token: string;
  expires_at: string;
}

export interface JoinShiftParams {
  businessId: string;
  workstationId: string;
  operatorMemberId: string;
  pin: string;
}

export interface JoinShiftResult {
  shift_id: string;
  operator_member_id: string;
  session_token: string;
  joined_at: string;
}

export interface CloseShiftParams {
  businessId: string;
  workstationId: string;
  operatorMemberId: string;
  pin: string;
}

export interface CloseShiftResult {
  shift_id: string;
  status: "closed";
  closed_at: string;
}

// -----------------------------------------------------------------------------
// Estado de Sesión Operativa en Terminal
// -----------------------------------------------------------------------------

export interface TerminalSessionState {
  hasActiveSession: boolean;
  businessId: string | null;
  workstationId: string | null;
  shiftId: string | null;
  shiftFolio: string | null;
  operatorMemberId: string | null;
  operatorName: string | null;
  sessionToken: string | null;
  expiresAt: string | null;
  isShiftOpen: boolean;
}

export interface ShiftStatusResult {
  hasOpenShift: boolean;
  shift: {
    id: string;
    folio: string;
    status: string;
    opened_at: string;
    opened_by_member_id: string;
  } | null;
  participants: Array<{
    id: string;
    memberId: string;
    fullName: string;
    roleInShift: string;
    joinedAt: string;
  }>;
  sessionValid: boolean;
  operatorMemberId: string | null;
}

// -----------------------------------------------------------------------------
// Contratos RPC: Operaciones Financieras de Cliente (Fase D3 Piloto)
// -----------------------------------------------------------------------------

export type CustomerOperationType = "deposit" | "withdrawal";

export interface RegisterCustomerOperationParams {
  businessId: string;
  workstationId: string;
  idempotencyKey: string;
  type: CustomerOperationType;
  amountCents: number;
  sourceResourceId: string;
  destinationResourceId: string;
  senderName: string;
  receiverName: string;
  sessionToken?: string | null;
  operatorMemberId?: string | null;
  operatorPin?: string | null;
  customerAccountRef?: string | null;
  bankFolio?: string | null;
  notes?: string | null;
  commissionOverrideCents?: number | null;
  supervisorPin?: string | null;
  supervisorMemberId?: string | null;
}

export interface CustomerOperationResourceEffect {
  resource_id: string;
  direction: "INFLOW" | "OUTFLOW";
  amount_cents: number;
  sequence: number;
  balance_after_cents: number;
}

export interface CustomerOperationResult {
  success: boolean;
  operation_id: string;
  folio: string;
  journal_entry_id: string;
  entry_number: number;
  amount_cents: number;
  commission_cents: number;
  total_cents: number;
  source_resource: CustomerOperationResourceEffect;
  destination_resource: CustomerOperationResourceEffect;
  economic_ledger?: {
    account_code: string;
    amount_cents: number;
    direction: "CREDIT";
  };
  timestamp?: string;
}

// -----------------------------------------------------------------------------
// Contratos RPC: Movimientos Administrativos (Fase D4)
// -----------------------------------------------------------------------------

export type AdministrativeMovementCategory =
  | "transfer_internal"
  | "expense_out"
  | "funding_in"
  | "owner_capital_injection"
  | "owner_drawing_withdrawal"
  | "reconciliation_adjustment";

export interface RegisterAdministrativeMovementParams {
  businessId: string;
  workstationId: string;
  idempotencyKey: string;
  category: AdministrativeMovementCategory;
  amountCents: number;
  originResourceId?: string | null;
  destinationResourceId?: string | null;
  accountId?: string | null;
  sessionToken?: string | null;
  operatorMemberId?: string | null;
  operatorPin?: string | null;
  voucherUrl?: string | null;
  notes?: string | null;
  authorizedByMemberId?: string | null;
  supervisorPin?: string | null;
}

export interface AdministrativeMovementResult {
  success: boolean;
  movement_id: string;
  folio: string;
  journal_entry_id: string;
  entry_number: number;
  category: AdministrativeMovementCategory;
  amount_cents: number;
}

// -----------------------------------------------------------------------------
// Contratos RPC: Corrección de Operaciones (Fase D4)
// -----------------------------------------------------------------------------

export interface CorrectOperationParams {
  businessId: string;
  workstationId: string;
  idempotencyKey: string;
  originalOperationId: string;
  reason: string;
  replacementAmountCents: number;
  replacementSourceResourceId: string;
  replacementDestinationResourceId: string;
  replacementSenderName: string;
  replacementReceiverName: string;
  sessionToken?: string | null;
  operatorMemberId?: string | null;
  operatorPin?: string | null;
  replacementCustomerAccountRef?: string | null;
  replacementBankFolio?: string | null;
  replacementCommissionOverrideCents?: number | null;
  supervisorPin?: string | null;
  supervisorMemberId?: string | null;
}

export interface CorrectOperationResult {
  success: boolean;
  correction_id: string;
  original_operation_id: string;
  reversal_operation_id: string;
  reversal_journal_id: string;
  replacement_operation_id: string;
  replacement_journal_id: string;
}

// -----------------------------------------------------------------------------
// Contratos RPC: Cortes de Turno y Conciliación (Fase D5)
// -----------------------------------------------------------------------------

export type DifferenceType = "exact" | "shortage" | "surplus";
export type CutStatus =
  | "in_progress"
  | "completed"
  | "completed_with_issues"
  | "cancelled";

export interface CashCountItem {
  resource_id: string;
  counted_amount_cents: number;
  notes?: string | null;
}

export interface BankAuditSubItem {
  bank_movement_ref: string;
  movement_date?: string | null;
  category:
    | "deposit"
    | "withdrawal"
    | "transfer"
    | "fee"
    | "interest"
    | "other";
  amount_cents: number;
  verdict: "matched" | "unmatched" | "suspicious";
  notes?: string | null;
}

export interface BankAuditItem {
  resource_id: string;
  observed_balance_cents: number;
  evidence_url?: string | null;
  notes?: string | null;
  items?: BankAuditSubItem[];
}

export interface PerformCutParams {
  businessId: string;
  workstationId: string;
  idempotencyKey: string;
  auditedShiftIds?: string[];
  cashCounts?: CashCountItem[];
  bankAudits?: BankAuditItem[];
  sessionToken?: string | null;
  operatorMemberId?: string | null;
  operatorPin?: string | null;
  notes?: string | null;
}

export interface PerformCutResult {
  success: boolean;
  cut_id: string;
  folio: string;
  status: CutStatus;
  journal_entry_id: string | null;
  has_differences: boolean;
}

// -----------------------------------------------------------------------------
// Contratos RPC: Resolución de Incidencias (Fase D5)
// -----------------------------------------------------------------------------

export type IncidenceResolutionType =
  | "reintegration_partial"
  | "reintegration_final"
  | "explained_by_operation"
  | "confirmed_loss"
  | "confirmed_surplus";

export interface ResolveIncidenceParams {
  businessId: string;
  workstationId: string;
  idempotencyKey: string;
  incidenceId: string;
  eventType: IncidenceResolutionType;
  amountResolvedCents: number;
  sessionToken?: string | null;
  operatorMemberId?: string | null;
  operatorPin?: string | null;
  linkedOperationId?: string | null;
  linkedAdminMovementId?: string | null;
  notes?: string | null;
  supervisorPin?: string | null;
  supervisorMemberId?: string | null;
}

export interface ResolveIncidenceResult {
  success: boolean;
  resolution_id: string;
  incidence_id: string;
  event_type: IncidenceResolutionType;
  amount_resolved_cents: number;
  unresolved_remaining_cents: number;
}

// -----------------------------------------------------------------------------
// Contratos de Autenticación de Dueño y Miembros de Negocio (E2E Integration)
// -----------------------------------------------------------------------------

export interface OwnerLoginParams {
  email: string;
  password?: string;
}

export interface OwnerBusinessInfo {
  id: string;
  commercialName: string;
  legalName: string;
}

export interface OwnerLoginResult {
  ownerUserId: string;
  email: string;
  business: OwnerBusinessInfo;
  sessionToken: string;
}

export interface OwnerSessionInfo {
  ownerUserId: string;
  email: string;
  businessId: string;
  business: OwnerBusinessInfo;
}

export interface BusinessMemberItem {
  id: string;
  fullName: string;
  role: "owner" | "manager" | "cashier";
  status: "active" | "inactive" | "suspended";
}

export interface VerifyMemberPinParams {
  memberId: string;
  pin: string;
}

export interface VerifyMemberPinResult {
  valid: boolean;
  memberId: string;
  fullName?: string;
  role?: string;
}
