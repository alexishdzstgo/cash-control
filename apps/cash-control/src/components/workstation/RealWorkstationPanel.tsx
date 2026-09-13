"use client";

import { type FormEvent, useState } from "react";
import { useRealWorkstationSession } from "./RealWorkstationSessionProvider";

const inputClass = "field-input mt-1";
const buttonClass =
  "btn-primary disabled:cursor-not-allowed disabled:opacity-60";

function RealPasswordForm({
  title,
  description,
  submitLabel,
  values,
  onChange,
  onSubmit,
  busy,
}: {
  title: string;
  description: string;
  submitLabel: string;
  values: { username: string; password: string; businessSlug?: string };
  onChange: (
    field: "businessSlug" | "username" | "password",
    value: string,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {values.businessSlug !== undefined && (
        <label className="block text-sm font-medium text-slate-700">
          Identificador del negocio
          <input
            className={inputClass}
            name="businessSlug"
            value={values.businessSlug}
            onChange={(event) => onChange("businessSlug", event.target.value)}
            autoComplete="organization"
            required
          />
        </label>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Usuario
        <input
          className={inputClass}
          name="username"
          value={values.username}
          onChange={(event) => onChange("username", event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Contraseña
        <input
          className={inputClass}
          type="password"
          name="password"
          value={values.password}
          onChange={(event) => onChange("password", event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? "Verificando…" : submitLabel}
      </button>
    </form>
  );
}

function PinForm({
  onSubmit,
  memberId,
  pin,
  onChange,
  busy,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  memberId: string;
  pin: string;
  onChange: (field: "memberId" | "pin", value: string) => void;
  busy: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border-t border-slate-200 pt-5"
    >
      <div>
        <h3 className="font-semibold text-slate-900">
          Cambiar operador con PIN
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Introduce el UUID del miembro que ya fue activado en esta estación y
          su PIN. La identidad final se resuelve en el servidor.
        </p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        UUID del miembro activado
        <input
          className={inputClass}
          name="memberId"
          value={memberId}
          onChange={(event) => onChange("memberId", event.target.value)}
          inputMode="text"
          autoComplete="off"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        PIN
        <input
          className={inputClass}
          type="password"
          name="pin"
          value={pin}
          onChange={(event) => {
            if (/^\d{0,6}$/.test(event.target.value))
              onChange("pin", event.target.value);
          }}
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          required
        />
      </label>
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? "Verificando…" : "Cambiar operador"}
      </button>
    </form>
  );
}

export function RealWorkstationPanel() {
  const { state, operator, error, start, activate, unlock, lock, close } =
    useRealWorkstationSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startForm, setStartForm] = useState({
    businessSlug: "",
    username: "",
    password: "",
  });
  const [activateForm, setActivateForm] = useState({
    username: "",
    password: "",
  });
  const [memberId, setMemberId] = useState("");
  const [pin, setPin] = useState("");

  const submitStart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("start");
    setNotice(null);
    const ok = await start(startForm);
    setBusy(null);
    if (ok) setStartForm((current) => ({ ...current, password: "" }));
  };

  const submitActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("activate");
    setNotice(null);
    const ok = await activate(activateForm);
    setBusy(null);
    if (ok) {
      setActivateForm({ username: "", password: "" });
      setNotice("El operador activado es ahora el operador actual.");
    }
  };

  const submitUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("unlock");
    setNotice(null);
    const ok = await unlock({ memberId, pin });
    setBusy(null);
    if (ok) {
      setPin("");
      setNotice("El operador fue cambiado correctamente.");
    }
  };

  const handleLock = async () => {
    setBusy("lock");
    setNotice(null);
    const ok = await lock();
    setBusy(null);
    if (ok) setNotice("Operador bloqueado. La estación permanece abierta.");
  };

  const handleClose = async () => {
    setBusy("close");
    setNotice(null);
    const ok = await close();
    setBusy(null);
    if (ok) setNotice("Estación cerrada y cookies eliminadas.");
  };

  const stateLabel =
    state === "ACTIVE"
      ? "Operador activo"
      : state === "NO_OPERATOR"
        ? "Estación sin operador"
        : state === "INVALID_SESSION"
          ? "Sesión no disponible"
          : state === "NO_WORKSTATION"
            ? "Sin estación real"
            : "Comprobando sesión";

  return (
    <section
      className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm sm:p-6"
      aria-labelledby="real-workstation-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Integración aislada 2B.2-A
          </p>
          <h2
            id="real-workstation-title"
            className="mt-1 text-lg font-semibold text-slate-900"
          >
            Sesión real de Workstation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Usa cookies HttpOnly y no modifica turnos, caja ni ninguna operación
            financiera.
          </p>
        </div>
        <span className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800">
          {stateLabel}
        </span>
      </div>

      {error && (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <output className="mt-4 block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </output>
      )}

      {state === "loading" ? (
        <p className="mt-5 text-sm text-slate-600">Consultando la estación…</p>
      ) : state === "NO_WORKSTATION" || state === "INVALID_SESSION" ? (
        <div className="mt-5 max-w-xl rounded-xl border border-white bg-white p-4">
          <RealPasswordForm
            title="Iniciar estación"
            description="Valida usuario y contraseña para crear la estación y activar al primer miembro."
            submitLabel="Iniciar estación real"
            values={startForm}
            onChange={(field, value) =>
              setStartForm((current) => ({ ...current, [field]: value }))
            }
            onSubmit={submitStart}
            busy={busy === "start"}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {operator && (
            <div className="rounded-xl border border-white bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Operador resuelto en servidor
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {operator.identity.displayName}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                @{operator.identity.username} · {operator.identity.role}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                El navegador solo recibe esta identidad segura; los tokens
                permanecen en cookies HttpOnly.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-60"
                  onClick={handleLock}
                  disabled={busy !== null}
                >
                  {busy === "lock" ? "Bloqueando…" : "Bloquear operador"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  onClick={handleClose}
                  disabled={busy !== null}
                >
                  {busy === "close" ? "Cerrando…" : "Cerrar estación"}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white bg-white p-4">
            <RealPasswordForm
              title="Activar otro miembro"
              description="La contraseña se verifica de forma transitoria; no se guarda en el navegador."
              submitLabel="Activar y cambiar operador"
              values={activateForm}
              onChange={(field, value) =>
                setActivateForm((current) => ({ ...current, [field]: value }))
              }
              onSubmit={submitActivate}
              busy={busy === "activate"}
            />
          </div>

          <div className="rounded-xl border border-white bg-white p-4 lg:col-span-2">
            <PinForm
              memberId={memberId}
              pin={pin}
              onChange={(field, value) => {
                if (field === "memberId") setMemberId(value);
                else setPin(value);
              }}
              onSubmit={submitUnlock}
              busy={busy === "unlock"}
            />
          </div>
        </div>
      )}
    </section>
  );
}
