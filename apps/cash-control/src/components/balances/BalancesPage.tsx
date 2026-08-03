"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { BalanceSummary } from "./BalanceSummary";
import { CashBalanceCard } from "./CashBalanceCard";
import { BankAccountsList } from "./BankAccountsList";
import { ReservedFundsModal } from "./ReservedFundsModal";
import { cashBalance, bankAccounts } from "./balanceMockData";
import type { BankAccountBalance, ReservedOperation } from "@/types/balance";

type ModalState =
  | { type: "cash"; operations: ReservedOperation[] }
  | { type: "bank"; account: BankAccountBalance; operations: ReservedOperation[] }
  | null;

export function BalancesPage() {
  const [modalState, setModalState] = useState<ModalState>(null);

  const handleViewCashReserved = () => {
    setModalState({
      type: "cash",
      operations: cashBalance.reservedOperations,
    });
  };

  const handleViewBankReserved = (account: BankAccountBalance) => {
    setModalState({
      type: "bank",
      account,
      operations: account.reservedOperations,
    });
  };

  const handleCloseModal = () => {
    setModalState(null);
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

  return (
    <div>
      <PageHeader
        title="Caja y bancos"
        description="¿Dónde está mi dinero? Consulta el efectivo y los saldos bancarios disponibles para operar."
      />

      <div className="space-y-8">
        <BalanceSummary cash={cashBalance} banks={bankAccounts} />

        <CashBalanceCard
          cash={cashBalance}
          onViewReserved={handleViewCashReserved}
        />

        <BankAccountsList
          accounts={bankAccounts}
          onViewReserved={handleViewBankReserved}
        />
      </div>

      <ReservedFundsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        resourceName={modalResourceName}
        resourceType={modalResourceType}
        operations={modalOperations}
      />
    </div>
  );
}