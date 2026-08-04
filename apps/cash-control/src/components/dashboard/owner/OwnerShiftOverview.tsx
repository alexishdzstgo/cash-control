"use client";

import { Users, ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";
import { activeShift } from "@/components/shifts/shiftsMockData";
import { ownerShiftParticipants } from "./ownerDashboardMockData";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function OwnerShiftOverview() {
  const responsible = ownerShiftParticipants.find(
    (participant) => participant.shiftRole === "shift_responsible",
  );
  const activeMembers = ownerShiftParticipants.filter(
    (participant) => participant.status === "active",
  );

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
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Ver turno
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {activeShift.status === "active" ? "Turno activo" : "Turno inactivo"}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {activeShift.name} · Abierto a las {formatTime(activeShift.startedAt)}
            </p>
            {responsible && (
              <p className="mt-1 text-sm text-slate-600">
                Responsable:{" "}
                <span className="font-medium text-slate-800">
                  {responsible.name}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" aria-hidden="true" />
          {activeMembers.length} participante{activeMembers.length === 1 ? "" : "s"} activo
          {activeMembers.length === 1 ? "" : "s"}
        </div>

        <div className="mt-3 space-y-2">
          {ownerShiftParticipants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {participant.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {participant.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {participant.shiftRole === "shift_responsible"
                      ? "Responsable"
                      : "Operador"}{" "}
                    · Inició {formatTime(participant.joinedAt)}
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
      </div>
    </section>
  );
}