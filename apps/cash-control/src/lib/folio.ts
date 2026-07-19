import type { FolioStatus } from "@/types/folio";

export function getFolioStatus(value: string): FolioStatus {
  const normalizedValue = value.trim();

  if (normalizedValue === "") {
    return "empty";
  }

  if (normalizedValue === "12345") {
    return "duplicate";
  }

  return "available";
}