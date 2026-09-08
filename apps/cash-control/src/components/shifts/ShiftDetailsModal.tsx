"use client";

import { useEffect } from "react";
import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ShiftViewModel } from "@/types/shift";

interface ShiftDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftViewModel;
}

export function ShiftDetailsModal({
  isOpen,
  onClose,
  shift,
}: ShiftDetailsModalProps) {
  const responsible = shift.participants.find(
    (p) => p.userId === shift.responsibleUserId,
  );
  const activeParticipants = shift.participants.filter(
    (p) => p.status === "active",
  );
  const leftParticipants = shift.participants.filter(
    (p) => p.status === "left",
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalShell
      title="Detalles del turno"
      description={shift.folio}
      onClose={onClose}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Información general
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-slate-400">Folio</p>
              <p className="text-sm font-medium text-slate-900">
                {shift.folio}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Estado</p>
              <p className="text-sm font-medium text-slate-900 capitalize">
                {shift.status === "open" ? "Abierto" : "Cerrado"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Responsable actual</p>
              <p className="text-sm font-medium text-slate-900">
                {responsible?.name ?? "Sin asignar"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Inicio</p>
              <p className="text-sm font-medium text-slate-900">
                {new Date(shift.openedAt).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Caja física al abrir</p>
              <p className="text-sm font-medium text-slate-900">
                {formatCurrency(shift.openingBalances.cashPhysical)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                Efectivo apartado al abrir
              </p>
              <p className="text-sm font-medium text-slate-900 tabular-nums">
                {formatCurrency(shift.openingBalances.cashReserved)}
              </p>
            </div>
            {shift.openingBalances.banks.map((bank) => (
              <div key={bank.bankId}>
                <p className="text-xs text-slate-400">
                  {bank.bankName} al abrir
                </p>
                <p className="text-sm font-medium text-slate-900 tabular-nums">
                  {formatCurrency(bank.balance)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Participación
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-slate-400">Participantes activos</p>
              <p className="text-sm font-medium text-slate-900">
                {activeParticipants.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                Participantes que salieron
              </p>
              <p className="text-sm font-medium text-slate-900">
                {leftParticipants.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">
                Usuarios que participaron
              </p>
              <p className="text-sm font-medium text-slate-900">
                {shift.participants.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Operaciones registradas</p>
              <p className="text-sm font-medium text-slate-900">
                {shift.summary.deposits + shift.summary.withdrawals}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-500">
          Actividad reciente
        </h3>
        <div className="mt-3 space-y-2">
          {shift.activity.slice(0, 5).map((activity) => (
            <div
              key={activity.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="text-sm text-slate-700">{activity.description}</p>
              <p className="text-xs text-slate-600">
                {[activity.reference, activity.detail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(activity.occurredAt).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
          {shift.activity.length === 0 && (
            <p className="text-sm text-slate-500">
              No hay actividad registrada.
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
