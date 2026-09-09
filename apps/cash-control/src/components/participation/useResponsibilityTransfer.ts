"use client";

import { useCallback, useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useMockSession } from "@/components/session/MockSessionContext";
import { useShift } from "@/components/shifts/ShiftContext";
import type { Participant } from "@/components/workstation/types";
import {
  buildTransferSummary,
  type TransferSummary,
} from "@/lib/transferSummary";

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
  handleTransferConfirm: () => void;
}

export function useResponsibilityTransfer(): UseResponsibilityTransferReturn {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferUser, setSelectedTransferUser] =
    useState<Participant | null>(null);
  const [transferPin, setTransferPin] = useState("");
  const [transferError, setTransferError] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  const {
    participants,
    transferResponsibility,
    addActivityEvent,
    authenticatedUser,
  } = useMockSession();

  const openTransfer = useCallback(
    (userId: string) => {
      const participant = participants.find(
        (p) => p.userId === userId && p.status === "active",
      );
      if (participant) {
        setSelectedTransferUser(participant);
        setTransferPin("");
        setTransferError("");
        setShowTransferModal(true);
      }
    },
    [participants],
  );

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
      transferPin,
    );

    if (result.success) {
      const fromUserName = authenticatedUser.userName;
      const toUserName = selectedTransferUser.userName;
      addActivityEvent(
        `${fromUserName} entregó la responsabilidad del turno a ${toUserName}.`,
      );
      closeTransfer();
    } else {
      setTransferError(result.error || "Error al transferir responsabilidad");
      setIsEnding(false);
    }
  }, [
    authenticatedUser,
    selectedTransferUser,
    transferPin,
    transferResponsibility,
    addActivityEvent,
    closeTransfer,
  ]);

  const { currentShift } = useShift();
  const { cash, banks, operations } = useBusinessFunds();
  const transferSummary = showTransferModal
    ? buildTransferSummary({
        currentShift,
        cash,
        banks,
        operations,
        participants,
      })
    : null;

  return {
    transferSummary,
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
