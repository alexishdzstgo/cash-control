import { formatCurrency } from "@/lib/formatters";
import { getReceiptFieldVisibility } from "@/lib/receipt";
import type {
  ReceiptBusinessIdentity,
  ReceiptData,
  ReceiptPaperSize,
  ReceiptPreferences,
} from "@/types/receipt";

type ReceiptDocumentProps = {
  data: ReceiptData;
  businessIdentity: ReceiptBusinessIdentity;
  preferences: ReceiptPreferences;
  paperSize?: ReceiptPaperSize;
};

export function ReceiptDocument({
  data,
  businessIdentity,
  preferences,
  paperSize = preferences.paperSize,
}: ReceiptDocumentProps) {
  const visibility = getReceiptFieldVisibility(preferences, data.operationType);
  const dateParts = getDateParts(data.createdAt);
  const rawFields: Array<PrintableField | null> = [
    visibility.showOperationType
      ? { label: "TIPO DE OPERACIÓN", value: getOperationTypeLabel(data) }
      : null,
    visibility.showDate ? { label: "FECHA", value: dateParts.date } : null,
    visibility.showTime ? { label: "HORA", value: dateParts.time } : null,
    visibility.showAmount
      ? { label: "CANTIDAD", value: formatCurrency(data.amount) }
      : null,
    visibility.showCommission
      ? { label: "COMISIÓN", value: formatCurrency(data.commission) }
      : null,
    visibility.showTotal
      ? { label: "TOTAL", value: formatCurrency(data.total) }
      : null,
    visibility.showFolio ? { label: "FOLIO", value: data.folio } : null,
    visibility.showOperationId
      ? { label: "IDENTIFICADOR INTERNO", value: data.operationId }
      : null,
    visibility.showBank ? { label: "BANCO", value: data.bankName } : null,
    visibility.showSender
      ? {
          label: "NOMBRE DE QUIEN LO ENVÍA",
          value: data.senderName,
          line: true,
        }
      : null,
    visibility.showReceiver
      ? {
          label: "NOMBRE DE QUIEN RECIBE\nEL EFECTIVO COMPLETO",
          value: data.receiverName,
          line: true,
        }
      : null,
    visibility.showBeneficiary
      ? { label: "BENEFICIARIO", value: data.beneficiaryName, line: true }
      : null,
    visibility.showRegisteredBy
      ? { label: "USUARIO QUE REGISTRÓ", value: data.registeredBy }
      : null,
    visibility.showDeliveredBy
      ? { label: "PERSONA QUE ENTREGÓ", value: data.deliveredBy }
      : null,
    visibility.showResponsibleUser
      ? { label: "RESPONSABLE DEL TURNO", value: data.responsibleUser }
      : null,
    visibility.showStatus
      ? { label: "ESTADO", value: getStatusLabel(data) }
      : null,
    visibility.showEditedIndicator && data.wasEdited
      ? { label: "OPERACIÓN CORREGIDA", value: "SÍ" }
      : null,
    visibility.showObservations
      ? { label: "OBSERVACIONES", value: data.observations }
      : null,
  ];
  const fields = rawFields.filter(isPrintableField);

  return (
    <article
      className={`receipt-document receipt-paper-${paperSize} bg-white text-black`}
    >
      <header className="space-y-2 text-center">
        {visibility.showBusinessName && businessIdentity.businessName && (
          <h1 className="text-base font-bold uppercase leading-tight tracking-normal">
            {businessIdentity.businessName}
          </h1>
        )}
        {visibility.showPhone && businessIdentity.phone && (
          <p className="text-xs uppercase">TEL. {businessIdentity.phone}</p>
        )}
        {visibility.showAddress && businessIdentity.address && (
          <p className="text-xs uppercase">{businessIdentity.address}</p>
        )}
        {visibility.showHeaderMessage && preferences.headerMessage && (
          <p className="text-xs uppercase">{preferences.headerMessage}</p>
        )}
      </header>

      <section className="mt-6 space-y-5">
        {fields.map((field) => (
          <ReceiptField
            key={field.label}
            label={field.label}
            value={field.value}
            line={field.line}
          />
        ))}
      </section>

      {visibility.showSignatureSpace && (
        <section className="mt-7 text-center">
          <p className="whitespace-pre-line text-xs font-bold uppercase leading-snug">
            FIRMA
          </p>
          <div className="mx-auto mt-7 w-full border-t border-black" />
        </section>
      )}

      {(visibility.showFooterMessage ||
        visibility.showClarificationMessage) && (
        <footer className="mt-6 space-y-2 text-center text-xs uppercase">
          {visibility.showFooterMessage && preferences.footerMessage && (
            <p>{preferences.footerMessage}</p>
          )}
          {visibility.showClarificationMessage &&
            preferences.clarificationMessage && (
              <p>{preferences.clarificationMessage}</p>
            )}
        </footer>
      )}
    </article>
  );
}

type PrintableField = {
  label: string;
  value?: string;
  line?: boolean;
};

function ReceiptField({ label, value, line = false }: PrintableField) {
  return (
    <div className="text-center">
      <p className="whitespace-pre-line text-xs font-bold uppercase leading-snug">
        {label}
      </p>
      {value && (
        <p className="mt-2 break-words text-sm leading-snug">{value}</p>
      )}
      {line && <div className="mx-auto mt-3 w-full border-t border-black" />}
    </div>
  );
}

function isPrintableField(
  field: PrintableField | null,
): field is PrintableField {
  return Boolean(field?.value);
}

function getDateParts(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "Fecha no disponible", time: "Hora no disponible" };
  }

  return {
    date: new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

function getOperationTypeLabel(data: ReceiptData): string {
  if (data.operationType === "deposit") {
    return data.status === "pending" ? "Depósito pendiente" : "Depósito";
  }

  return data.status === "pending" ? "Retiro pendiente" : "Retiro";
}

function getStatusLabel(data: ReceiptData): string {
  if (data.status === "pending") return "Pendiente";
  if (data.status === "delivered") return "Entregado";
  return "Completado";
}
