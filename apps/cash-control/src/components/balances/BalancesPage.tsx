"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBusinessFunds } from "@/components/business-funds/BusinessFundsContext";
import { PageHeader } from "@/components/shared/PageHeader";
import type { BankAccountBalance, ReservedOperation } from "@/types/balance";
import { BalanceSummary } from "./BalanceSummary";
import { BankAccountsList } from "./BankAccountsList";
import { CashBalanceCard } from "./CashBalanceCard";
import { ReservedFundsModal } from "./ReservedFundsModal";

type ModalState =
  | { type: "cash"; operations: ReservedOperation[] }
  | {
      type: "bank";
      account: BankAccountBalance;
      operations: ReservedOperation[];
    }
  | null;

export function BalancesPage() {
  const { cash, banks } = useBusinessFunds();
  const [modalState, setModalState] = useState<ModalState>(null);

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

  return (
    <div>
      <PageHeader
        title="Caja y bancos"
        description="¿Dónde está mi dinero? Consulta el efectivo y los saldos bancarios disponibles para operar."
        action={
          <Link href="/business-funds" className="btn-secondary">
            Ver movimientos de fondos
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="space-y-8">
        <BalanceSummary cash={cash} banks={banks} />

        <CashBalanceCard cash={cash} onViewReserved={handleViewCashReserved} />

        <BankAccountsList
          accounts={banks}
          onViewReserved={handleViewBankReserved}
        />
      </div>

      <ReservedFundsModal
        isOpen={isModalOpen}
        onClose={() => setModalState(null)}
        resourceName={modalResourceName}
        resourceType={modalResourceType}
        operations={modalOperations}
      />
    </div>
  );
}
