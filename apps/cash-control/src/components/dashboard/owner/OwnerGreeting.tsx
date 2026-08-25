"use client";

import { useMockSession } from "@/components/session/MockSessionContext";

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

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        {greeting}, {firstName}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Este es el estado actual de tu negocio.
      </p>
    </section>
  );
}
