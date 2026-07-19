export type DepositMode =
  | "completed"
  | "pending";

export type DepositStatus =
  | "completado"
  | "pendiente";

export type DepositDeliveryMethod =
  | "bank-transfer"
  | "cash-deposit";

export type DepositPendingReason =
  | ""
  | "bank-unavailable"
  | "insufficient-bank-balance"
  | "movement-limit"
  | "customer-request"
  | "other";

export type DepositFormData = {
  /**
   * Folio interno o referencia bancaria
   * utilizada para identificar la operación.
   */
  bankFolio: string;

  /**
   * Cantidad de efectivo entregada
   * por el cliente.
   */
  amount: string;

  /**
   * Banco o institución a la que
   * se enviará el dinero.
   */
  destinationBank: string;

  /**
   * Método utilizado para realizar
   * la operación.
   */
  deliveryMethod: DepositDeliveryMethod | "";

  /**
   * Nombre del cliente que entrega
   * el efectivo.
   */
  senderName: string;

  /**
   * Nombre del titular o persona
   * que recibirá el depósito.
   */
  receiverName: string;

  /**
   * Número de cuenta, tarjeta, CLABE
   * o referencia de destino.
   */
  destinationReference: string;

  /**
   * Motivo por el que la operación
   * quedó pendiente.
   */
  pendingReason: DepositPendingReason;

  /**
   * Explicación adicional cuando
   * el motivo seleccionado es "Otro".
   */
  pendingReasonDetails: string;

  /**
   * Notas internas opcionales.
   */
  observations: string;
};

export const initialDepositFormData: DepositFormData = {
  bankFolio: "",
  amount: "",
  destinationBank: "",
  deliveryMethod: "",
  senderName: "",
  receiverName: "",
  destinationReference: "",
  pendingReason: "",
  pendingReasonDetails: "",
  observations: "",
};