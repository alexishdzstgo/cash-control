"use client";

import { useMemo, useState } from "react";
import type {
  Operation,
  OperationStatus,
  OperationType,
} from "@/types/operation";

const DEFAULT_PAGE_SIZE = 10;

export function useOperationsHistory(operations: Operation[]) {
  const [operationList, setOperationList] = useState<Operation[]>(operations);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | OperationStatus
  >("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | OperationType>(
    "todos",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOperation, setSelectedOperation] =
    useState<Operation | null>(null);

  const filteredOperations = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    const startDate = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;

    const endDate = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    return operationList

      .filter((operation) => {
        const operationDate = new Date(operation.createdAt).getTime();

        const matchesSearch =
          operation.bankFolio.toLowerCase().includes(normalizedSearch) ||
          operation.senderName.toLowerCase().includes(normalizedSearch) ||
          operation.receiverName.toLowerCase().includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "todos" || operation.status === statusFilter;

        const matchesType =
          typeFilter === "todos" || operation.type === typeFilter;

        const matchesStartDate =
          startDate === null || operationDate >= startDate;

        const matchesEndDate =
          endDate === null || operationDate <= endDate;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesType &&
          matchesStartDate &&
          matchesEndDate
        );
      })
      .sort(
        (firstOperation, secondOperation) =>
          new Date(secondOperation.createdAt).getTime() -
          new Date(firstOperation.createdAt).getTime(),
      );
  }, [
    operationList,
    search,
    dateFrom,
    dateTo,
    statusFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOperations.length / DEFAULT_PAGE_SIZE),
  );

  const paginatedOperations = useMemo(() => {
    const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    const endIndex = startIndex + DEFAULT_PAGE_SIZE;

    return filteredOperations.slice(startIndex, endIndex);
  }, [filteredOperations, currentPage]);

  function updateSearch(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function updateDateFrom(value: string) {
    setDateFrom(value);
    setCurrentPage(1);
  }

  function updateDateTo(value: string) {
    setDateTo(value);
    setCurrentPage(1);
  }

  function updateStatusFilter(value: "todos" | OperationStatus) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function updateTypeFilter(value: "todos" | OperationType) {
    setTypeFilter(value);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("todos");
    setTypeFilter("todos");
    setCurrentPage(1);
  }
  function markAsDelivered(operationId: string) {
  setOperationList((currentOperations) =>
    currentOperations.map((operation) =>
      operation.id === operationId
        ? {
            ...operation,
            status: "entregado",
          }
        : operation,
    ),
  );

  setSelectedOperation((currentOperation) =>
    currentOperation?.id === operationId
      ? {
          ...currentOperation,
          status: "entregado",
        }
      : currentOperation,
  );
}

return {
  search,
  dateFrom,
  dateTo,
  statusFilter,
  typeFilter,
  currentPage,
  selectedOperation,

  filteredOperations,
  paginatedOperations,
  totalPages,
  pageSize: DEFAULT_PAGE_SIZE,

  setCurrentPage,
  setSelectedOperation,

  updateSearch,
  updateDateFrom,
  updateDateTo,
  updateStatusFilter,
  updateTypeFilter,
  clearFilters,
  markAsDelivered,
};
}