"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { useShift } from "@/components/shifts/ShiftContext";
import { PageHeader } from "@/components/shared/PageHeader";
import type { BankAccountBalance, ReservedOperation } from "@/types/balance";
import { BalanceSummary } from "./BalanceSummary";
import { BankAccountsList } from "./BankAccountsList";
import { BankAccountFormModal, type BankAccountRow } from "./ManageBankAccountsModal";
import { CashBalanceCard } from "./CashBalanceCard";
import { ReservedFundsModal } from "./ReservedFundsModal";
import { useNotification } from "@/components/shared/NotificationProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type ModalState =
  | { type: "cash"; operations: ReservedOperation[] }
  | {
    type: "bank";
    account: BankAccountBalance;
    operations: ReservedOperation[];
  }
  | null;

export function BalancesPage() {
  const { cash, banks, refreshBanks } = useBusinessFunds();
  const { currentShift } = useShift();
  const [modalState, setModalState] = useState<ModalState>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccountRow | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccountBalance | null>(null);
  const { showSuccess, showError } = useNotification();

  const handleViewCashReserved = () => {
    setModalState({
      type: "cash",
      operations: cash.reservedOperations,
    });
  };

  const handleViewBankReserved = (account: BankAccountBalance) => {
    setModalState({
      type: "bank",
      account,
      operations: account.reservedOperations,
    });
  };

  const isModalOpen = modalState !== null;
  const modalResourceName =
    modalState?.type === "cash"
      ? "Caja física"
      : modalState?.type === "bank"
        ? modalState.account.bankName
        : "";
  const modalResourceType = modalState?.type ?? "cash";
  const modalOperations = modalState?.operations ?? [];

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      const res = await fetch(`/api/banks/${accountToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo eliminar la cuenta.");
      }
      showSuccess("Cuenta bancaria eliminada correctamente.");
      await refreshBanks();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Error al conectarse con el servidor");
    } finally {
      setAccountToDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Caja y bancos"
        description="¿Dónde está mi dinero? Consulta el efectivo y los saldos bancarios disponibles para operar."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary shadow-sm"
              onClick={() => {
                setAccountToEdit(null);
                setIsManageModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar banco
            </button>
            <Link href="/business-funds" className="btn-secondary">
              Ver movimientos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="space-y-8">
        <BalanceSummary cash={cash} banks={banks} />

        <CashBalanceCard cash={cash} onViewReserved={handleViewCashReserved} />

        <BankAccountsList
          accounts={banks}
          onViewReserved={handleViewBankReserved}
          onToggleStatus={async (account) => {
            if (account.status === "available" && currentShift) {
              showError("Nota: Un banco no puede ser desactivado mientras exista un turno activo.");
              return;
            }
            const newStatus = account.status === "available" ? "inactive" : "active";
            try {
              const res = await fetch(`/api/banks/${account.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
              });
              if (!res.ok) throw new Error();
              showSuccess(`Estado cambiado a ${newStatus === "active" ? "Activo" : "Inactivo"}`);
              await refreshBanks();
            } catch (e) {
              showError("No se pudo cambiar el estado de la cuenta");
            }
          }}
          onEdit={(account) => {
            setAccountToEdit({
              id: account.id,
              accountName: account.rawAccountName,
              accountLastDigits: account.rawAccountLastDigits,
              realBalance: account.realBalance
            });
            setIsManageModalOpen(true);
          }}
          onDelete={(account) => setAccountToDelete(account)}
        />
      </div>

      <ReservedFundsModal
        isOpen={isModalOpen}
        onClose={() => setModalState(null)}
        resourceName={modalResourceName}
        resourceType={modalResourceType}
        operations={modalOperations}
      />

      <BankAccountFormModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        accountToEdit={accountToEdit}
      />

      <ConfirmDialog
        isOpen={accountToDelete !== null}
        title="Eliminar cuenta bancaria"
        description={`¿Estás seguro de que deseas eliminar permanentemente la cuenta "${accountToDelete?.bankName} - ${accountToDelete?.accountName}"? Esta acción no se puede deshacer y podría afectar el historial si tiene operaciones asociadas.`}
        confirmLabel="Eliminar cuenta"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setAccountToDelete(null)}
      />
    </div>
  );
}
