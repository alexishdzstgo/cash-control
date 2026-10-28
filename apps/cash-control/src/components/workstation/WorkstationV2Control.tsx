"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTerminalSession } from "@/features/session/TerminalSessionContext";
import { v2Client } from "@/lib/api-v2/client";

interface WorkstationV2ControlProps {
  businessId: string;
  workstationId: string;
  registeredUsers: Array<{
    userId: string;
    userName: string;
  }>;
}

export function WorkstationV2Control({
  businessId,
  workstationId,
  registeredUsers,
}: WorkstationV2ControlProps) {
  const {
    hasOpenShift,
    shiftId,
    shiftFolio,
    shiftOpenedAt,
    operatorMemberId,
    operatorName,
    sessionToken,
    hasValidSession,
    error,
    participants,
    openShift,
    joinShift,
    closeShift,
  } = useTerminalSession();

  const [activeAction, setActiveAction] = useState<
    "open" | "join" | "close" | "cut" | null
  >(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [cutCountedPesos, setCutCountedPesos] = useState<string>("");
  const [cutNotes, setCutNotes] = useState<string>("");
  const [cutResultInfo, setCutResultInfo] = useState<{
    folio: string;
    status: string;
    hasDifferences: boolean;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAction = (action: "open" | "join" | "close" | "cut") => {
    setActiveAction(action);
    setPin("");
    setActionError(null);
    setCutResultInfo(null);
    if ((action === "close" || action === "cut") && operatorMemberId) {
      setSelectedUser(operatorMemberId);
    } else {
      setSelectedUser(registeredUsers[0]?.userId || "");
    }
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length !== 4) {
      setActionError("El PIN debe tener 4 dígitos.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    const userObj = registeredUsers.find((u) => u.userId === selectedUser);
    const userName = userObj ? userObj.userName : "Operador";

    try {
      if (activeAction === "open") {
        const res = await openShift({
          businessId,
          workstationId,
          operatorMemberId: selectedUser,
          operatorName: userName,
          pin,
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
      } else if (activeAction === "join") {
        const res = await joinShift({
          businessId,
          workstationId,
          operatorMemberId: selectedUser,
          operatorName: userName,
          pin,
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
      } else if (activeAction === "close") {
        const res = await closeShift({
          businessId,
          workstationId,
          operatorMemberId: selectedUser,
          pin,
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
      } else if (activeAction === "cut") {
        const countedCents = Math.round(
          Number.parseFloat(cutCountedPesos || "0") * 100,
        );
        const cutRes = await v2Client.performCut({
          businessId,
          workstationId,
          idempotencyKey: `cut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          auditedShiftIds: shiftId ? [shiftId] : [],
          sessionToken: sessionToken || null,
          operatorMemberId: selectedUser,
          operatorPin: pin,
          cashCounts: [
            {
              resource_id: "cc900000-0000-0000-0000-000000000001",
              counted_amount_cents: countedCents,
              notes: cutNotes || "Arqueo de terminal",
            },
          ],
          notes: cutNotes || "Corte de turno desde terminal",
        });
        if (!cutRes.ok) {
          setActionError(cutRes.message);
          return;
        }
        setCutResultInfo({
          folio: cutRes.data.folio,
          status: cutRes.data.status,
          hasDifferences: cutRes.data.has_differences,
        });
      }

      setActiveAction(null);
      setPin("");
    } catch (_err) {
      setActionError("Error inesperado ejecutando la operación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header del Núcleo v2 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Estado de Turno y Terminal (Núcleo v2)
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              PostgreSQL Local
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Control criptográfico de sesión operativa conectado a{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-700">
              cash_control_test
            </code>
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          {!hasOpenShift ? (
            <button
              type="button"
              onClick={() => handleOpenAction("open")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <KeyRound className="h-4 w-4" />
              Abrir Turno
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenAction("join")}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 transition"
              >
                <Users className="h-4 w-4" />
                Relevar Cajero
              </button>
              <button
                type="button"
                onClick={() => handleOpenAction("cut")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                <Calculator className="h-4 w-4 text-slate-600" />
                Corte de Turno
              </button>
              <button
                type="button"
                onClick={() => handleOpenAction("close")}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Turno
              </button>
            </>
          )}
        </div>
      </div>

      {/* Banner de resultado de corte si existe */}
      {cutResultInfo && (
        <div
          className={`mt-4 flex items-center justify-between rounded-xl p-3 text-sm border ${
            cutResultInfo.hasDifferences
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-emerald-50 text-emerald-900 border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                cutResultInfo.hasDifferences
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            />
            <span>
              Corte <strong>{cutResultInfo.folio}</strong> registrado. Estado:{" "}
              <strong>{cutResultInfo.status}</strong>.
              {cutResultInfo.hasDifferences
                ? " Se detectaron diferencias físicas y se generó la incidencia correspondiente."
                : " Arqueo cuadrado exactamente con saldos teóricos."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCutResultInfo(null)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 ml-2"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Alerta de Error global si existe */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid de Estado */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tarjeta 1: Turno */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Turno en Estación
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                hasOpenShift ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <p className="text-base font-bold text-slate-900">
              {hasOpenShift ? "Turno Abierto" : "Estación Cerrada"}
            </p>
          </div>
          {hasOpenShift && (
            <div className="mt-2 text-xs text-slate-600 space-y-0.5">
              <p>
                <span className="font-medium text-slate-500">Folio:</span>{" "}
                {shiftFolio}
              </p>
              {shiftOpenedAt && (
                <p>
                  <span className="font-medium text-slate-500">Apertura:</span>{" "}
                  {new Date(shiftOpenedAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tarjeta 2: Sesión Operativa de Terminal */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sesión Operativa
          </p>
          <div className="mt-2 flex items-center gap-2">
            {hasValidSession ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Lock className="h-4 w-4 text-rose-500" />
            )}
            <p className="text-base font-bold text-slate-900">
              {hasValidSession ? "Sesión Activa" : "Sesión Inactiva"}
            </p>
          </div>
          <div className="mt-2 text-xs text-slate-600 space-y-0.5">
            {hasValidSession && sessionToken ? (
              <>
                <p>
                  <span className="font-medium text-slate-500">Operador:</span>{" "}
                  {operatorName || "Cajero activo"}
                </p>
                <p
                  className="font-mono text-[11px] text-slate-500 truncate"
                  title={sessionToken}
                >
                  Token: {sessionToken.slice(0, 12)}...
                </p>
              </>
            ) : (
              <p className="text-rose-600 font-medium">
                {hasOpenShift
                  ? "Se requiere PIN de operador para habilitar transacciones."
                  : "Abre un turno para emitir token de terminal."}
              </p>
            )}
          </div>
        </div>

        {/* Tarjeta 3: Participantes del turno */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Participantes Activos
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-slate-600" />
            <p className="text-base font-bold text-slate-900">
              {participants.length}{" "}
              {participants.length === 1 ? "operador" : "operadores"}
            </p>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {participants.length > 0 ? (
              <ul className="space-y-1">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span className="truncate max-w-[130px] font-medium text-slate-700">
                      {p.fullName}
                    </span>
                    <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-slate-600">
                      {p.roleInShift === "responsible"
                        ? "Responsable"
                        : "Apoyo"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">Sin participantes registrados.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal/Formulario de Acción Transaccional */}
      {activeAction && (
        <div className="mt-6 rounded-xl border border-brand-primary-ring bg-slate-50/70 p-5 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">
              {activeAction === "open" && "Apertura de Turno (rpc_open_shift)"}
              {activeAction === "join" && "Relevo de Cajero (rpc_join_shift)"}
              {activeAction === "cut" &&
                "Corte y Conciliación de Turno (rpc_perform_cut_reconciliation)"}
              {activeAction === "close" && "Cierre de Turno (rpc_close_shift)"}
            </h3>
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </button>
          </div>

          <form
            onSubmit={handleSubmitAction}
            className="mt-4 space-y-4 max-w-md"
          >
            <div>
              <label
                htmlFor="v2-operator-select"
                className="block text-xs font-semibold uppercase text-slate-600 mb-1"
              >
                Operador
              </label>
              <select
                id="v2-operator-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                disabled={activeAction === "close"}
              >
                {registeredUsers.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.userName}
                  </option>
                ))}
              </select>
            </div>

            {activeAction === "cut" && (
              <>
                <div>
                  <label
                    htmlFor="v2-cut-cash-input"
                    className="block text-xs font-semibold uppercase text-slate-600 mb-1"
                  >
                    Efectivo Físico Contado ($ MXN)
                  </label>
                  <input
                    id="v2-cut-cash-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cutCountedPesos}
                    onChange={(e) => setCutCountedPesos(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Se contrastará contra el saldo teórico de la caja física y
                    se ajustará al centavo.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="v2-cut-notes-input"
                    className="block text-xs font-semibold uppercase text-slate-600 mb-1"
                  >
                    Observaciones del Arqueo
                  </label>
                  <input
                    id="v2-cut-notes-input"
                    type="text"
                    value={cutNotes}
                    onChange={(e) => setCutNotes(e.target.value)}
                    placeholder="Notas opcionales del corte"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="v2-pin-input"
                className="block text-xs font-semibold uppercase text-slate-600 mb-1"
              >
                PIN de Seguridad (4 dígitos)
              </label>
              <input
                id="v2-pin-input"
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tracking-widest text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {actionError && (
              <p className="text-xs text-rose-600 font-medium">{actionError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || pin.length !== 4}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {isSubmitting
                  ? "Verificando en PostgreSQL..."
                  : "Confirmar Operación"}
              </button>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
