import type { CashClosingData } from "@/types/cash-closing";

export const mockCashClosingData: CashClosingData = {
  shift: {
    id: "shift-morning-001",
    name: "Turno matutino",
    responsibleName: "Ana López",
    startedAt: "Hoy, 8:00 a. m.",
    scheduledEndAt: "Hoy, 4:00 p. m.",
    currentDuration: "7 h 42 min",
  },
  openingBalance: 0,
  reservedCash: 0,
  movements: [],
};
