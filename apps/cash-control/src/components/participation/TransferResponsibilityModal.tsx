"use client";

import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui/button";

interface BankBalance {
  bank: string;
  account: string;
  balance: number;
}

interface TransferSummary {
  transferTime: string;
  cashOnHand: number;
  bankBalances: BankBalance[];
  pendingWithdrawals: { count: number; total: number };
  pendingDeposits: { count: number; total: number };
  editedOperations: number;
  operationsSinceLastTransfer: number;
}

interface TransferResponsibilityModalProps {
  isEnding: boolean;
  selectedParticipant: { userName: string; userId: string } | null | undefined;
  transferSummary: TransferSummary | null;
  transferPin: string;
  transferError: string;
  onClose: () => void;
  onPinChange: (pin: string) => void;
  onConfirm: () => void;
}

export function TransferResponsibilityModal({
  isEnding,
  selectedParticipant,
  transferSummary,
  transferPin,
  transferError,
  onClose,
  onPinChange,
  onConfirm,
}: TransferResponsibilityModalProps) {
  return (
    <ModalShell
      title="Transferir responsabilidad"
      description="Confirma la entrega del turno con el PIN del nuevo responsable."
      onClose={onClose}
      closeOnOverlayClick
      maxWidth="sm"
      labelledById="transfer-responsibility-title"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isEnding}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <Button
            onClick={onConfirm}
            disabled={isEnding || transferPin.length !== 4}
            className="gap-2"
          >
            {isEnding ? "Transfiriendo..." : "Aceptar responsabilidad"}
          </Button>
        </div>
      }
    >
      {selectedParticipant && (
        <>
          {transferSummary ? (
            <>
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Resumen de entrega
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Responsable actual:</span>
                    <span className="font-medium text-slate-900">
                      {transferSummary.transferTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nuevo responsable:</span>
                    <span className="font-medium text-slate-900">
                      {selectedParticipant.userName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Hora de entrega:</span>
                    <span className="font-medium text-slate-900">
                      {transferSummary.transferTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Caja física
                </h3>
                <p className="text-lg font-semibold text-slate-900">
                  $
                  {transferSummary.cashOnHand.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Saldos bancarios
                </h3>
                <div className="space-y-2">
                  {transferSummary.bankBalances.map((bank) => (
                    <div
                      key={`${bank.bank}-${bank.account}`}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-slate-600">
                        {bank.bank} {bank.account}
                      </span>
                      <span className="font-medium text-slate-900">
                        $
                        {bank.balance.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-amber-700 mb-1">
                    Retiros pendientes
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {transferSummary.pendingWithdrawals.count} operaciones
                  </p>
                  <p className="text-xs text-slate-600">
                    $
                    {transferSummary.pendingWithdrawals.total.toLocaleString(
                      "es-MX",
                      { minimumFractionDigits: 2 },
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700 mb-1">
                    Depósitos pendientes
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {transferSummary.pendingDeposits.count} operaciones
                  </p>
                  <p className="text-xs text-slate-600">
                    $
                    {transferSummary.pendingDeposits.total.toLocaleString(
                      "es-MX",
                      { minimumFractionDigits: 2 },
                    )}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">
                  Información adicional
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Operaciones editadas:
                    </span>
                    <span className="font-medium text-slate-900">
                      {transferSummary.editedOperations}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Operaciones desde última transferencia:
                    </span>
                    <span className="font-medium text-slate-900">
                      {transferSummary.operationsSinceLastTransfer}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nuevo responsable
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {selectedParticipant.userName} será el nuevo responsable del
                turno.
              </p>
            </div>
          )}

          <div className="mb-4 rounded-lg border border-blue-200 border-l-4 border-l-[#2563EB] bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {selectedParticipant.userName}, ingresa tu PIN para aceptar la
              responsabilidad de esta estación.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Confirma que recibes la responsabilidad del turno.
            </p>
          </div>

          <div className="mb-4">
            <input
              type="password"
              maxLength={4}
              value={transferPin}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="PIN del receptor"
              className="field-input text-center text-2xl tracking-widest"
            />
          </div>

          {transferError && (
            <p className="mb-4 text-sm text-red-600">{transferError}</p>
          )}
        </>
      )}
    </ModalShell>
  );
}
