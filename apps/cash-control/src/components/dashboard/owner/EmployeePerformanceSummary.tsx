"use client";

import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { employeeActivityFromShift, employeeMetricsPlaceholder } from "./ownerDashboardMockData";

export function EmployeePerformanceSummary() {
  const activeEmployees = employeeActivityFromShift.filter(
    (employee) => employee.status === "active",
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Personal</h2>
          <p className="mt-1 text-sm text-slate-500">
            Empleados y participación en el turno
          </p>
        </div>
        <Link
          href="/shifts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
        >
          Administrar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" aria-hidden="true" />
          {activeEmployees.length} participante{activeEmployees.length === 1 ? "" : "s"} activo
          {activeEmployees.length === 1 ? "" : "s"} del turno
        </div>

        <div className="mt-3 space-y-2">
          {employeeActivityFromShift.map((employee) => (
            <div
              key={employee.userId}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {employee.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {employee.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {employee.systemRole === "owner" ? "Propietario" : "Empleado"}{" "}
                    · {employee.shiftRole === "shift_responsible" ? "Responsable" : "Operador"}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  employee.status === "active" ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    employee.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {employee.status === "active" ? "Activo" : "Inactivo"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
          <p className="text-xs text-slate-500">{employeeMetricsPlaceholder.label}</p>
        </div>
      </div>
    </section>
  );
}