/**
 * Cliente TypeScript para Cash-Control v2.
 *
 * Este cliente se ejecuta en el navegador y consume exclusivamente los Route Handlers
 * seguros bajo /api/v2/shift/*.
 *
 * GARANTÍAS DE SEGURIDAD:
 * 1. Nunca contiene claves service_role ni URLs de bases de datos.
 * 2. Valida los parámetros (PIN de 4 dígitos, UUIDs) antes de enviar las solicitudes.
 * 3. Normaliza las respuestas y errores para consumo directo por la interfaz.
 */

import { normalizeV2Error } from "./errors";
import type {
  AdministrativeMovementResult,
  BusinessMemberItem,
  CloseShiftParams,
  CloseShiftResult,
  CorrectOperationParams,
  CorrectOperationResult,
  CustomerOperationResult,
  JoinShiftParams,
  JoinShiftResult,
  OpenShiftParams,
  OpenShiftResult,
  OwnerLoginParams,
  OwnerLoginResult,
  OwnerSessionInfo,
  PerformCutParams,
  PerformCutResult,
  RegisterAdministrativeMovementParams,
  RegisterCustomerOperationParams,
  ResolveIncidenceParams,
  ResolveIncidenceResult,
  ShiftStatusResult,
  V2ApiResponse,
  VerifyMemberPinParams,
  VerifyMemberPinResult,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateParams(params: {
  businessId: string;
  workstationId: string;
  operatorMemberId: string;
  pin: string;
}): string | null {
  if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
    return "El identificador de negocio no es válido.";
  }
  if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
    return "El identificador de estación no es válido.";
  }
  if (!params.operatorMemberId || !UUID_REGEX.test(params.operatorMemberId)) {
    return "El identificador de operador no es válido.";
  }
  if (!params.pin || !/^\d{4}$/.test(params.pin)) {
    return "El PIN debe tener exactamente 4 dígitos numéricos.";
  }
  return null;
}

