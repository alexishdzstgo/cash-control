"use client";

import { useState } from "react";
import { DepositForm } from "./DepositForm";
import { DepositSummary } from "./DepositSummary";

export function DepositPage() {
  const [folioStatus, setFolioStatus] = useState<
    "empty" | "duplicate" | "available"
  >("empty");

  const isReadyToRegister = folioStatus === "available";

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-blue-600">Depósitos</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">
          Nuevo depósito
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Registra la entrega de efectivo de un depósito previamente validado en
          la aplicación bancaria.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DepositForm onFolioStatusChange={setFolioStatus} />
        <DepositSummary isReadyToRegister={isReadyToRegister} />
      </div>
    </div>
  );
}