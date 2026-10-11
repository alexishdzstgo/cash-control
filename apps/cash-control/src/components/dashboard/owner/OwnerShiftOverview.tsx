"use client";

import { Users, ArrowRight, UserCheck, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useShift } from "@/components/shifts/ShiftContext";
import { useMockSession } from "@/components/session/MockSessionContext";

function formatTime(value?: string): string {
  if (!value) return "—";
  if (value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  }
  return value;
}

export function OwnerShiftOverview() {
  const { currentShift } = useShift();
  const { participants } = useMockSession();

  const activeMembers = participants.filter(
    (participant) => participant.status === "active",
  );

  const responsible = activeMembers.find(
    (participant) =>
      participant.participationType === "responsible" ||
      participant.userId === currentShift?.responsibleUserId,
  );

  const hasActiveShift = currentShift !== null && currentShift.status === "open";

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Turno actual</h2>
          <p className="mt-1 text-sm text-slate-500">
            Estado del turno y participantes
          </p>
        </div>
        <Link
          href="/shifts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-blue transition-colors hover:text-primary-blue-hover"
        >
          {hasActiveShift ? "Ver turno" : "Gestionar turnos"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5">
        {hasActiveShift ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Turno activo</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Folio {currentShift.folio} · Abierto a las {formatTime(currentShift.openedAt)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Responsable:{" "}
                  <span className="font-medium text-slate-800">
                    {currentShift.responsibleUserName || responsible?.userName || "Sin asignar"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <Users className="h-4 w-4" aria-hidden="true" />
              {activeMembers.length} participante{activeMembers.length === 1 ? "" : "s"} activo
              {activeMembers.length === 1 ? "" : "s"}
            </div>

            {activeMembers.length > 0 ? (
              <div className="mt-3 space-y-2">
                {activeMembers.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {participant.userName
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {participant.userName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {participant.participationType === "responsible" ||
                            participant.userId === currentShift.responsibleUserId
                            ? "Responsable"
                            : "Operador"}{" "}
                          · Inició {formatTime(participant.startedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Activo
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs italic text-slate-400">
                No hay operadores registrados en este momento.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 font-semibold text-slate-900">
              No hay turno abierto
            </p>
            <p className="mt-1 text-sm text-slate-500 max-w-xs">
              Actualmente no hay ninguna jornada de caja activa en el sistema.
            </p>
            <Link
              href="/shifts"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-primary-blue shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Iniciar un turno
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}