
"use client";

import { useCallback, useState } from "react";
import type { Participant } from "@/components/workstation/types";
import type { TransferSummary } from "@/lib/transferSummary";

export interface UseResponsibilityTransferReturn {
  transferSummary: TransferSummary | null;
  showTransferModal: boolean;
  selectedTransferUser: Participant | null;
  transferPin: string;
  transferError: string;
  isEnding: boolean;
  openTransfer: (userId: string) => void;
  closeTransfer: () => void;
  handlePinChange: (pin: string) => void;
  handleTransferConfirm: () => Promise<void>;
}

export function useResponsibilityTransfer(
  participants: Participant[] = [],
  refreshParticipants: () => Promise<void> = async () => {},
): UseResponsibilityTransferReturn {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferUser, setSelectedTransferUser] =
    useState<Participant | null>(null);
  const [transferPin, setTransferPin] = useState("");
  const [transferError, setTransferError] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  const openTransfer = useCallback(
    (userId: string) => {
      const participant = participants.find(
        (p) => p.userId === userId && p.status === "active",
      );

      if (!participant) {
        setTransferError("El usuario no tiene una participación activa.");
        return;
      }

      setSelectedTransferUser(participant);
      setTransferPin("");
      setTransferError("");
      setShowTransferModal(true);
    },
    [participants],
  );

  const closeTransfer = useCallback(() => {
    if (isEnding) return;

    setShowTransferModal(false);
    setSelectedTransferUser(null);
    setTransferPin("");
    setTransferError("");
  }, [isEnding]);

  const handlePinChange = useCallback((pin: string) => {
    setTransferPin(pin.replace(/\D/g, "").slice(0, 4));
    setTransferError("");
  }, []);

  const handleTransferConfirm = useCallback(async () => {
    if (!selectedTransferUser) {
      setTransferError("Selecciona al nuevo responsable.");
      return;
    }

    if (!/^\d{4}$/.test(transferPin)) {
      setTransferError("Ingresa un PIN de exactamente 4 dígitos.");
      return;
    }

    setIsEnding(true);
    setTransferError("");

    try {
      const response = await fetch(
        "/api/workstation/transfer-responsibility",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newResponsibleMemberId: selectedTransferUser.userId,
            receiverPin: transferPin,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setTransferError(
          result.error ?? "No se pudo transferir la responsabilidad.",
        );
        return;
      }

      await refreshParticipants();

      setShowTransferModal(false);
      setSelectedTransferUser(null);
      setTransferPin("");
      setTransferError("");
    } catch (error) {
      console.error("Error transfiriendo responsabilidad:", error);
      setTransferError("No se pudo conectar con el servidor.");
    } finally {
      setIsEnding(false);
    }
  }, [selectedTransferUser, transferPin, refreshParticipants]);

  return {
    transferSummary: null,
    showTransferModal,
    selectedTransferUser,
    transferPin,
    transferError,
    isEnding,
    openTransfer,
    closeTransfer,
    handlePinChange,
    handleTransferConfirm,
  };
}