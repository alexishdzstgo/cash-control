"use client";

import {
  ArrowRight,
  Clock,
  LogOut,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/layout/Footer";
import { useMockSession } from "@/components/session/MockSessionContext";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TerminalSessionProvider } from "@/features/session/TerminalSessionContext";
import { v2Client } from "@/lib/api-v2/client";
import type { OwnerSessionInfo } from "@/lib/api-v2/types";
import type { UserAvatar as UserAvatarModel } from "@/types/user";
import { OwnerLoginForm } from "./OwnerLoginForm";
import type { Participant } from "./types";
import { WorkstationAccessModal } from "./WorkstationAccessModal";
import { WorkstationV2Control } from "./WorkstationV2Control";

const DEFAULT_LOCAL_USERS: RegisteredUser[] = [
  {
    userId: "ba900000-0000-0000-0000-000000000001",
    userName: "Dueño Concurrente",
    pin: "",
    systemRole: "owner",
  },
  {
    userId: "ba900000-0000-0000-0000-000000000002",
    userName: "Cajero Uno",
    pin: "",
    systemRole: "employee",
  },
];

const LOCAL_V2_BIZ_ID = "b9000000-0000-0000-0000-000000000001";
const LOCAL_V2_WS_ID = "ca900000-0000-0000-0000-000000000001";

interface RegisteredUser {
  userId: string;
  userName: string;
  pin: string;
  systemRole: "owner" | "employee";
}

