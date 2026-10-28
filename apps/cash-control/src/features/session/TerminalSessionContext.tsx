"use client";

/**
 * Contexto de Sesión Operativa de Terminal para Cash-Control v2.
 *
 * MODELO DE SEGURIDAD Y JUSTIFICACIÓN:
 * 1. El token de sesión de terminal (session_token) se genera en PostgreSQL mediante rpc_open_shift
 *    o rpc_join_shift y únicamente se almacena su hash SHA-256 en la base de datos.
 * 2. En el cliente, el token se retiene primordialmente en memoria React (useState).
 * 3. Como mecanismo de resiliencia frente a recargas accidentales de página (F5) durante un turno activo,
 *    se sincroniza en `sessionStorage` con ámbito exclusivo a la pestaña actual del navegador.
 *    JUSTIFICACIÓN: `sessionStorage` es efímero (se destruye de inmediato al cerrar la pestaña), no es accesible
 *    por otras pestañas ni ventanas, y NUNCA se persiste en `localStorage` (evitando persistencia indefinida
 *    y riesgos de exfiltración persistente).
 * 4. Al ejecutar un cierre de turno (rpc_close_shift), relevo o detectar sesión revocada/expirada,
 *    el token se destruye de inmediato tanto de memoria como de `sessionStorage`.
 * 5. Se mantiene separación absoluta entre la identidad del dueño del negocio (Supabase Auth / JWT)
 *    y la sesión operativa del cajero de turno (token de terminal firmado por PIN en PostgreSQL).
 */

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { v2Client } from "@/lib/api-v2/client";
import type {
  CloseShiftResult,
  JoinShiftResult,
  OpenShiftResult,
  V2ApiError,
} from "@/lib/api-v2/types";

const SESSION_STORAGE_KEY = "cash_control_v2_terminal_session";

interface TerminalSessionContextType {
  // Estado de turno
  hasOpenShift: boolean;
  shiftId: string | null;
  shiftFolio: string | null;
  shiftOpenedAt: string | null;

  // Estado de operador activo
  operatorMemberId: string | null;
  operatorName: string | null;
  sessionToken: string | null;
  hasValidSession: boolean;
  isLoading: boolean;
  error: string | null;

  // Participantes activos
  participants: Array<{
    id: string;
    memberId: string;
    fullName: string;
    roleInShift: string;
    joinedAt: string;
  }>;

  // Acciones operativas
  openShift: (params: {
    businessId: string;
    workstationId: string;
    operatorMemberId: string;
    operatorName: string;
    pin: string;
    folio?: string;
  }) => Promise<{ ok: true; data: OpenShiftResult } | V2ApiError>;

  joinShift: (params: {
    businessId: string;
    workstationId: string;
    operatorMemberId: string;
    operatorName: string;
    pin: string;
  }) => Promise<{ ok: true; data: JoinShiftResult } | V2ApiError>;

  closeShift: (params: {
    businessId: string;
    workstationId: string;
    operatorMemberId: string;
    pin: string;
  }) => Promise<{ ok: true; data: CloseShiftResult } | V2ApiError>;

  refreshStatus: (businessId: string, workstationId: string) => Promise<void>;
  clearSession: () => void;
}

const TerminalSessionContext = createContext<TerminalSessionContextType | null>(
  null,
);

