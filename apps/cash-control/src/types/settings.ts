export type BusinessSettings = {
  businessName: string;
  shortName: string;
  address: string;
  phone: string;
  logoPlaceholder: string;
};

export type SystemSettings = {
  language: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

export type OperationSettings = {
  carryFinalCashToNextShift: boolean;
  depositPrefix: string;
  withdrawalPrefix: string;
  folioLength: number;
  depositPreview: string;
  withdrawalPreview: string;
};

export type SettingsState = {
  business: BusinessSettings;
  system: SystemSettings;
  operation: OperationSettings;
};
