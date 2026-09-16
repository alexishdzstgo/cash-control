"use client";

import { Check, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useRealWorkstationSession } from "@/components/session/RealAppSessionProvider";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { getUserRoleLabel } from "@/lib/users";

/** El acceso inicial siempre pertenece al negocio operado por esta instalación. */
const BUSINESS_SLUG = "cash-control";
const LOAD_ERROR = "No se pudieron cargar los usuarios del negocio.";
const ENTRY_ERROR = "No se pudo entrar con ese PIN.";

type WorkstationCandidate = {
  memberId: string;
  username: string;
  displayName: string;
  role: "owner" | "employee";
};

type CandidatesResult =
  | { candidates: WorkstationCandidate[] }
  | { error: string };

function readCandidate(value: unknown): WorkstationCandidate | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const role = row.role;
  if (role !== "owner" && role !== "employee") return null;
  const { memberId, username, displayName } = row;
  if (
    typeof memberId !== "string" ||
    typeof username !== "string" ||
    typeof displayName !== "string"
  )
    return null;
  return { memberId, username, displayName, role };
}

function pickCandidates(body: unknown): WorkstationCandidate[] | null {
  if (!body || typeof body !== "object") return null;
  const list = (body as Record<string, unknown>).candidates;
  if (!Array.isArray(list)) return null;
  const candidates: WorkstationCandidate[] = [];
  for (const value of list) {
    const candidate = readCandidate(value);
    if (!candidate) return null;
    candidates.push(candidate);
  }
  return candidates;
}

async function loadCandidates(): Promise<CandidatesResult> {
  try {
    const response = await fetch(
      `/api/workstation/candidates?businessSlug=${BUSINESS_SLUG}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) return { error: LOAD_ERROR };
    const candidates = pickCandidates(body);
    return candidates ? { candidates } : { error: LOAD_ERROR };
  } catch {
    return { error: LOAD_ERROR };
  }
}

export function RealPinLoginScreen() {
  const router = useRouter();
  const { startWithPin, error: sessionError } = useRealWorkstationSession();
  const [candidates, setCandidates] = useState<WorkstationCandidate[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkstationCandidate | null>(null);
  const [pin, setPin] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await loadCandidates();
      if (cancelled) return;
      if ("error" in result) {
        setCandidates([]);
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setCandidates(result.candidates);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectCandidate = (candidate: WorkstationCandidate) => {
    setSelected(candidate);
    setPin("");
    setFailed(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setPin("");
    setFailed(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || busy || !/^\d{4,6}$/.test(pin)) return;
    setBusy(true);
    setFailed(false);
    const entered = await startWithPin({
      businessSlug: BUSINESS_SLUG,
      username: selected.username,
      pin,
    });
    setBusy(false);
    // El PIN nunca se conserva en el componente después del intento.
    setPin("");
    if (!entered) {
      setFailed(true);
      return;
    }
    router.push("/");
  };

  const message = failed ? (sessionError ?? ENTRY_ERROR) : null;
  const canSubmit = Boolean(selected) && /^\d{4,6}$/.test(pin);
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-8">
      <header className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary-soft text-brand-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-brand-text">
            Entrar a Cash Control
          </h2>
          <p className="mt-1 text-sm text-brand-text-muted">
            Selecciona tu usuario e introduce tu PIN para abrir esta estación.
          </p>
        </div>
      </header>

      {candidates === null && (
        <output className="mt-6 flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface px-4 py-6 text-sm text-brand-text-muted">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary-ring border-t-brand-primary"
            aria-hidden="true"
          />
          Cargando usuarios…
        </output>
      )}

      {candidates !== null && candidates.length === 0 && (
        <output className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-brand-border px-4 py-6 text-sm text-brand-text-muted">
          <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
          {loadError ?? "No hay usuarios activos en este negocio."}
        </output>
      )}

      {candidates !== null && candidates.length > 0 && (
        <fieldset className="mt-6 grid gap-3 sm:grid-cols-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
            Usuarios del negocio
          </legend>
          {candidates.map((candidate) => {
            const isSelected = selected?.memberId === candidate.memberId;
            return (
              <button
                key={candidate.memberId}
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectCandidate(candidate)}
                className={`flex min-h-20 w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-ring ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary-soft ring-2 ring-brand-primary-ring"
                    : "border-brand-border bg-white hover:border-brand-primary-ring hover:bg-brand-primary-soft/40"
                }`}
              >
                <UserAvatar name={candidate.displayName} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold text-brand-text">
                    {candidate.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-brand-text-muted">
                    {getUserRoleLabel(candidate.role)}
                  </span>
                </span>
                {isSelected && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>
      )}

      {selected && (
        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <UserAvatar name={selected.displayName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-brand-text">
                {selected.displayName}
              </p>
              <p className="text-xs text-brand-text-muted">
                {getUserRoleLabel(selected.role)}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-sm font-medium text-brand-primary transition hover:text-brand-primary-hover"
              onClick={clearSelection}
              disabled={busy}
            >
              Cambiar usuario
            </button>
          </div>
          <label className="block text-sm font-medium text-brand-text">
            PIN
            <input
              className="field-input mt-1"
              type="password"
              name="pin"
              value={pin}
              onChange={(event) => {
                if (!/^\d{0,6}$/.test(event.target.value)) return;
                setPin(event.target.value);
                setFailed(false);
              }}
              inputMode="numeric"
              minLength={4}
              maxLength={6}
              autoComplete="off"
              aria-invalid={Boolean(message)}
              required
            />
          </label>
          {message && (
            <output className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </output>
          )}
          <button
            type="submit"
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || !canSubmit}
          >
            {busy ? "Verificando…" : "Entrar"}
          </button>
        </form>
      )}
    </section>
  );
}
