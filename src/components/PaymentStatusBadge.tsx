import "../styles/paymentStatus.css";

type PaymentStatusBadgeProps = {
  pagado: boolean;
  onClick?: () => void;
  busy?: boolean;
};

export default function PaymentStatusBadge({ pagado, onClick, busy = false }: PaymentStatusBadgeProps) {
  const label = pagado ? "Pagado" : "Por cobrar";
  const className = `order-payment-status ${pagado ? "order-payment-status--paid" : "order-payment-status--pending"}`;
  const content = label;

  if (!onClick) return <span className={className}>{content}</span>;

  return (
    <button
      type="button"
      className={`${className} order-payment-status--action`}
      onClick={onClick}
      disabled={busy}
      aria-label={`${label}. Marcar como ${pagado ? "por cobrar" : "pagado"}`}
      title={`Marcar como ${pagado ? "por cobrar" : "pagado"}`}
    >
      {content}
    </button>
  );
}