function ActiveParticipantCard({
  participant,
  isResponsible,
  onSelect,
  index,
  avatar,
}: {
  participant: Participant;
  isResponsible: boolean;
  onSelect: () => void;
  index: number;
  avatar?: UserAvatarModel;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex w-full cursor-pointer items-center gap-4 rounded-xl border border-brand-border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-brand-primary-ring hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-primary-ring focus:ring-offset-2 animate-fade-in-up opacity-0"
      style={{
        animationDelay: `${index * 0.08}s`,
        animationFillMode: "forwards",
      }}
    >
      {/* Indicador lateral para responsable */}
      {isResponsible && (
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-l-xl bg-brand-responsible" />
      )}

      {/* Avatar con iniciales */}
      <UserAvatar
        name={participant.userName}
        avatar={avatar}
        size="lg"
        className={
          isResponsible
            ? "ring-2 ring-brand-responsible-soft"
            : "ring-2 ring-brand-primary-soft"
        }
      />

      {/* Información del participante */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-brand-text">
            {participant.userName}
          </p>

          {isResponsible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-responsible-soft px-2 py-0.5 text-xs font-medium text-brand-responsible">
              <ShieldCheck className="h-3 w-3" />
              Responsable
            </span>
          )}
        </div>

        {isResponsible && (
          <p className="mt-0.5 text-xs text-brand-text-muted">
            Responsable de la estación
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-text-muted">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {isResponsible ? "Responsable" : "Apoyo"} desde las{" "}
            {participant.startedAt}
          </span>
        </div>
      </div>

      {/* Zona de acción */}
      <div className="flex w-24 shrink-0 items-center justify-end">
        <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-all duration-250 ease-out group-hover:bg-slate-900">
          <span className="text-sm font-semibold text-brand-text-muted transition-colors duration-250 ease-out group-hover:text-white">
            Ingresar
          </span>

          <ArrowRight className="h-4 w-4 text-brand-text-muted transition-all duration-250 ease-out group-hover:translate-x-1 group-hover:text-white" />
        </div>
      </div>
    </button>
  );
}

function JoinAnotherUserCard({
  onClick,
  index,
}: {
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-brand-border bg-slate-900/5 p-5 text-left transition-all duration-200 hover:border-brand-primary hover:bg-brand-primary-soft/30 focus:outline-none focus:ring-2 focus:ring-brand-primary-ring focus:ring-offset-2 animate-fade-in-up opacity-0"
      style={{
        animationDelay: `${index * 0.08}s`,
        animationFillMode: "forwards",
      }}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-surface text-brand-text-muted">
        <UserPlus className="h-6 w-6" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-brand-text">Activar usuario</p>
        <p className="mt-0.5 text-sm text-brand-text-muted">
          Accede con una cuenta que aún no tiene participación activa en esta
          estación.
        </p>
      </div>
    </button>
  );
}

export function WorkstationPage() {
  const router = useRouter();

  const {
    getUserAvatar,
    participants: globalParticipants,
    unlockSession,
    isSessionLoading,
  } = useMockSession();

  const [ownerSession, setOwnerSession] = useState<OwnerSessionInfo | null>(
    null,
  );
  const [isOwnerAuthChecking, setIsOwnerAuthChecking] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"access" | "join">("access");

  const [preselectedUserId, setPreselectedUserId] = useState<string | null>(
    null,
  );

  const [registeredUsers, setRegisteredUsers] =
    useState<RegisteredUser[]>(DEFAULT_LOCAL_USERS);

  // Cargar sesión del dueño y usuarios registrados en su empresa
  useEffect(() => {
    let cancelled = false;

    async function checkOwnerSession() {
      setIsOwnerAuthChecking(true);
      try {
        const sessionRes = await v2Client.getOwnerSession();
        if (cancelled) return;

        if (sessionRes.ok && sessionRes.data) {
          setOwnerSession(sessionRes.data);

          // Cargar exclusivamente los miembros de esta empresa
          const membersRes = await v2Client.getBusinessMembers();
          if (!cancelled && membersRes.ok && membersRes.data) {
            const mapped: RegisteredUser[] = membersRes.data.map((m) => ({
              userId: m.id,
              userName: m.fullName,
              pin: "",
              systemRole: m.role === "owner" ? "owner" : "employee",
            }));
            setRegisteredUsers(
              mapped.length > 0 ? mapped : DEFAULT_LOCAL_USERS,
            );
          }
        } else {
          setOwnerSession(null);
        }
      } catch (error) {
        console.error("Error al consultar sesión del dueño:", error);
      } finally {
        if (!cancelled) setIsOwnerAuthChecking(false);
      }
    }

    void checkOwnerSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = async (session: OwnerSessionInfo) => {
    setOwnerSession(session);
    try {
      const membersRes = await v2Client.getBusinessMembers();
      if (membersRes.ok && membersRes.data) {
        const mapped: RegisteredUser[] = membersRes.data.map((m) => ({
          userId: m.id,
          userName: m.fullName,
          pin: "",
          systemRole: m.role === "owner" ? "owner" : "employee",
        }));
        setRegisteredUsers(mapped.length > 0 ? mapped : DEFAULT_LOCAL_USERS);
      }
    } catch (err) {
      console.error("Error cargando miembros tras inicio de sesión:", err);
    }
  };

  const handleLogoutOwner = async () => {
    await v2Client.logoutOwner();
    setOwnerSession(null);
  };

  const handleVerifyPin = async (userId: string, pin: string) => {
    const res = await v2Client.verifyMemberPin({ memberId: userId, pin });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    if (!res.data.valid) {
      return { ok: false, error: "PIN incorrecto. Intenta de nuevo." };
    }
    return { ok: true };
  };

  const activeParticipants = globalParticipants
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      if (a.participationType === "responsible") return -1;
      if (b.participationType === "responsible") return 1;
      return a.startedAt.localeCompare(b.startedAt);
    });

  const handleActiveParticipantClick = useCallback(
    (participant: Participant) => {
      setPreselectedUserId(participant.userId);
      setModalMode("access");
      setModalOpen(true);
    },
    [],
  );

  const handleJoinClick = useCallback(() => {
    setPreselectedUserId(null);
    setModalMode("join");
    setModalOpen(true);
  }, []);

  const handleAccess = useCallback(
    (userId: string) => {
      const user = registeredUsers.find((u) => u.userId === userId);
      if (user) {
        unlockSession({
          userId: user.userId,
          userName: user.userName,
          systemRole: user.systemRole,
          hasActiveParticipation: true,
        });
      }
      setModalOpen(false);
      router.push("/");
    },
    [registeredUsers, unlockSession, router],
  );

  const handleJoin = useCallback(
    (userId: string) => {
      const user = registeredUsers.find((u) => u.userId === userId);
      if (user) {
        unlockSession({
          userId: user.userId,
          userName: user.userName,
          systemRole: user.systemRole,
          hasActiveParticipation: true,
        });
      }
      setModalOpen(false);
      router.push("/");
    },
    [registeredUsers, unlockSession, router],
  );

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    setPreselectedUserId(null);
  }, []);

  const currentBusinessId = ownerSession?.businessId || LOCAL_V2_BIZ_ID;

  return (
    <TerminalSessionProvider
      businessId={currentBusinessId}
      workstationId={LOCAL_V2_WS_ID}
    >
      <div className="flex min-h-screen flex-col bg-brand-surface">
        {/* Header / Nav superior */}
        <nav className="border-b border-slate-800 bg-slate-900 animate-fade-in">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-white" />

              <div>
                <h1 className="text-xl font-bold text-white">
                  Control de caja
                </h1>

                <p className="text-sm text-slate-400">
                  {ownerSession
                    ? `${ownerSession.business.commercialName} &bull; Estación de Trabajo`
                    : "Identificación de Sesión y Acceso"}
                </p>
              </div>
            </div>

            {ownerSession ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <span className="block text-xs font-semibold text-slate-200">
                    {ownerSession.business.commercialName}
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {ownerSession.email}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-brand-responsible animate-pulse-soft" />
                  Estación activa
                </span>

                <button
                  type="button"
                  onClick={handleLogoutOwner}
                  title="Cerrar sesión del dueño"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                  Requiere Sesión de Dueño
                </span>
              </div>
            )}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {isOwnerAuthChecking ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                <p className="mt-3 text-sm text-slate-500">
                  Comprobando sesión del dueño en PostgreSQL local...
                </p>
              </div>
            ) : !ownerSession ? (
              /* Paso 1: Formulario de inicio de sesión del dueño */
              <OwnerLoginForm onLoginSuccess={handleLoginSuccess} />
            ) : (
              /* Pasos 2 a 11: Operación completa de la terminal */
              <>
                {/* Núcleo v2: Control de Turno y Sesión de Terminal */}
                <WorkstationV2Control
                  businessId={currentBusinessId}
                  workstationId={LOCAL_V2_WS_ID}
                  registeredUsers={registeredUsers}
                />

                {/* Active participants container */}
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">
                  <section>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-brand-text">
                          Control de usuarios (
                          {ownerSession.business.commercialName})
                        </h3>

                        <p className="mt-1 text-sm text-brand-text-muted">
                          {isSessionLoading ? (
                            "Cargando..."
                          ) : (
                            <>
                              {activeParticipants.length}{" "}
                              {activeParticipants.length === 1
                                ? "usuario activo"
                                : "usuarios activos"}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isSessionLoading ? (
                        <div className="rounded-xl border border-brand-border bg-slate-50 p-6 flex flex-col items-center justify-center min-h-30 animate-pulse">
                          <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                          <div className="h-3 w-48 bg-slate-200 rounded"></div>
                        </div>
                      ) : (
                        <>
                          {activeParticipants.map((participant, index) => (
                            <ActiveParticipantCard
                              key={participant.id}
                              participant={participant}
                              isResponsible={
                                participant.participationType === "responsible"
                              }
                              onSelect={() =>
                                handleActiveParticipantClick(participant)
                              }
                              index={index + 1}
                              avatar={getUserAvatar(participant.userId)}
                            />
                          ))}

                          {activeParticipants.length === 0 && (
                            <div className="rounded-xl border border-dashed border-brand-border bg-white p-8 text-center">
                              <UserRound className="mx-auto h-8 w-8 text-brand-text-muted" />

                              <p className="mt-2 font-medium text-brand-text">
                                No hay participantes activos
                              </p>

                              <p className="text-sm text-brand-text-muted">
                                Inicia una jornada o incorpórate como
                                participante.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>

                  {/* Join another user */}
                  <div
                    className="mt-6 animate-fade-in-up opacity-0"
                    style={{
                      animationDelay: `${(activeParticipants.length + 1) * 0.08}s`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <JoinAnotherUserCard
                      onClick={handleJoinClick}
                      index={activeParticipants.length + 1}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <Footer />

        {/* Modal */}
        <WorkstationAccessModal
          open={modalOpen}
          mode={modalMode}
          registeredUsers={registeredUsers}
          activeUserIds={activeParticipants.map((p) => p.userId)}
          preselectedUserId={preselectedUserId}
          onAccess={handleAccess}
          onJoin={handleJoin}
          onCancel={handleCancel}
          onVerifyPin={handleVerifyPin}
        />
      </div>
    </TerminalSessionProvider>
  );
}
