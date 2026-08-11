"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { Shift } from "@/types/shift";

interface ShiftDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
}

export function ShiftDetailsModal({
  isOpen,
  onClose,
  shift,
}: ShiftDetailsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Detalles del turno
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
            aria-label="Cerrar"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-slate-500">
                Información general
              </h3>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Nombre</p>
                  <p className="text-sm font-medium text-slate-900">
                    {shift.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">
                    {shift.status.replace("_", " ")}
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
                    {new Date(shift.startedAt).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Duración</p>
                  <p className="text-sm font-medium text-slate-900">
                    {shift.currentDuration ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Saldo inicial</p>
                  <p className="text-sm font-medium text-slate-900">
                    $
                    {shift.openingBalance.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-500">
                Participación
              </h3>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">
                    Participantes activos
                  </p>
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
                  <p className="text-xs text-slate-400">
                    Operaciones registradas
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {shift.activity.length}
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
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm text-slate-700">
                    {activity.description}
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-6">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
