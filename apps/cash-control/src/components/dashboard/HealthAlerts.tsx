"use client";

import { AlertTriangle, Clock3, UserX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/formatters";
import { mockOperations } from "@/components/history/mockOperations";
import { useMockSession } from "@/components/session/MockSessionContext";

export function HealthAlerts() {
  const { authenticatedUser, hasActiveParticipation } = useMockSession();
  const isOwner = authenticatedUser?.systemRole === "owner";

  const pendingWithdrawals = mockOperations.filter(
    (operation) => operation.type === "retiro" && operation.status === "pendiente",
  );

  const pendingDeposits = mockOperations.filter(
    (operation) => operation.type === "deposito" && operation.status === "pendiente",
  );

  const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
    (total, operation) => total + operation.amount,
    0,
  );

  const pendingDepositsAmount = pendingDeposits.reduce(
    (total, operation) => total + operation.amount,
    0,
  );

  const userHasActiveParticipation = authenticatedUser
    ? hasActiveParticipation(authenticatedUser.userId)
    : false;

  // ── Employee: only operational alerts ──
  if (!isOwner) {
    const operationalAlerts: ReactNode[] = [];

    if (pendingWithdrawals.length > 0) {
      operationalAlerts.push(
        <div
          key="pending-withdrawals"
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                Tienes {pendingWithdrawals.length}{" "}
                {pendingWithdrawals.length === 1 ? "retiro pendiente" : "retiros pendientes"}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {formatCurrency(pendingWithdrawalsAmount)} por entregar.
              </p>
            </div>
          </div>
          <Link
            href="/pending-withdrawals"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            <Clock3 className="h-4 w-4" />
            Ver retiros pendientes
          </Link>
        </div>,
      );
    }

    if (pendingDeposits.length > 0) {
      operationalAlerts.push(
        <div
          key="pending-deposits"
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                Tienes {pendingDeposits.length}{" "}
                {pendingDeposits.length === 1 ? "depósito pendiente" : "depósitos pendientes"}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {formatCurrency(pendingDepositsAmount)} por confirmar.
              </p>
            </div>
          </div>
        </div>,
      );
    }

    if (!userHasActiveParticipation) {
      operationalAlerts.push(
        <div
          key="inactive-participation"
          className="flex items-start gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              Participación inactiva
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Activa tu participación desde el menú de usuario para registrar operaciones.
            </p>
          </div>
        </div>,
      );
    }

    if (operationalAlerts.length === 0) {
      return null;
    }

    return (
      <section className="space-y-4">
        {operationalAlerts.map((alert, index) => (
          <div
            key={index}
            className="rounded-xl border border-amber-200 bg-amber-50 p-5"
          >
            {alert}
          </div>
        ))}
      </section>
    );
  }

  // ── Owner: financial + operational alerts ──
  if (pendingWithdrawals.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div>
            <p className="font-semibold text-amber-900">
              Tienes {pendingWithdrawals.length}{" "}
              {pendingWithdrawals.length === 1 ? "retiro pendiente" : "retiros pendientes"}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {formatCurrency(pendingWithdrawalsAmount)} por entregar.
            </p>
          </div>
        </div>

        <Link
          href="/pending-withdrawals"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
        >
          <Clock3 className="h-4 w-4" />
          Ver retiros pendientes
        </Link>
      </div>
    </section>
  );
}