"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus, UserRound, Clock, ArrowRight } from "lucide-react";
import { WorkstationAccessModal } from "./WorkstationAccessModal";
import { mockWorkstation, mockRegisteredUsers } from "./mockData";
import type { Participant } from "./types";
import { useMockSession } from "@/components/session/MockSessionContext";
import { Footer } from "@/components/layout/Footer";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ActiveParticipantCard({
  participant,
  isResponsible,
  onSelect,
  index,
}: {
  participant: Participant;
  isResponsible: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex w-full cursor-pointer items-center gap-4 rounded-xl border border-brand-border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-brand-primary-ring hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-primary-ring focus:ring-offset-2 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: "forwards" }}
    >
      {/* Indicador lateral para responsable */}
      {isResponsible && (
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-l-xl bg-brand-responsible" />
      )}

      {/* Avatar con iniciales */}
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-semibold text-sm ${
          isResponsible
            ? "bg-brand-responsible-soft text-brand-responsible"
            : "bg-brand-primary-soft text-brand-primary"
        }`}
      >
        {getInitials(participant.userName)}
      </div>

      {/* Información del participante */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-brand-text">{participant.userName}</p>
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
            {isResponsible ? "Responsable" : "Apoyo"} desde las {participant.startedAt}
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

function JoinAnotherUserCard({ onClick, index }: { onClick: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-brand-border bg-slate-900/5 p-5 text-left transition-all duration-200 hover:border-brand-primary hover:bg-brand-primary-soft/30 focus:outline-none focus:ring-2 focus:ring-brand-primary-ring focus:ring-offset-2 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: "forwards" }}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-surface text-brand-text-muted">
        <UserPlus className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-brand-text">Activar usuario</p>
        <p className="mt-0.5 text-sm text-brand-text-muted">
          Accede con una cuenta que aún no tiene participación activa en esta estación.
        </p>
      </div>
    </button>
  );
}

export function WorkstationPage() {
  const router = useRouter();
  const {
    participants,
    unlockSession,
  } = useMockSession();
  const [workstation] = useState(mockWorkstation);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"access" | "join">("access");
  const [preselectedUserId, setPreselectedUserId] = useState<string | null>(null);

  const activeParticipants = participants
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
      const user = mockRegisteredUsers.find((u) => u.userId === userId);
      if (!user) return;

      unlockSession({
        userId: user.userId,
        userName: user.userName,
        systemRole: user.systemRole,
        hasActiveParticipation: false,
      });
      setModalOpen(false);
      router.push("/");
    },
    [unlockSession, router],
  );

  const handleJoin = useCallback(
    (userId: string) => {
      const user = mockRegisteredUsers.find((u) => u.userId === userId);
      if (!user) return;

      unlockSession({
        userId: user.userId,
        userName: user.userName,
        systemRole: user.systemRole,
        hasActiveParticipation: false,
      });
      setModalOpen(false);
      router.push("/");
    },
    [unlockSession, router],
  );

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    setPreselectedUserId(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-brand-surface">
      {/* Header / Nav superior */}
      <nav className="border-b border-slate-800 bg-slate-900 animate-fade-in">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-white" />
            <div>
              <h1 className="text-xl font-bold text-white">Control de caja</h1>
              <p className="text-sm text-slate-400">Control de acceso de usuarios</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
              <span className="h-2 w-2 rounded-full bg-brand-responsible animate-pulse-soft" />
              Estación activa
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
              {activeParticipants.length} {activeParticipants.length === 1 ? "activo" : "activos"}
            </span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Active participants container */}
          <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-brand-text">
                    Control de usuarios
                  </h3>
                  <p className="mt-1 text-sm text-brand-text-muted">
                    {activeParticipants.length} {activeParticipants.length === 1 ? "usuario activo" : "usuarios activos"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {activeParticipants.map((participant, index) => (
                  <ActiveParticipantCard
                    key={participant.id}
                    participant={participant}
                    isResponsible={participant.participationType === "responsible"}
                    onSelect={() => handleActiveParticipantClick(participant)}
                    index={index + 1}
                  />
                ))}

                {activeParticipants.length === 0 && (
                  <div className="rounded-xl border border-dashed border-brand-border bg-white p-8 text-center">
                    <UserRound className="mx-auto h-8 w-8 text-brand-text-muted" />
                    <p className="mt-2 font-medium text-brand-text">No hay participantes activos</p>
                    <p className="text-sm text-brand-text-muted">Inicia una jornada o incorpórate como participante.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Join another user */}
            <div className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: `${(activeParticipants.length + 1) * 0.08}s`, animationFillMode: "forwards" }}>
              <JoinAnotherUserCard onClick={handleJoinClick} index={activeParticipants.length + 1} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {/* Modal */}
      <WorkstationAccessModal
        open={modalOpen}
        mode={modalMode}
        registeredUsers={mockRegisteredUsers}
        activeUserIds={activeParticipants.map((p) => p.userId)}
        preselectedUserId={preselectedUserId}
        onAccess={handleAccess}
        onJoin={handleJoin}
        onCancel={handleCancel}
      />
    </div>
  );
}