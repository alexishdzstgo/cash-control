"use client";

import { useMockSession } from "@/components/session/MockSessionContext";

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function DashboardGreeting() {
  const { authenticatedUser } = useMockSession();
  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const isOwner = authenticatedUser?.systemRole === "owner";
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

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-[#2563EB]">
        Cash Control
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        {greeting}, {firstName}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        {isOwner
          ? "¿Cómo va tu negocio hoy?"
          : "Todo listo para continuar con tu turno."}
      </p>
      <p className="mt-3 text-sm text-slate-500 capitalize">
        {formattedDate} · {formattedTime}
      </p>
    </section>
  );
}