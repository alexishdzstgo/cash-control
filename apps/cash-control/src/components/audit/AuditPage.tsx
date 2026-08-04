"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  filterAuditOperations,
  getAuditSummary,
  type AuditFilters as AuditFilterState,
} from "@/lib/audit";
import type { Operation } from "@/types/operation";
import { AuditDetailsModal } from "./AuditDetailsModal";
import { AuditFilters } from "./AuditFilters";
import { AuditSummaryCards } from "./AuditSummaryCards";
import { AuditTable } from "./AuditTable";

const defaultFilters: AuditFilterState = {
  search: "",
  user: "todos",
  operationType: "todos",
  reason: "todos",
  date: "",
};

type AuditPageProps = {
  operations: Operation[];
};

export function AuditPage({ operations }: AuditPageProps) {
  const [filters, setFilters] = useState<AuditFilterState>(defaultFilters);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const summary = useMemo(() => getAuditSummary(operations), [operations]);
  const filteredOperations = useMemo(
    () => filterAuditOperations(operations, filters),
    [operations, filters],
  );

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Consulta las operaciones modificadas durante los turnos."
      />

      <div className="space-y-6">
        <AuditSummaryCards summary={summary} />

        <AuditFilters
          filters={filters}
          users={summary.correctionUsers}
          reasons={summary.correctionReasons}
          operationTypes={summary.operationTypes}
          dates={summary.availableDates}
          onChange={setFilters}
          onClear={() => setFilters(defaultFilters)}
        />

        <AuditTable
          operations={filteredOperations}
          onViewDetails={setSelectedOperation}
        />
      </div>

      <AuditDetailsModal
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
      />
    </div>
  );
}
