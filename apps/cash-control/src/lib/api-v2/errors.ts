import type { V2ApiError, V2ErrorCode } from "./types";

const ERROR_MAPPINGS: Record<
  string,
  { code: V2ErrorCode; userMessage: string }
> = {
  BUSINESS_NOT_FOUND: {
    code: "BUSINESS_NOT_FOUND",
    userMessage: "La empresa especificada no existe en el sistema.",
  },
  FORBIDDEN_BUSINESS_ACCESS: {
    code: "FORBIDDEN_BUSINESS_ACCESS",
    userMessage: "No tienes autorización sobre esta empresa.",
  },
  INVALID_OPERATOR_PIN: {
    code: "INVALID_OPERATOR_PIN",
    userMessage: "PIN de operador incorrecto o usuario inactivo.",
  },
  WORKSTATION_INACTIVE: {
    code: "WORKSTATION_INACTIVE",
    userMessage: "La estación de trabajo está inactiva o no existe.",
  },
  WORKSTATION_ALREADY_HAS_OPEN_SHIFT: {
    code: "WORKSTATION_ALREADY_HAS_OPEN_SHIFT",
    userMessage: "La estación ya cuenta con un turno abierto actualmente.",
  },
  NO_OPEN_SHIFT: {
    code: "NO_OPEN_SHIFT",
    userMessage: "No hay ningún turno abierto en esta estación de trabajo.",
  },
  NO_ACTIVE_SHIFT: {
    code: "NO_ACTIVE_SHIFT",
    userMessage: "No hay un turno activo en la estación.",
  },
  OPERATIONAL_SESSION_EXPIRED: {
    code: "OPERATIONAL_SESSION_EXPIRED",
    userMessage:
      "Tu sesión operativa de terminal ha expirado. Ingresa tu PIN para continuar.",
  },
  OPERATIONAL_SESSION_REVOKED: {
    code: "OPERATIONAL_SESSION_REVOKED",
    userMessage:
      "La sesión operativa fue revocada por cambio de cajero o cierre de turno.",
  },
  INVALID_OR_REVOKED_OPERATIONAL_SESSION: {
    code: "OPERATIONAL_SESSION_REVOKED",
    userMessage:
      "La sesión operativa no es válida, ha expirado o fue revocada en esta estación.",
  },
  IDEMPOTENCY_CONFLICT: {
    code: "IDEMPOTENCY_CONFLICT",
    userMessage:
      "Conflicto de idempotencia: los parámetros de la solicitud no coinciden con la clave enviada.",
  },
  CONCURRENT_OPERATION_IN_PROGRESS: {
    code: "CONCURRENT_OPERATION_IN_PROGRESS",
    userMessage:
      "Hay otra operación procesándose concurrentemente con la misma clave. Intenta de nuevo.",
  },
  INSUFFICIENT_FUNDS: {
    code: "INSUFFICIENT_FUNDS",
    userMessage:
      "Saldo insuficiente en la caja o recurso para realizar esta operación.",
  },
  SUPERVISOR_APPROVAL_REQUIRED: {
    code: "SUPERVISOR_APPROVAL_REQUIRED",
    userMessage: "Esta operación requiere autorización de un supervisor.",
  },
  RESOURCE_NOT_FOUND: {
    code: "RESOURCE_NOT_FOUND",
    userMessage: "El recurso de tesorería especificado no existe.",
  },
  RESOURCE_INACTIVE: {
    code: "RESOURCE_INACTIVE",
    userMessage: "El recurso de tesorería se encuentra inactivo.",
  },
  OWNER_EXCLUSIVE: {
    code: "OWNER_EXCLUSIVE",
    userMessage:
      "Categorías patrimoniales de capital y retiros son exclusivas del dueño.",
  },
  INVALID_TRANSFER_RESOURCES: {
    code: "INVALID_TRANSFER_RESOURCES",
    userMessage:
      "El traslado interno requiere recursos de origen y destino distintos.",
  },
  ORIGIN_REQUIRED: {
    code: "ORIGIN_REQUIRED",
    userMessage: "Esta categoría requiere especificar el recurso de origen.",
  },
  DESTINATION_REQUIRED: {
    code: "DESTINATION_REQUIRED",
    userMessage: "Esta categoría requiere especificar el recurso de destino.",
  },
  INVALID_AMOUNT: {
    code: "INVALID_AMOUNT",
    userMessage: "El monto debe ser un entero positivo mayor a cero.",
  },
  SUPERVISOR_REQUIRED_FOR_CORRECTION: {
    code: "SUPERVISOR_REQUIRED_FOR_CORRECTION",
    userMessage:
      "Las correcciones de operaciones exigen autorización de un supervisor o dueño.",
  },
  INVALID_SUPERVISOR_PIN: {
    code: "INVALID_SUPERVISOR_PIN",
    userMessage: "PIN de supervisor inválido o no autorizado.",
  },
  ORIGINAL_OPERATION_NOT_FOUND: {
    code: "ORIGINAL_OPERATION_NOT_FOUND",
    userMessage:
      "La operación original a corregir no existe o no pertenece a esta empresa.",
  },
  ORIGINAL_NOT_COMPLETED: {
    code: "ORIGINAL_NOT_COMPLETED",
    userMessage: "Solo se pueden corregir operaciones en estado completado.",
  },
  ALREADY_CORRECTED: {
    code: "ALREADY_CORRECTED",
    userMessage: "Esta operación ya ha sido corregida previamente.",
  },
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: {
    code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC",
    userMessage:
      "La clave de idempotencia ya fue utilizada para un tipo de operación distinto.",
  },
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: {
    code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
    userMessage:
      "Conflicto de idempotencia: los parámetros no coinciden con el registro original.",
  },
  CONCURRENT_REQUEST_PROCESSING: {
    code: "CONCURRENT_OPERATION_IN_PROGRESS",
    userMessage:
      "Hay otra transacción procesando esta misma clave de idempotencia actualmente.",
  },
  INVALID_OPERATOR_CREDENTIALS: {
    code: "INVALID_OPERATOR_CREDENTIALS",
    userMessage: "PIN de operador incorrecto o miembro inactivo.",
  },
  AUTH_REQUIRED: {
    code: "AUTH_REQUIRED",
    userMessage:
      "Se requiere autenticación mediante token de terminal o credenciales de operador.",
  },
  uq_shifts_business_folio: {
    code: "VALIDATION_ERROR",
    userMessage: "El folio de turno especificado ya existe en el negocio.",
  },
  SUSPENSE_ACCOUNT_NOT_FOUND: {
    code: "SUSPENSE_ACCOUNT_NOT_FOUND",
    userMessage:
      "Cuenta contable de suspenso y discrepancias (CUSTODY_DISCREPANCY_SUSPENSE) no configurada.",
  },
  INCIDENCE_NOT_FOUND: {
    code: "INCIDENCE_NOT_FOUND",
    userMessage: "La incidencia especificada no existe en este negocio.",
  },
  INCIDENCE_ALREADY_RESOLVED: {
    code: "INCIDENCE_ALREADY_RESOLVED",
    userMessage: "La incidencia ya se encuentra totalmente resuelta.",
  },
  OVER_RESOLUTION: {
    code: "OVER_RESOLUTION",
    userMessage:
      "El monto a resolver supera el saldo no resuelto de la incidencia.",
  },
};

