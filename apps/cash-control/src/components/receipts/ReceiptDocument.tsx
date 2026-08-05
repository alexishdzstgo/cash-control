import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type {
  ReceiptBusinessIdentity,
  ReceiptData,
  ReceiptPaperSize,
  ReceiptPreferences,
} from "@/types/receipt";
import { ReceiptStatusBadge } from "./ReceiptStatusBadge";

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
  const title = getReceiptTitle(data);
  const pendingNotice =
    data.operationType === "deposit" && data.status === "pending"
      ? "Esta operación todavía no ha sido completada."
      : data.operationType === "withdrawal" && data.status === "pending"
        ? "Pendiente de entrega al beneficiario."
        : null;
  const showSignature =
    preferences.showSignatureSpace &&
    (data.operationType === "withdrawal" || data.operationType === "deposit");

  return (
    <article
      className={`receipt-document receipt-paper-${paperSize} bg-white text-black`}
    >
      <header className="text-center">
        {preferences.showBusinessLogo && businessIdentity.logoUrl && (
          <img
            src={businessIdentity.logoUrl}
            alt=""
            className="mx-auto mb-2 max-h-10 max-w-full object-contain grayscale"
          />
        )}
        <h1 className="text-base font-bold uppercase leading-tight">
          {businessIdentity.businessName}
        </h1>
        {businessIdentity.legalOrDisplayName && (
          <p className="text-xs">{businessIdentity.legalOrDisplayName}</p>
        )}
        {preferences.showPhone && businessIdentity.phone && (
          <p className="text-xs">Tel. {businessIdentity.phone}</p>
        )}
        {preferences.showAddress && businessIdentity.address && (
          <p className="text-xs">{businessIdentity.address}</p>
        )}
        {preferences.headerMessage && (
          <p className="mt-2 text-xs font-semibold">
            {preferences.headerMessage}
          </p>
        )}
      </header>

      <Separator />

      <section className="space-y-1">
        <div className="text-center">
          <p className="text-sm font-bold uppercase">{title}</p>
          <ReceiptStatusBadge status={data.status} />
        </div>
        <Row label="Folio" value={data.folio} mono />
        <Row label="Operación" value={data.operationId} mono />
        <Row label="Fecha" value={formatDateTime(data.createdAt)} />
        {data.completedAt && data.operationType === "withdrawal" && (
          <Row label="Entrega" value={formatDateTime(data.completedAt)} />
        )}
      </section>

      <Separator />

      <section className="space-y-1">
        <AmountRow
          label={data.operationType === "withdrawal" ? "Monto entregado" : "Monto"}
          value={data.amount}
        />
        {data.operationType === "deposit" && (
          <AmountRow label="Comisión" value={data.commission} />
        )}
        {data.operationType === "withdrawal" && data.status !== "pending" && (
          <AmountRow label="Comisión" value={data.commission} />
        )}
        <AmountRow
          label={data.operationType === "deposit" ? "Total recibido" : "Total"}
          value={data.total}
          strong
        />
      </section>

      <Separator />

      <section className="space-y-1">
        {preferences.showBank && data.bankName && (
          <Row
            label={data.operationType === "deposit" ? "Banco destino" : "Banco origen"}
            value={data.bankName}
          />
        )}
        {preferences.showSender && data.senderName && (
          <Row label="Envía" value={data.senderName} />
        )}
        {preferences.showReceiver && data.receiverName && data.operationType === "deposit" && (
          <Row label="Recibe" value={data.receiverName} />
        )}
        {data.operationType === "withdrawal" && data.beneficiaryName && (
          <Row label="Beneficiario" value={data.beneficiaryName} />
        )}
        <Row label="Registró" value={data.registeredBy} />
        {data.operationType === "withdrawal" && data.status === "delivered" && (
          <Row label="Entregó" value={data.deliveredBy ?? "No disponible"} />
        )}
        {preferences.showResponsibleUser && data.responsibleUser && (
          <Row label="Responsable" value={data.responsibleUser} />
        )}
      </section>

      {pendingNotice && (
        <>
          <Separator />
          <p className="text-center text-xs font-semibold uppercase">
            {pendingNotice}
          </p>
        </>
      )}

      {data.wasEdited && (
        <>
          <Separator />
          <section className="text-center">
            <p className="text-xs font-bold uppercase">Operación corregida</p>
            <p className="text-xs">
              Última actualización:{" "}
              {data.lastEditedAt ? formatDateTime(data.lastEditedAt) : "No disponible"}
            </p>
          </section>
        </>
      )}

      {preferences.showObservations && data.observations && data.status !== "pending" && (
        <>
          <Separator />
          <Row label="Observaciones" value={data.observations} />
        </>
      )}

      {showSignature && (
        <>
          <Separator />
          <div className="pt-5 text-center">
            <p className="border-t border-black pt-1 text-xs">
              Firma de recibido
            </p>
          </div>
        </>
      )}

      <Separator />

      <footer className="space-y-1 text-center text-xs">
        {preferences.footerMessage && <p>{preferences.footerMessage}</p>}
        {preferences.clarificationMessage && (
          <p>{preferences.clarificationMessage}</p>
        )}
        {!data.hasReceiptSnapshot && (
          <p className="font-semibold">
            Este comprobante se generó con la configuración actual.
          </p>
        )}
      </footer>
    </article>
  );
}

function getReceiptTitle(data: ReceiptData): string {
  if (data.operationType === "deposit") {
    return data.status === "pending" ? "Depósito pendiente" : "Depósito";
  }
  return data.status === "pending" ? "Retiro pendiente" : "Retiro";
}

function Separator() {
  return <div className="my-2 border-t border-dashed border-black" />;
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 font-semibold">{label}:</span>
      <span className={`min-w-0 flex-1 break-words text-right ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function AmountRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 tabular-nums ${
        strong ? "text-sm font-bold" : "text-xs"
      }`}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
