export type ReceiptPaperSize = "58mm" | "80mm" | "digital";

export type ReceiptOperationType = "deposit" | "withdrawal";

export type ReceiptStatus = "pending" | "completed" | "delivered";

export type ReceiptBusinessIdentity = {
  businessName: string;
  legalOrDisplayName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
};

export type ReceiptFieldVisibility = {
  showBusinessName: boolean;
  showOperationType: boolean;
  showDate: boolean;
  showTime: boolean;
  showAmount: boolean;
  showCommission: boolean;
  showTotal: boolean;
  showFolio: boolean;
  showOperationId: boolean;
  showBank: boolean;
  showSender: boolean;
  showReceiver: boolean;
  showBeneficiary: boolean;
  showRegisteredBy: boolean;
  showDeliveredBy: boolean;
  showResponsibleUser: boolean;
  showStatus: boolean;
  showEditedIndicator: boolean;
  showObservations: boolean;
  showSignatureSpace: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showHeaderMessage: boolean;
  showFooterMessage: boolean;
  showClarificationMessage: boolean;
};

export type ReceiptPreferences = {
  paperSize: ReceiptPaperSize;
  copies: number;
  autoOpenAfterRegister: boolean;
  fieldVisibility: ReceiptFieldVisibility;
  operationTypeOverrides?: Partial<
    Record<ReceiptOperationType, Partial<ReceiptFieldVisibility>>
  >;
  headerMessage?: string;
  footerMessage?: string;
  clarificationMessage?: string;
};

export type ReceiptData = {
  receiptId: string;
  operationId: string;
  folio: string;
  operationType: ReceiptOperationType;
  status: ReceiptStatus;
  createdAt: string;
  completedAt?: string;
  amount: number;
  commission: number;
  total: number;
  bankName?: string;
  senderName?: string;
  receiverName?: string;
  beneficiaryName?: string;
  registeredBy: string;
  deliveredBy?: string;
  responsibleUser?: string;
  wasEdited: boolean;
  lastEditedAt?: string;
  observations?: string;
  hasReceiptSnapshot?: boolean;
};

export type ReceiptSnapshot = {
  operationId: string;
  receiptData: ReceiptData;
  businessIdentity: ReceiptBusinessIdentity;
  preferences: ReceiptPreferences;
  generatedAt: string;
  generatedBy: string;
};
