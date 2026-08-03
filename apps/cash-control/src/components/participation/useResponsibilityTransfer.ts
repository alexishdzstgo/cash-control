"use client";

import { useState, useCallback } from "react";
import { useMockSession } from "@/components/session/MockSessionContext";
import type { Participant } from "@/components/workstation/types";

export interface UseResponsibilityTransferReturn {
  showTransferModal: boolean;
  selectedTransferUser: Participant | null;
  transferPin: string;
  transferError: string;
  isEnding: boolean;
  openTransfer: (userId: string) => void;
  closeTransfer: () => void;
  handlePinChange: (pin: string) => void;
  handleTransferConfirm: () => void;
}

export function useResponsibilityTransfer(): UseResponsibilityTransferReturn {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferUser, setSelectedTransferUser] = useState<Participant | null>(null);
  const [transferPin, setTransferPin] = useState("");
  const [transferError, setTransferError] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  const { participants, transferResponsibility, addActivityEvent, authenticatedUser } = useMockSession();

  const openTransfer = useCallback((userId: string) => {
    const participant = participants.find((p) => p.userId === userId && p.status === "active");
    if (participant) {
      setSelectedTransferUser(participant);
      setTransferPin("");
      setTransferError("");
      setShowTransferModal(true);
    }
  }, [participants]);

  const closeTransfer = useCallback(() => {
    setShowTransferModal(false);
    setSelectedTransferUser(null);
    setTransferPin("");
    setTransferError("");
    setIsEnding(false);
  }, []);

  const handlePinChange = useCallback((pin: string) => {
    setTransferPin(pin);
    setTransferError("");
  }, []);

  const handleTransferConfirm = useCallback(() => {
    if (!authenticatedUser || !selectedTransferUser) return;

    setIsEnding(true);
    const result = transferResponsibility(
      authenticatedUser.userId,
      selectedTransferUser.userId,
      transferPin
    );

    if (result.success) {
      const fromUserName = authenticatedUser.userName;
      const toUserName = selectedTransferUser.userName;
      addActivityEvent(`${fromUserName} entregó la responsabilidad del turno a ${toUserName}.`);
      closeTransfer();
    } else {
      setTransferError(result.error || "Error al transferir responsabilidad");
      setIsEnding(false);
    }
  }, [authenticatedUser, selectedTransferUser, transferPin, transferResponsibility, addActivityEvent, closeTransfer]);

  return {
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