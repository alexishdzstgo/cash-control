import type {
  ReceiptBusinessIdentity,
  ReceiptPreferences,
} from "@/types/receipt";

export const initialBusinessIdentity: ReceiptBusinessIdentity = {
  businessName: "Nombre del negocio",
  phone: "",
  address: "",
};

export const initialReceiptPreferences: ReceiptPreferences = {
  paperSize: "80mm",
  copies: 1,
  autoOpenAfterRegister: true,
  showBusinessLogo: false,
  showPhone: true,
  showAddress: true,
  showSender: true,
  showReceiver: true,
  showBank: true,
  showResponsibleUser: true,
  showSignatureSpace: true,
  showObservations: false,
  headerMessage: "",
  footerMessage: "Gracias por su preferencia.",
  clarificationMessage: "Conserve este comprobante para cualquier aclaración.",
  showCorrectionReason: false,
};
