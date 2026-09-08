"use client";

import {
  ModalInfoItem,
  ModalSection,
  ModalShell,
} from "@/components/shared/ModalShell";
import {
  centsToPesos,
  getMovementTypeLabel,
} from "@/lib/administrativeMovements";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { AdministrativeMovement } from "@/types/administrativeMovement";

type AdministrativeMovementDetailsModalProps = {
  movement: AdministrativeMovement | null;
  onClose: () => void;
};

export function AdministrativeMovementDetailsModal({
  movement,
  onClose,
}: AdministrativeMovementDetailsModalProps) {
  if (!movement) return null;

  return (
    <ModalShell
      title="Detalle del movimiento"
      description={`${getMovementTypeLabel(movement.movementType)} - ${movement.resourceName}`}
      onClose={onClose}
      maxWidth="lg"
      zIndex="high"
      footer={
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ModalSection>
          <div className="grid gap-3 md:grid-cols-2">
            <ModalInfoItem label="ID" value={movement.id} />
            <ModalInfoItem
              label="Tipo"
              value={getMovementTypeLabel(movement.movementType)}
            />
            <ModalInfoItem label="Recurso" value={movement.resourceName} />
            <ModalInfoItem
              label="Monto"
              value={formatCents(movement.amountCents)}
            />
            <ModalInfoItem
              label={
                movement.isEdited
                  ? "Saldo anterior al registro original"
                  : "Saldo anterior"
              }
              value={formatCents(movement.balanceBeforeCents)}
            />
            <ModalInfoItem
              label={
                movement.isEdited
                  ? "Saldo posterior al registro original"
                  : "Saldo posterior"
              }
              value={formatCents(movement.balanceAfterCents)}
            />
            <ModalInfoItem
              label="Realizado por"
              value={movement.createdByUserName}
            />
            <ModalInfoItem
              label="Fecha y hora"
              value={formatDateTime(movement.createdAt)}
            />
            <ModalInfoItem
              label="Turno"
              value={movement.shiftId ?? "Sin turno asociado"}
            />
            <ModalInfoItem
              label="Indicador de correccion"
              value={movement.isEdited ? "Corregido" : "Sin correccion"}
            />
            <div className="md:col-span-2">
              <ModalInfoItem
                label="Motivo"
                value={movement.explanation ?? "Sin motivo"}
              />
            </div>
            {movement.isEdited && (
              <ModalInfoItem
                label="Recurso del registro original"
                value={
                  movement.registeredResourceName ??
                  movement.previousResourceName ??
                  movement.resourceName
                }
              />
            )}
            {movement.correctionBalances?.map((balance) => (
              <div key={balance.resourceId} className="md:col-span-2">
                <ModalInfoItem
                  label={`Estado después de la última corrección · ${balance.resourceName}`}
                  value={`Impacto: ${formatCents(balance.deltaCents)}. Saldo real: ${formatCents(balance.realBalanceAfterCents)}. Disponible: ${formatCents(balance.availableAfterCents)}.`}
                />
              </div>
            ))}
            {movement.editedByUserName && (
              <ModalInfoItem
                label="Corregido por"
                value={movement.editedByUserName}
              />
            )}
            {movement.editedAt && (
              <ModalInfoItem
                label="Fecha de corrección"
                value={formatDateTime(movement.editedAt)}
              />
            )}
            {movement.editReason && (
              <div className="md:col-span-2">
                <ModalInfoItem
                  label="Motivo de correccion"
                  value={movement.editReason}
                />
              </div>
            )}
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

function formatCents(value: number): string {
  return formatCurrency(centsToPesos(value));
}
