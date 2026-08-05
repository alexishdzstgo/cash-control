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

export type ReceiptPreferences = {
  paperSize: ReceiptPaperSize;
  copies: number;
  autoOpenAfterRegister: boolean;
  showBusinessLogo: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showSender: boolean;
  showReceiver: boolean;
  showBank: boolean;
  showResponsibleUser: boolean;
  showSignatureSpace: boolean;
  showObservations: boolean;
  headerMessage?: string;
  footerMessage?: string;
  clarificationMessage?: string;
  showCorrectionReason?: boolean;
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
