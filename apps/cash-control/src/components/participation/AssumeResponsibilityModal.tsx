"use client";

import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";

interface AssumeResponsibilityModalProps {
    isAssuming: boolean;
    assumePin: string;
    assumeError: string;
    onClose: () => void;
    onPinChange: (pin: string) => void;
    onConfirm: () => void;
    userName: string;
}

export function AssumeResponsibilityModal({
    isAssuming,
    assumePin,
    assumeError,
    onClose,
    onPinChange,
    onConfirm,
    userName,
}: AssumeResponsibilityModalProps) {
    return (
        <ModalShell
            title="Asumir responsabilidad"
            description="Ingresa tu PIN para asumir la responsabilidad del turno."
            onClose={onClose}
            closeOnOverlayClick
            maxWidth="sm"
            labelledById="assume-responsibility-title"
            footer={
                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isAssuming}
                        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <Button
                        onClick={onConfirm}
                        disabled={isAssuming || assumePin.length !== 4}
                        className="gap-2"
                    >
                        {isAssuming ? "Asumiendo..." : "Asumir"}
                    </Button>
                </div>
            }
        >
            <div className="mb-4 rounded-lg border border-blue-200 border-l-4 border-l-brand-primary bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                    Hola {userName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                    Actualmente el equipo no cuenta con un responsable. Ingresa tu PIN de 4 dígitos para asumir la responsabilidad.
                </p>
            </div>

            <div className="mb-4">
                <input
                    type="password"
                    maxLength={4}
                    value={assumePin}
                    onChange={(e) => onPinChange(e.target.value)}
                    placeholder="PIN numérico"
                    className="field-input text-center text-2xl tracking-widest"
                />
            </div>

            {assumeError && (
                <p className="mb-4 text-sm text-red-600">{assumeError}</p>
            )}
        </ModalShell>
    );
}
