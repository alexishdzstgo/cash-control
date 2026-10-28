"use client";

import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { v2Client } from "@/lib/api-v2/client";
import type { OwnerSessionInfo } from "@/lib/api-v2/types";

interface OwnerLoginFormProps {
  onLoginSuccess: (session: OwnerSessionInfo) => void;
}

export function OwnerLoginForm({ onLoginSuccess }: OwnerLoginFormProps) {
  const [email, setEmail] = useState("dueno1@test.com");
  const [password, setPassword] = useState("test1234");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await v2Client.loginOwner({
        email: email.trim(),
        password,
      });

      if (!res.ok) {
        setError(res.message);
        return;
      }

      onLoginSuccess({
        ownerUserId: res.data.ownerUserId,
        email: res.data.email,
        businessId: res.data.business.id,
        business: res.data.business,
      });
    } catch (_err) {
      setError("Error de conexión al servidor local.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("test1234");
    setError(null);
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Autenticación del Dueño
          </h2>
          <p className="text-xs text-slate-500">
            Cash-Control v2 &bull; PostgreSQL Local
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
        <p className="font-medium text-slate-800">
          Identificación de Tenencia Requerida:
        </p>
        <p className="mt-1">
          Las terminales operativas de Cash-Control v2 requieren una sesión
          válida del dueño del negocio para habilitar turnos y transacciones.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="owner-email-input"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
          >
            Correo del Dueño
          </label>
          <input
            id="owner-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dueno@ejemplo.com"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>

        <div>
          <label
            htmlFor="owner-pass-input"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
          >
            Contraseña
          </label>
          <input
            id="owner-pass-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>

        {/* Cuentas de prueba rápida en cash_control_test */}
        <div className="pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Cuentas de prueba locales:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectPreset("dueno1@test.com")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                email === "dueno1@test.com"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              dueno1@test.com (Empresa A)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("dueno2@test.com")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                email === "dueno2@test.com"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              dueno2@test.com (Empresa B)
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {isLoading ? (
            "Validando con PostgreSQL local..."
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Iniciar Sesión de Dueño
            </>
          )}
        </button>
      </form>
    </div>
  );
}
