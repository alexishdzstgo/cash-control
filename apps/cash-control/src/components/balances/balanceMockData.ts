import type { BankAccountBalance, CashBalance } from "@/types/balance";

export const cashBalance: CashBalance = {
  physicalBalance: 12450,
  lowBalanceThreshold: 3000,
  criticalBalanceThreshold: 1000,
  reservedOperations: [
    {
      id: "withdrawal-1",
      folio: "RET-00125",
      type: "retiro",
      customerName: "Carlos Gómez",
      amount: 2000,
      registeredAt: "Hoy, 9:15 a. m.",
      registeredBy: "Ana López",
      status: "pending",
    },
    {
      id: "withdrawal-2",
      folio: "RET-00126",
      type: "retiro",
      customerName: "María López",
      amount: 1500,
      registeredAt: "Hoy, 9:42 a. m.",
      registeredBy: "Ana López",
      status: "pending",
    },
  ],
  shiftName: "Turno matutino",
  responsibleName: "Ana López",
  updatedAt: "Hoy, 10:42 a. m.",
};

export const bankAccounts: BankAccountBalance[] = [
  {
    id: "bank-azteca",
    bankName: "Banco Azteca",
    accountName: "Cuenta principal",
    realBalance: 25000,
    reservedOperations: [
      {
        id: "deposit-1",
        folio: "DEP-00218",
        type: "deposito",
        customerName: "Juan Pérez",
        amount: 4000,
        registeredAt: "Hoy, 10:05 a. m.",
        registeredBy: "Carlos Ruiz",
        status: "pending",
      },
    ],
    status: "available",
    visibleMovementTrackingEnabled: true,
    visibleMovementLimit: 60,
    visibleMovementsUsed: 52,
    movementWarningThreshold: 0.8,
    lowBalanceThreshold: 5000,
    criticalBalanceThreshold: 2000,
  },
  {
    id: "bank-bbva",
    bankName: "BBVA",
    accountName: "Cuenta principal",
    // Demostrativo: saldo bajo para verificar estado warning por saldo
    realBalance: 2500,
    reservedOperations: [],
    status: "available",
    lowBalanceThreshold: 3000,
    criticalBalanceThreshold: 1000,
  },
  {
    id: "mercado-pago",
    bankName: "Mercado Pago",
    accountName: "Cuenta principal",
    realBalance: 8500,
    reservedOperations: [],
    status: "available",
  },
];
