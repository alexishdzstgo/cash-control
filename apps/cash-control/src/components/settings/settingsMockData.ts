import type { SettingsState } from "@/types/settings";

export const initialSettingsState: SettingsState = {
  business: {
    businessName: "Papelería Adonai",
    shortName: "Adonai",
    address: "Dirección pendiente",
    phone: "Teléfono pendiente",
    logoPlaceholder: "Logo pendiente",
  },
  system: {
    language: "Español (México)",
    currency: "MXN",
    timezone: "America/Mexico_City",
    dateFormat: "DD/MM/AAAA",
    timeFormat: "24 horas",
  },
  operation: {
    carryFinalCashToNextShift: true,
    depositPrefix: "DEP",
    withdrawalPrefix: "RET",
    folioLength: 6,
    depositPreview: "DEP-000125",
    withdrawalPreview: "RET-000231",
  },
};
