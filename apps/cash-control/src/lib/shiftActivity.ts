import type { AdministrativeMovement } from "@/types/administrativeMovement";
import type { Operation } from "@/types/operation";
import type {
  Shift,
  ShiftActivity,
  ShiftActivitySummary,
  ShiftOperationalEvent,
} from "@/types/shift";
import { formatCurrency } from "./formatters";

export function getShiftActivitySummary(
  shiftId: string,
  operations: Operation[],
  movements: AdministrativeMovement[],
): ShiftActivitySummary {
  const registered = operations.filter(
    (operation) => operation.shiftId === shiftId,
  );
  return {
    deposits: registered.filter((operation) => operation.type === "deposito")
      .length,
    withdrawals: registered.filter((operation) => operation.type === "retiro")
      .length,
    pendingWithdrawals: registered.filter(
      (operation) =>
        operation.type === "retiro" && operation.status === "pendiente",
    ).length,
    fundsMovements: movements.filter((movement) => movement.shiftId === shiftId)
      .length,
    corrections: operations
      .flatMap((operation) => operation.corrections ?? [])
      .filter((correction) => correction.shiftId === shiftId).length,
    clarifications: operations
      .flatMap((operation) => operation.clarifications ?? [])
      .filter((clarification) => clarification.shiftId === shiftId).length,
  };
}

export function getShiftActivity(
  shift: Shift | string,
  operations: Operation[],
  movements: AdministrativeMovement[],
  operationalEvents: ShiftOperationalEvent[] = [],
): ShiftActivity[] {
  const shiftId = typeof shift === "string" ? shift : shift.id;
  const events: ShiftActivity[] = operationalEvents.filter(
    (event) => event.shiftId === shiftId,
  );
  if (typeof shift !== "string")
    events.push({
      id: `started-${shift.id}`,
      type: "shift_started",
      occurredAt: shift.openedAt,
      performedBy: shift.responsibleUserName,
      reference: shift.folio,
      description: `${shift.responsibleUserName} inició ${shift.folio}`,
    });
  for (const operation of operations) {
    if (operation.shiftId === shiftId) {
      const pending =
        operation.type === "retiro" &&
        (operation.status === "pendiente" ||
          Boolean(operation.pendingDelivery));
      // Corrections preserve the original registration values in their first snapshot.
      const firstCorrection = [...(operation.corrections ?? [])]
        .reverse()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
      const registered = firstCorrection?.before ?? operation;
      events.push({
        id: `registration-${operation.id}`,
        type:
          operation.type === "deposito"
            ? "deposit_registered"
            : pending
              ? "pending_withdrawal_registered"
              : "withdrawal_registered",
        occurredAt: operation.createdAt,
        performedBy: operation.createdBy,
        reference: registered.bankFolio,
        description: `${operation.createdBy} registró ${operation.type === "deposito" ? "un depósito" : pending ? "un retiro pendiente" : "un retiro"}`,
        detail: formatCurrency(registered.amount),
      });
    }
    const delivery = operation.pendingDelivery;
    if (delivery?.shiftId === shiftId) {
      events.push({
        id: `delivery-${operation.id}`,
        type: "pending_withdrawal_delivered",
        occurredAt: delivery.deliveredAt,
        performedBy: delivery.deliveredBy,
        reference: operation.bankFolio,
        description: `${delivery.deliveredBy} entregó un retiro pendiente`,
        detail: "Entrega de efectivo confirmada",
      });
    }
    for (const correction of operation.corrections ?? []) {
      if (correction.shiftId !== shiftId) continue;
      events.push({
        id: `correction-${operation.id}-${correction.id}`,
        type: "operation_corrected",
        occurredAt: correction.createdAt,
        performedBy: correction.createdBy,
        reference: correction.after.bankFolio,
        description: `${correction.createdBy} corrigió ${operation.type === "deposito" ? "un depósito" : "un retiro"}`,
        detail: correction.reason,
      });
    }
    for (const clarification of operation.clarifications ?? []) {
      if (clarification.shiftId !== shiftId) continue;
      events.push({
        id: `clarification-${operation.id}-${clarification.id}`,
        type: "operation_clarified",
        occurredAt: clarification.createdAt,
        performedBy: clarification.createdBy,
        reference: clarification.reference || operation.bankFolio,
        description: `${clarification.createdBy} agregó una aclaración`,
        detail: clarification.reason,
      });
    }
  }
  for (const movement of movements) {
    if (movement.shiftId !== shiftId) continue;
    events.push({
      id: `funds-${movement.id}`,
      type: "funds_movement",
      occurredAt: movement.createdAt,
      performedBy: movement.createdByUserName,
      description: `${movement.createdByUserName} registró un movimiento de fondos`,
      detail: `${movement.movementType === "income" ? "Ingreso" : "Salida"} · ${movement.resourceName}${movement.explanation ? ` · ${movement.explanation}` : ""}`,
    });
  }
  return events.sort(
    (a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.id.localeCompare(b.id),
  );
}

export function getRecentShiftActivity(
  shift: Shift | string,
  operations: Operation[],
  movements: AdministrativeMovement[],
  limit = 5,
  operationalEvents: ShiftOperationalEvent[] = [],
): ShiftActivity[] {
  return getShiftActivity(
    shift,
    operations,
    movements,
    operationalEvents,
  ).slice(0, Math.max(0, limit));
}
