import { CheckCircle2, X } from "lucide-react";

import "../styles/orderToast.css";

type OrderToastProps = {
  show: boolean;
  message: string;
  onClose: () => void;
};

function OrderToast({ show, message, onClose }: OrderToastProps) {
  if (!show) return null;

  return (
    <div className="order-toast">
      <div className="order-toast__icon">
        <CheckCircle2 size={20} />
      </div>

      <div className="order-toast__content">
        <strong>Pedido creado</strong>
        <span>{message}</span>
      </div>

      <button type="button" onClick={onClose} aria-label="Cerrar aviso">
        <X size={16} />
      </button>
    </div>
  );
}

export default OrderToast;