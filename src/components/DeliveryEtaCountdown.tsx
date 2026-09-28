import { getDeliveryEtaPresentation } from "../utils/deliveryEta";

type DeliveryEtaCountdownProps = {
  fechaHoraEstimadaDelivery: string | null;
  now: number;
};

export default function DeliveryEtaCountdown({
  fechaHoraEstimadaDelivery,
  now,
}: DeliveryEtaCountdownProps) {
  const eta = getDeliveryEtaPresentation(fechaHoraEstimadaDelivery, now);
  if (!eta) return <span className="orders-delivery-eta--empty">Sin ETA</span>;

  return (
    <span
      className={`orders-delivery-eta orders-delivery-eta--${eta.tone}`}
      title={eta.description}
      aria-label={eta.description}
    >
      {eta.label}
    </span>
  );
}
