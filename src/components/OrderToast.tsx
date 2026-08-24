import { CheckCircle2, X } from "lucide-react";

import "../styles/orderToast.css";

type OrderToastProps = {
  show: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

function OrderToast({
  show,
  title = "Pedido creado",
  message,
  onClose,
}: OrderToastProps) {
  if (!show) return null;

  return (
    <div className="order-toast">
      <div className="order-toast__icon">
        <CheckCircle2 size={20} />
      </div>

      <div className="order-toast__content">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>

      <button type="button" onClick={onClose} aria-label="Cerrar aviso">
        <X size={16} />
      </button>
    </div>
  );
}

export default OrderToast;
