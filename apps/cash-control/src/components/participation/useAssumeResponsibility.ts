"use client";

import { useCallback, useState } from "react";
import type { Participant } from "@/components/workstation/types";

export interface UseAssumeResponsibilityReturn {
    showAssumeModal: boolean;
    assumePin: string;
    assumeError: string;
    isAssuming: boolean;
    openAssume: () => void;
    closeAssume: () => void;
    handlePinChange: (pin: string) => void;
    handleAssumeConfirm: () => Promise<void>;
}

export function useAssumeResponsibility(
    userId: string,
    refreshParticipants: () => Promise<void> = async () => { },
): UseAssumeResponsibilityReturn {
    const [showAssumeModal, setShowAssumeModal] = useState(false);
    const [assumePin, setAssumePin] = useState("");
    const [assumeError, setAssumeError] = useState("");
    const [isAssuming, setIsAssuming] = useState(false);

    const openAssume = useCallback(() => {
        setAssumePin("");
        setAssumeError("");
        setShowAssumeModal(true);
    }, []);

    const closeAssume = useCallback(() => {
        if (isAssuming) return;
        setShowAssumeModal(false);
        setAssumePin("");
        setAssumeError("");
    }, [isAssuming]);

    const handlePinChange = useCallback((pin: string) => {
        setAssumePin(pin.replace(/\D/g, "").slice(0, 4));
        setAssumeError("");
    }, []);

    const handleAssumeConfirm = useCallback(async () => {
        if (!/^\d{4}$/.test(assumePin)) {
            setAssumeError("Ingresa un PIN de exactamente 4 dígitos.");
            return;
        }

        setIsAssuming(true);
        setAssumeError("");

        try {
            const response = await fetch(
                "/api/workstation/assign-responsibility",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pin: assumePin,
                        userId,
                    }),
                },
            );

            const result = await response.json();

            if (!response.ok || !result.ok) {
                setAssumeError(
                    result.error ?? "No se pudo asumir la responsabilidad.",
                );
                return;
            }

            await refreshParticipants();

            setShowAssumeModal(false);
            setAssumePin("");
            setAssumeError("");
        } catch (error) {
            console.error("Error asumiendo responsabilidad:", error);
            setAssumeError("No se pudo conectar con el servidor.");
        } finally {
            setIsAssuming(false);
        }
    }, [assumePin, refreshParticipants]);

    return {
        showAssumeModal,
        assumePin,
        assumeError,
        isAssuming,
        openAssume,
        closeAssume,
        handlePinChange,
        handleAssumeConfirm,
    };
}
