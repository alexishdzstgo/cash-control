"use client";

import { useRouter } from "next/navigation";
import { UserCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockSession } from "@/components/session/MockSessionContext";

interface ParticipationGuardProps {
  children: React.ReactNode;
}

export function ParticipationGuard({ children }: ParticipationGuardProps) {
  const router = useRouter();
  const { authenticatedUser, participants, startParticipation, updateAuthenticatedUser } = useMockSession();

  if (!authenticatedUser) {
    return null;
  }

  const activeParticipation = participants.find(
    (p) => p.userId === authenticatedUser.userId && p.status === "active"
  );

  // If user has active participation, show the protected content
  if (activeParticipation) {
    return <>{children}</>;
  }

  const handleStartParticipation = () => {
    if (authenticatedUser) {
      startParticipation(authenticatedUser.userId);
      updateAuthenticatedUser({ hasActiveParticipation: true });
    }
  };

  // If user doesn't have active participation, show blocking screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <UserCheck className="h-8 w-8" />
          </div>

          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            No tienes una participación activa
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Para registrar o gestionar operaciones debes iniciar tu participación.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <Button
              onClick={handleStartParticipation}
              className="w-full gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Iniciar participación
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}