"use client";

import {
  ChevronDown,
  Circle,

  LogOut,
  ShieldCheck,

  KeyRound,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,

  UserCheck,
  UserPlus,
  UserRound,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";

import { UserAvatar } from "@/components/shared/UserAvatar";


import { EndParticipationModal } from "./EndParticipationModal";
import { TransferResponsibilityModal } from "./TransferResponsibilityModal";
import { useResponsibilityTransfer } from "./useResponsibilityTransfer";

export function UserParticipationMenu() {
  const router = useRouter();
  const {
    authenticatedUser,
    getUserAvatar,
    participants,
    startParticipation,
    endParticipation,
    lockSession,
    updateAuthenticatedUser,
    getActiveParticipants,
    addActivityEvent,
    getTransferSummary,
    canEndOwnParticipation,
    isCurrentUserResponsible,
  } = useMockSession();

  const [isOpen, setIsOpen] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const {
    showTransferModal,
    selectedTransferUser,
    transferPin,
    transferError,
    isEnding: isTransferEnding,
    openTransfer,
    closeTransfer,
    handlePinChange,
    handleTransferConfirm,
  } = useResponsibilityTransfer();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Derived state - handle null user safely
  const activeParticipation = authenticatedUser
    ? participants.find(
        (p) => p.userId === authenticatedUser.userId && p.status === "active",
      )
    : undefined;

  const isResponsible = isCurrentUserResponsible();
  const activeParticipants = getActiveParticipants();
  const otherActiveParticipants = activeParticipants.filter(
    (p) => p.userId !== authenticatedUser?.userId,
  );

  const transferSummary = getTransferSummary();
  const selectedParticipant = selectedTransferUser
    ? participants.find((p) => p.userId === selectedTransferUser.userId)
    : null;

  const getStatusText = () => {
    if (!activeParticipation) return "Sin participación";
    if (isResponsible) return "Responsable del turno";
    return "Participación activa";
  };

  const getStatusIcon = () => {
    if (!activeParticipation) return UserX;
    if (isResponsible) return ShieldCheck;
    return UserCheck;
  };

  const StatusIcon = getStatusIcon();
  const currentUserAvatar = getUserAvatar(authenticatedUser?.userId ?? "");

  const handleStartParticipation = useCallback(() => {
    if (authenticatedUser) {
      startParticipation(authenticatedUser.userId);
      updateAuthenticatedUser({ hasActiveParticipation: true });
      setIsOpen(false);
    }
  }, [authenticatedUser, startParticipation, updateAuthenticatedUser]);

  const handleLockSession = useCallback(() => {
    setIsOpen(false);
    setShowEndModal(false);
    closeTransfer();
    lockSession();
    router.push("/workstation");
  }, [lockSession, router, closeTransfer]);

  const handleProfileNavigation = useCallback(
    (href: string) => {
      setIsOpen(false);
      router.push(href);
    },
    [router],
  );

  const handleEndParticipation = useCallback(async () => {
    if (!authenticatedUser) return;

    setIsEnding(true);
    const result = endParticipation(authenticatedUser.userId);

    if (result.success) {
      setShowEndModal(false);
      addActivityEvent(
        `${authenticatedUser.userName} finalizó su participación`,
      );
      setIsOpen(false);
    } else if (result.isResponsible) {
      setShowEndModal(false);
      if (result.isOnlyParticipant) {
        alert(
          "No puedes finalizar tu participación siendo el único participante activo. Debes iniciar a otro participante o cerrar la estación.",
        );
      } else {
        alert(
          "No puedes finalizar tu participación mientras seas responsable. Primero debes transferir la responsabilidad a otro participante activo.",
        );
      }
    }

    setIsEnding(false);
  }, [authenticatedUser, endParticipation, addActivityEvent]);

  const handleTransferClick = useCallback(
    (userId: string) => {
      setShowEndModal(false);
      openTransfer(userId);
      setIsOpen(false);
    },
    [openTransfer],
  );

  // Determine header background class based on participation type
  const getHeaderBgClass = () => {
    if (!activeParticipation) return "bg-slate-50";
    if (isResponsible) return "bg-brand-responsible-soft";
    return "bg-brand-support-soft";
  };

  const getHeaderBorderClass = () => {
    if (!activeParticipation) return "border-slate-200";
    if (isResponsible) return "border-brand-responsible-border";
    return "border-brand-support-border";
  };

  const getStatusTextColor = () => {
    if (!activeParticipation) return "text-slate-600";
    if (isResponsible) return "text-brand-responsible";
    return "text-emerald-600";
  };

  const getStatusIconColor = () => {
    if (!activeParticipation) return "text-slate-500";
    if (isResponsible) return "text-brand-responsible";
    return "text-emerald-500";
  };

  const getRoleBadgeColor = () => {
    if (!activeParticipation) return "";
    if (isResponsible) return "text-brand-responsible";
    return "text-emerald-600";
  };

  // Only render if authenticated
  if (!authenticatedUser) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
          activeParticipation ? "border-emerald-200" : "border-slate-200"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >

        <UserAvatar
          name={authenticatedUser.userName}
          avatar={currentUserAvatar}
          size="sm"
          className={
            activeParticipation
              ? "ring-2 ring-emerald-100"
              : "ring-2 ring-brand-primary-soft"
          }
        />

        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            activeParticipation
              ? "bg-emerald-100 text-emerald-700"
              : "bg-brand-primary-soft text-brand-primary"
          }`}
        >
          <UserRound className="h-4 w-4" />
        </div>

        <span className="hidden md:inline">{authenticatedUser.userName}</span>
        {activeParticipation && (
          <span className="hidden lg:inline-flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
            <span className="text-emerald-700 font-medium">
              {getStatusText()}
            </span>
          </span>
        )}
        {!activeParticipation && (
          <span className="hidden lg:inline text-slate-500">•</span>
        )}
        {!activeParticipation && (
          <span className="hidden lg:inline text-slate-600">
            {getStatusText()}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border bg-white shadow-lg ${getHeaderBgClass()} ${getHeaderBorderClass()}`}
          role="menu"
        >
          {/* Header */}
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={authenticatedUser.userName}
                avatar={currentUserAvatar}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {authenticatedUser.userName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {activeParticipation ? (
                    <Circle
                      className={`h-3 w-3 fill-current ${getStatusIconColor()}`}
                    />
                  ) : (
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${getStatusIconColor()}`}
                    />
                  )}
                  <p className={`text-xs font-medium ${getStatusTextColor()}`}>
                    {getStatusText()}
                  </p>
                </div>
                {activeParticipation && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Iniciada a las {activeParticipation.startedAt}
                  </p>
                )}
              </div>
            </div>
            {activeParticipation && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                {isResponsible ? (
                  <>
                    <ShieldCheck
                      className={`h-3.5 w-3.5 ${getRoleBadgeColor()}`}
                    />
                    <span className={`font-medium ${getRoleBadgeColor()}`}>
                      Responsable
                    </span>
                  </>
                ) : (
                  <>
                    <UserRound
                      className={`h-3.5 w-3.5 ${getRoleBadgeColor()}`}
                    />
                    <span className={`font-medium ${getRoleBadgeColor()}`}>
                      Apoyo
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-2">
            {!activeParticipation ? (
              <button
                type="button"
                onClick={handleStartParticipation}
                className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 transition hover:bg-emerald-100 animate-pulse-subtle"
                role="menuitem"
              >
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Activar participación
              </button>
            ) : canEndOwnParticipation() ? (
              <button
                type="button"
                onClick={() => {
                  closeTransfer();
                  setShowEndModal(true);
                }}
                className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
              >
                <UserX className="h-4 w-4 text-red-600" />
                Finalizar participación
              </button>
            ) : otherActiveParticipants.length > 0 ? (
              <div className="space-y-1">
                <p className="px-3 py-1.5 text-xs font-medium text-slate-500">
                  Transferir responsabilidad a:
                </p>
                {otherActiveParticipants.map((participant) => (
                  <button
                    key={participant.userId}
                    type="button"
                    onClick={() => handleTransferClick(participant.userId)}
                    className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                  >
                    <UserPlus className="h-4 w-4 text-brand-primary" />
                    {participant.userName}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2">
                <p className="text-xs text-slate-600">
                  Activa a otro usuario antes de transferir la responsabilidad.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/workstation");
                  }}
                  className="mt-2 text-xs font-medium text-brand-primary hover:underline"
                >
                  Activar usuario
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => handleProfileNavigation("/profile")}
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              role="menuitem"
            >
              <UserRound className="h-4 w-4" />
              Mi perfil
            </button>

            <button
              type="button"
              onClick={() =>
                handleProfileNavigation("/profile?section=security")
              }
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              role="menuitem"
            >
              <KeyRound className="h-4 w-4" />
              Cambiar contraseña
            </button>
            <button
              type="button"
              onClick={() =>
                handleProfileNavigation("/profile?section=preferences")
              }
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              role="menuitem"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Preferencias
            </button>

          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={handleLockSession}
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {showEndModal && (
        <EndParticipationModal
          isEnding={isEnding}
          onClose={() => setShowEndModal(false)}
          onConfirm={handleEndParticipation}
        />
      )}

      {showTransferModal && selectedTransferUser && selectedParticipant && (
        <TransferResponsibilityModal
          isEnding={isTransferEnding}
          selectedParticipant={selectedParticipant}
          transferSummary={transferSummary}
          transferPin={transferPin}
          transferError={transferError}
          onClose={closeTransfer}
          onPinChange={handlePinChange}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}
