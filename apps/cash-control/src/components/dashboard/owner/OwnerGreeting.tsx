"use client";

import { useMockSession } from "@/components/session/MockSessionContext";
import { activeShift } from "@/components/shifts/shiftsMockData";

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function OwnerGreeting() {
  const { authenticatedUser } = useMockSession();
  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const firstName = authenticatedUser
    ? getFirstName(authenticatedUser.userName)
    : "";

  const formattedDate = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const formattedTime = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const shiftOpen = activeShift.status === "active";
  const responsible = activeShift.participants.find(
    (participant) => participant.shiftRole === "shift_responsible",
  );

  function formatShiftStart(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "hora no disponible";
    return new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-[#2563EB]">Centro de Control</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        {greeting}, {firstName}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Este es el estado actual de tu negocio.
      </p>
      <p className="mt-3 text-sm text-slate-500 capitalize">
        {formattedDate} · {formattedTime}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {shiftOpen ? (
          <>
            Turno abierto desde las{" "}
            <span className="font-medium text-slate-700">
              {formatShiftStart(activeShift.startedAt)} a. m.
            </span>
            {responsible && (
              <>
                {" "}
                · Responsable:{" "}
                <span className="font-medium text-slate-700">
                  {responsible.name}
                </span>
              </>
            )}
          </>
        ) : (
          "No hay un turno activo."
        )}
      </p>
    </section>
  );
}