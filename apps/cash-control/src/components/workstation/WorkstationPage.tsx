"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
// Acceso real: la sesión se lee de la fachada de sesión de la app (la misma
// fuente que usan SessionGuard y OwnerOnlyGuard) para no montar un provider
// real duplicado dentro de la estación.
import { useRealWorkstationSession } from "@/components/session/RealAppSessionProvider";
import { RealPinLoginScreen } from "./RealPinLoginScreen";

export function WorkstationPage() {
  const { state, activatedMembers } = useRealWorkstationSession();
  const hasStation = state === "ACTIVE" || state === "NO_OPERATOR";

  useEffect(() => {
    if (state === "ACTIVE") window.location.replace("/");
  }, [state]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-surface">
      {/* Header / Nav superior */}
      <nav className="border-b border-slate-800 bg-slate-900 animate-fade-in">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-white" />
            <div>
              <h1 className="text-xl font-bold text-white">Control de caja</h1>
              <p className="text-sm text-slate-400">
                Control de acceso de usuarios
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasStation
                    ? "bg-brand-responsible animate-pulse-soft"
                    : "bg-slate-500"
                }`}
              />
              {hasStation ? "Estación activa" : "Estación cerrada"}
            </span>
            {hasStation && (
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
                {activatedMembers.length}{" "}
                {activatedMembers.length === 1 ? "activo" : "activos"}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {state === "loading" || state === "ACTIVE" ? (
            <div className="rounded-2xl border border-brand-border bg-white p-10 text-center shadow-sm">
              <span
                className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-brand-primary-ring border-t-brand-primary"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-brand-text-muted">
                {state === "ACTIVE"
                  ? "Entrando a Cash Control…"
                  : "Consultando la estación…"}
              </p>
            </div>
          ) : state === "NO_WORKSTATION" || state === "INVALID_SESSION" ? (
            <RealPinLoginScreen key="initial" mode="initial" />
          ) : state === "NO_OPERATOR" ? (
            <RealPinLoginScreen key="unlock" mode="unlock" />
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
