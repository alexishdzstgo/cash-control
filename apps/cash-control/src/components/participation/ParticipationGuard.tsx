"use client";

import { ArrowLeft, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRealAppSession } from "@/components/session/RealAppSessionProvider";
import { useShift } from "@/components/shifts/ShiftContext";
import { Button } from "@/components/ui/button";

interface ParticipationGuardProps {
  children: React.ReactNode;
}

export function ParticipationGuard({ children }: ParticipationGuardProps) {
  const router = useRouter();
  const { state } = useRealAppSession();
  const { loading, error, currentShift, isCurrentUserParticipant, refresh } =
    useShift();

  useEffect(() => {
    if (state !== "loading" && state !== "ACTIVE") {
      router.replace("/workstation");
    }
  }, [router, state]);

  if (state !== "ACTIVE" || loading) {
    return null;
  }

  if (currentShift && isCurrentUserParticipant()) {
    return <>{children}</>;
  }

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
            Para registrar o gestionar operaciones debes tener un turno abierto
            y una participación activa.
          </p>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex w-full flex-col gap-3">
            <Button
              onClick={() => router.push("/shifts")}
              className="w-full gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Ir a Turnos
            </Button>

            <Button
              variant="outline"
              onClick={() => void refresh()}
              className="w-full gap-2"
            >
              Actualizar turno
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