/**
 * Normaliza cualquier error de PostgreSQL, del driver pg o de la red en un objeto V2ApiError estandarizado.
 */
export function normalizeV2Error(error: unknown): V2ApiError {
  if (!error) {
    return {
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Ha ocurrido un error inesperado.",
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  // Buscar coincidencia con prefijos de error SQL conocidos (ej. 'INVALID_OPERATOR_PIN: ...')
  for (const [key, mapping] of Object.entries(ERROR_MAPPINGS)) {
    if (rawMessage.includes(key)) {
      return {
        ok: false,
        code: mapping.code,
        message: mapping.userMessage,
        details: { raw: rawMessage },
      };
    }
  }

  // Errores de conexión local
  if (
    rawMessage.includes("ECONNREFUSED") ||
    rawMessage.includes("ETIMEDOUT") ||
    rawMessage.includes("SASL") ||
    rawMessage.includes("password authentication failed") ||
    rawMessage.includes("LOCAL_DATABASE_UNAVAILABLE")
  ) {
    return {
      ok: false,
      code: "LOCAL_DATABASE_UNAVAILABLE",
      message:
        "No fue posible conectar con la base de datos de pruebas local cash_control_test.",
      details: { raw: rawMessage },
    };
  }

  return {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Error en el servidor al procesar la solicitud.",
    details: { raw: rawMessage },
  };
}
