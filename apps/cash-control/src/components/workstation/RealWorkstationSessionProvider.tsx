"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SessionIdentity = {
  businessId: string;
  memberId: string;
  userId: string;
  username: string;
  role: "owner" | "employee";
  displayName: string;
};

export type RealWorkstationOperator = {
  identity: SessionIdentity;
  operatorExpiresAt: string;
  workstationExpiresAt?: string;
};

export type RealWorkstationMember = {
  memberId: string;
  username: string;
  displayName: string;
  role: "owner" | "employee";
};

export type RealWorkstationState =
  | "loading"
  | "NO_WORKSTATION"
  | "NO_OPERATOR"
  | "ACTIVE"
  | "INVALID_SESSION";

type StartInput = {
  businessSlug: string;
  username: string;
  password: string;
};

type ActivateInput = {
  username: string;
  password: string;
};

type UnlockInput = {
  memberId: string;
  pin: string;
};

type ResolveResponse = {
  state: Exclude<RealWorkstationState, "loading">;
  operator?: RealWorkstationOperator;
};

type MembersResponse = {
  state: Exclude<RealWorkstationState, "loading">;
  members?: RealWorkstationMember[];
};

type RealWorkstationSessionContextValue = {
  state: RealWorkstationState;
  operator: RealWorkstationOperator | null;
  activatedMembers: RealWorkstationMember[];
  error: string | null;
  refresh: () => Promise<boolean>;
  loadActivatedMembers: () => Promise<boolean>;
  start: (input: StartInput) => Promise<boolean>;
  activate: (input: ActivateInput) => Promise<boolean>;
  unlock: (input: UnlockInput) => Promise<boolean>;
  lock: () => Promise<boolean>;
  close: () => Promise<boolean>;
};

const RealWorkstationSessionContext =
  createContext<RealWorkstationSessionContextValue | null>(null);

function messageFromBody(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  )
    return body.error;
  return "No se pudo completar la operación de sesión.";
}

function operatorFromMutation(body: Record<string, unknown>) {
  return {
    identity: body.identity as SessionIdentity,
    operatorExpiresAt: body.operatorExpiresAt as string,
    ...(typeof body.workstationExpiresAt === "string"
      ? { workstationExpiresAt: body.workstationExpiresAt }
      : {}),
  } satisfies RealWorkstationOperator;
}

export function RealWorkstationSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<RealWorkstationState>("loading");
  const [operator, setOperator] = useState<RealWorkstationOperator | null>(
    null,
  );
  const [activatedMembers, setActivatedMembers] = useState<
    RealWorkstationMember[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const loadActivatedMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/workstation/members", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as MembersResponse;
      if (!response.ok) {
        if (response.status === 401) {
          setState("INVALID_SESSION");
          setOperator(null);
          setActivatedMembers([]);
        }
        setError(messageFromBody(body));
        return false;
      }
      if (body.state === "NO_WORKSTATION" || body.state === "INVALID_SESSION") {
        setState(body.state);
        setOperator(null);
        setActivatedMembers([]);
        setError(null);
        return false;
      }
      setActivatedMembers(body.members ?? []);
      setError(null);
      return true;
    } catch {
      setError("No se pudo consultar los miembros activados.");
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workstation/resolve", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as ResolveResponse;
      if (!response.ok) throw new Error(messageFromBody(body));
      setState(body.state);
      setOperator(body.state === "ACTIVE" ? (body.operator ?? null) : null);
      if (body.state === "NO_WORKSTATION" || body.state === "INVALID_SESSION")
        setActivatedMembers([]);
      else if (!(await loadActivatedMembers())) return false;
      setError(null);
      return true;
    } catch {
      setState("INVALID_SESSION");
      setOperator(null);
      setActivatedMembers([]);
      setError("No se pudo consultar la sesión real.");
      return false;
    }
  }, [loadActivatedMembers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (
      path: string,
      input: Record<string, string>,
    ): Promise<Record<string, unknown> | null> => {
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(input),
        });
        const body = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          setError(messageFromBody(body));
          return null;
        }
        setError(null);
        return body as Record<string, unknown>;
      } catch {
        setError("No se pudo completar la operación de sesión.");
        return null;
      }
    },
    [],
  );

  const start = useCallback(
    async (input: StartInput) => {
      const body = await mutate("/api/workstation/start", input);
      if (!body) return false;
      const nextOperator = operatorFromMutation(body);
      setOperator(nextOperator);
      setState("ACTIVE");
      await loadActivatedMembers();
      return true;
    },
    [loadActivatedMembers, mutate],
  );

  const activate = useCallback(
    async (input: ActivateInput) => {
      const body = await mutate("/api/workstation/activate", input);
      if (!body) return false;
      const nextOperator = operatorFromMutation(body);
      setOperator(nextOperator);
      setState("ACTIVE");
      await loadActivatedMembers();
      return true;
    },
    [loadActivatedMembers, mutate],
  );

  const unlock = useCallback(
    async (input: UnlockInput) => {
      const body = await mutate("/api/workstation/unlock", input);
      if (!body) return false;
      const nextOperator = operatorFromMutation(body);
      setOperator(nextOperator);
      setState("ACTIVE");
      return true;
    },
    [mutate],
  );

  const lock = useCallback(async () => {
    const body = await mutate("/api/workstation/lock", {});
    if (!body) return false;
    setOperator(null);
    setState("NO_OPERATOR");
    return true;
  }, [mutate]);

  const close = useCallback(async () => {
    const body = await mutate("/api/workstation/close", {});
    if (!body) return false;
    setOperator(null);
    setActivatedMembers([]);
    setState("NO_WORKSTATION");
    return true;
  }, [mutate]);

  const value = useMemo(
    () => ({
      state,
      operator,
      activatedMembers,
      error,
      refresh,
      loadActivatedMembers,
      start,
      activate,
      unlock,
      lock,
      close,
    }),
    [
      state,
      operator,
      activatedMembers,
      error,
      refresh,
      loadActivatedMembers,
      start,
      activate,
      unlock,
      lock,
      close,
    ],
  );

  return (
    <RealWorkstationSessionContext.Provider value={value}>
      {children}
    </RealWorkstationSessionContext.Provider>
  );
}

export function useRealWorkstationSession() {
  const context = useContext(RealWorkstationSessionContext);
  if (!context)
    throw new Error(
      "useRealWorkstationSession must be used within RealWorkstationSessionProvider",
    );
  return context;
}