export function TerminalSessionProvider({
  children,
  businessId,
  workstationId,
}: {
  children: React.ReactNode;
  businessId: string;
  workstationId: string;
}) {
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftFolio, setShiftFolio] = useState<string | null>(null);
  const [shiftOpenedAt, setShiftOpenedAt] = useState<string | null>(null);

  const [operatorMemberId, setOperatorMemberId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);

  const [participants, setParticipants] = useState<
    Array<{
      id: string;
      memberId: string;
      fullName: string;
      roleInShift: string;
      joinedAt: string;
    }>
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializar token desde sessionStorage (aislado por pestaña)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.workstationId === workstationId) {
          setSessionToken(parsed.token);
          setOperatorMemberId(parsed.operatorMemberId || null);
          setOperatorName(parsed.operatorName || null);
        }
      }
    } catch {
      // Si sessionStorage no está disponible o falla el parseo, continuar en memoria
    }
  }, [workstationId]);

  // Actualizar estado de turno y validar token contra PostgreSQL local
  const refreshStatus = useCallback(
    async (bId: string, wId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await v2Client.getShiftStatus(bId, wId, sessionToken);
        if (res.ok && res.data) {
          setHasOpenShift(res.data.hasOpenShift);
          if (res.data.shift) {
            setShiftId(res.data.shift.id);
            setShiftFolio(res.data.shift.folio);
            setShiftOpenedAt(res.data.shift.opened_at);
          } else {
            setShiftId(null);
            setShiftFolio(null);
            setShiftOpenedAt(null);
          }

          setParticipants(res.data.participants || []);

          if (res.data.sessionValid && sessionToken) {
            setHasValidSession(true);
          } else {
            setHasValidSession(false);
            // Si el servidor indica que la sesión no es válida, limpiamos el token de memoria y sessionStorage
            if (sessionToken && !res.data.sessionValid) {
              setSessionToken(null);
              setOperatorMemberId(null);
              setOperatorName(null);
              try {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
              } catch {}
            }
          }
        } else if (!res.ok) {
          setError(res.message);
        }
      } catch (_err) {
        setError(
          "Error de comunicación al actualizar el estado de la estación.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (businessId && workstationId) {
      void refreshStatus(businessId, workstationId);
    }
  }, [businessId, workstationId, refreshStatus]);

  // Apertura de turno
  const openShift = useCallback(
    async (params: {
      businessId: string;
      workstationId: string;
      operatorMemberId: string;
      operatorName: string;
      pin: string;
      folio?: string;
    }) => {
      setError(null);
      const res = await v2Client.openShift({
        businessId: params.businessId,
        workstationId: params.workstationId,
        operatorMemberId: params.operatorMemberId,
        pin: params.pin,
        folio: params.folio,
      });

      if (res.ok) {
        setHasOpenShift(true);
        setShiftId(res.data.shift_id);
        setShiftFolio(res.data.folio);
        setOperatorMemberId(res.data.operator_member_id);
        setOperatorName(params.operatorName);
        setSessionToken(res.data.session_token);
        setHasValidSession(true);

        try {
          sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              token: res.data.session_token,
              workstationId: params.workstationId,
              operatorMemberId: res.data.operator_member_id,
              operatorName: params.operatorName,
            }),
          );
        } catch {}

        await refreshStatus(params.businessId, params.workstationId);
      } else {
        setError(res.message);
      }

      return res;
    },
    [refreshStatus],
  );

  // Relevo de cajero (joinShift)
  const joinShift = useCallback(
    async (params: {
      businessId: string;
      workstationId: string;
      operatorMemberId: string;
      operatorName: string;
      pin: string;
    }) => {
      setError(null);
      const res = await v2Client.joinShift({
        businessId: params.businessId,
        workstationId: params.workstationId,
        operatorMemberId: params.operatorMemberId,
        pin: params.pin,
      });

      if (res.ok) {
        setOperatorMemberId(res.data.operator_member_id);
        setOperatorName(params.operatorName);
        setSessionToken(res.data.session_token);
        setHasValidSession(true);

        try {
          sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              token: res.data.session_token,
              workstationId: params.workstationId,
              operatorMemberId: res.data.operator_member_id,
              operatorName: params.operatorName,
            }),
          );
        } catch {}

        await refreshStatus(params.businessId, params.workstationId);
      } else {
        setError(res.message);
      }

      return res;
    },
    [refreshStatus],
  );

  // Cierre de turno (closeShift)
  const closeShift = useCallback(
    async (params: {
      businessId: string;
      workstationId: string;
      operatorMemberId: string;
      pin: string;
    }) => {
      setError(null);
      const res = await v2Client.closeShift(params);

      if (res.ok) {
        setHasOpenShift(false);
        setShiftId(null);
        setShiftFolio(null);
        setOperatorMemberId(null);
        setOperatorName(null);
        setSessionToken(null);
        setHasValidSession(false);

        try {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {}

        await refreshStatus(params.businessId, params.workstationId);
      } else {
        setError(res.message);
      }

      return res;
    },
    [refreshStatus],
  );

  const clearSession = useCallback(() => {
    setSessionToken(null);
    setOperatorMemberId(null);
    setOperatorName(null);
    setHasValidSession(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <TerminalSessionContext.Provider
      value={{
        hasOpenShift,
        shiftId,
        shiftFolio,
        shiftOpenedAt,
        operatorMemberId,
        operatorName,
        sessionToken,
        hasValidSession,
        isLoading,
        error,
        participants,
        openShift,
        joinShift,
        closeShift,
        refreshStatus,
        clearSession,
      }}
    >
      {children}
    </TerminalSessionContext.Provider>
  );
}

export function useTerminalSession(): TerminalSessionContextType {
  const context = useContext(TerminalSessionContext);
  if (!context) {
    throw new Error(
      "useTerminalSession debe utilizarse dentro de un TerminalSessionProvider",
    );
  }
  return context;
}