export const v2Client = {
  /**
   * Apertura de turno con PIN inicial y emisión de token de terminal.
   */
  async openShift(
    params: OpenShiftParams,
  ): Promise<V2ApiResponse<OpenShiftResult>> {
    const validationError = validateParams(params);
    if (validationError) {
      return { ok: false, code: "VALIDATION_ERROR", message: validationError };
    }

    try {
      const res = await fetch("/api/v2/shift/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const json = (await res.json()) as V2ApiResponse<OpenShiftResult>;
      return json;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Incorporación o relevo de cajero en el turno activo.
   */
  async joinShift(
    params: JoinShiftParams,
  ): Promise<V2ApiResponse<JoinShiftResult>> {
    const validationError = validateParams(params);
    if (validationError) {
      return { ok: false, code: "VALIDATION_ERROR", message: validationError };
    }

    try {
      const res = await fetch("/api/v2/shift/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const json = (await res.json()) as V2ApiResponse<JoinShiftResult>;
      return json;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Cierre de turno y revocación inmediata de sesiones de terminal.
   */
  async closeShift(
    params: CloseShiftParams,
  ): Promise<V2ApiResponse<CloseShiftResult>> {
    const validationError = validateParams(params);
    if (validationError) {
      return { ok: false, code: "VALIDATION_ERROR", message: validationError };
    }

    try {
      const res = await fetch("/api/v2/shift/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const json = (await res.json()) as V2ApiResponse<CloseShiftResult>;
      return json;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Consulta el estado actual de turno y estación.
   */
  async getShiftStatus(
    businessId: string,
    workstationId: string,
    sessionToken?: string | null,
  ): Promise<V2ApiResponse<ShiftStatusResult>> {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers["x-terminal-session"] = sessionToken;
      }

      const res = await fetch(
        `/api/v2/shift/status?businessId=${encodeURIComponent(businessId)}&workstationId=${encodeURIComponent(workstationId)}`,
        { method: "GET", headers },
      );

      return (await res.json()) as V2ApiResponse<ShiftStatusResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Registra una operación financiera de cliente (depósito o retiro).
   */
  async registerCustomerOperation(
    params: RegisterCustomerOperationParams,
  ): Promise<V2ApiResponse<CustomerOperationResult>> {
    if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "businessId debe ser un UUID válido.",
      };
    }
    if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "workstationId debe ser un UUID válido.",
      };
    }
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "idempotencyKey no puede estar vacío.",
      };
    }
    if (params.type !== "deposit" && params.type !== "withdrawal") {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "type debe ser 'deposit' o 'withdrawal'.",
      };
    }
    if (typeof params.amountCents !== "number" || params.amountCents <= 0) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "amountCents debe ser un número entero positivo.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.sessionToken) {
        headers["x-terminal-session"] = params.sessionToken;
      }

      const res = await fetch("/api/v2/operations/customer", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<CustomerOperationResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Registra un movimiento administrativo (traslado interno, gasto, aportación, retiro o ajuste).
   */
  async registerAdministrativeMovement(
    params: RegisterAdministrativeMovementParams,
  ): Promise<V2ApiResponse<AdministrativeMovementResult>> {
    if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "businessId debe ser un UUID válido.",
      };
    }
    if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "workstationId debe ser un UUID válido.",
      };
    }
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "idempotencyKey no puede estar vacío.",
      };
    }
    if (typeof params.amountCents !== "number" || params.amountCents <= 0) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "amountCents debe ser un número entero positivo.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.sessionToken) {
        headers["x-terminal-session"] = params.sessionToken;
      }

      const res = await fetch("/api/v2/operations/administrative", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<AdministrativeMovementResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Registra una corrección de operación con reversión espejo y reemplazo.
   */
  async correctOperation(
    params: CorrectOperationParams,
  ): Promise<V2ApiResponse<CorrectOperationResult>> {
    if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "businessId debe ser un UUID válido.",
      };
    }
    if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "workstationId debe ser un UUID válido.",
      };
    }
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "idempotencyKey no puede estar vacío.",
      };
    }
    if (
      !params.originalOperationId ||
      !UUID_REGEX.test(params.originalOperationId)
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "originalOperationId debe ser un UUID válido.",
      };
    }
    if (!params.reason || !params.reason.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "reason no puede estar vacío.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.sessionToken) {
        headers["x-terminal-session"] = params.sessionToken;
      }

      const res = await fetch("/api/v2/operations/correction", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<CorrectOperationResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Realiza un corte de turno y conciliación formal de saldos físicos y bancarios.
   */
  async performCut(
    params: PerformCutParams,
  ): Promise<V2ApiResponse<PerformCutResult>> {
    if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "businessId debe ser un UUID válido.",
      };
    }
    if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "workstationId debe ser un UUID válido.",
      };
    }
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "idempotencyKey no puede estar vacío.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.sessionToken) {
        headers["x-terminal-session"] = params.sessionToken;
      }

      const res = await fetch("/api/v2/shift/cut", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<PerformCutResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Resuelve una incidencia de faltante, sobrante o discrepancia bancaria.
   */
  async resolveIncidence(
    params: ResolveIncidenceParams,
  ): Promise<V2ApiResponse<ResolveIncidenceResult>> {
    if (!params.businessId || !UUID_REGEX.test(params.businessId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "businessId debe ser un UUID válido.",
      };
    }
    if (!params.workstationId || !UUID_REGEX.test(params.workstationId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "workstationId debe ser un UUID válido.",
      };
    }
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "idempotencyKey no puede estar vacío.",
      };
    }
    if (!params.incidenceId || !UUID_REGEX.test(params.incidenceId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "incidenceId debe ser un UUID válido.",
      };
    }
    if (
      typeof params.amountResolvedCents !== "number" ||
      params.amountResolvedCents <= 0
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "amountResolvedCents debe ser un entero positivo.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.sessionToken) {
        headers["x-terminal-session"] = params.sessionToken;
      }

      const res = await fetch("/api/v2/shift/incident", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<ResolveIncidenceResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Autenticación del dueño en el servidor con email y password.
   */
  async loginOwner(
    params: OwnerLoginParams,
  ): Promise<V2ApiResponse<OwnerLoginResult>> {
    try {
      const res = await fetch("/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<OwnerLoginResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Consulta el estado de sesión activa del dueño.
   */
  async getOwnerSession(): Promise<V2ApiResponse<OwnerSessionInfo | null>> {
    try {
      const res = await fetch("/api/v2/auth/session", {
        method: "GET",
      });

      return (await res.json()) as V2ApiResponse<OwnerSessionInfo | null>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Cierra la sesión activa del dueño en el servidor.
   */
  async logoutOwner(): Promise<V2ApiResponse<{ loggedOut: boolean }>> {
    try {
      const res = await fetch("/api/v2/auth/logout", {
        method: "POST",
      });

      return (await res.json()) as V2ApiResponse<{ loggedOut: boolean }>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Consulta exclusivamente los miembros registrados en la empresa del dueño autenticado.
   */
  async getBusinessMembers(): Promise<V2ApiResponse<BusinessMemberItem[]>> {
    try {
      const res = await fetch("/api/v2/business/members", {
        method: "GET",
      });

      return (await res.json()) as V2ApiResponse<BusinessMemberItem[]>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },

  /**
   * Valida el PIN de 4 dígitos de un operador contra la función fn_verify_member_pin en PostgreSQL.
   */
  async verifyMemberPin(
    params: VerifyMemberPinParams,
  ): Promise<V2ApiResponse<VerifyMemberPinResult>> {
    try {
      const res = await fetch("/api/v2/workstation/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      return (await res.json()) as V2ApiResponse<VerifyMemberPinResult>;
    } catch (err) {
      return normalizeV2Error(err);
    }
  },
};
