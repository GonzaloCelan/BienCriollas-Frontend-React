import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "../styles/orderDetailDrawer.css";
import type { Pedido } from "./PedidosTable";

type OrderDetailDrawerProps = {
  pedido: Pedido | null;
  items: Pedido["items"];
  totalItems: number;
  onClose: () => void;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function OrderDetailDrawer({
  pedido,
  items,
  totalItems,
  onClose,
}: OrderDetailDrawerProps) {
  if (!pedido) return null;

  return createPortal(
    <aside className="order-detail-drawer">
      <div className="order-detail-drawer__backdrop" onClick={onClose} />

      <section className="order-detail-drawer__panel">
        <button
          className="order-detail-drawer__close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          <X size={18} />
        </button>

        <header className="order-detail-drawer__header">
          <span>Detalle del pedido</span>
          <h2>#{pedido.id}</h2>
        </header>

        <div className="order-detail-summary">
          <div className="order-detail-row">
            <span>Cliente</span>
            <strong>{pedido.cliente || "Sin cliente"}</strong>
          </div>

          <div className="order-detail-row">
            <span>Venta</span>
            <strong>{pedido.tipoVenta}</strong>
          </div>

          <div className="order-detail-row">
            <span>Pago</span>
            <strong>{pedido.pago}</strong>
          </div>

          <div className="order-detail-row">
            <span>Horario</span>
            <strong>{pedido.horario || "-"}</strong>
          </div>

          <div className="order-detail-row">
            <span>Estado</span>
            <strong>{pedido.estado}</strong>
          </div>

          <div className="order-detail-row">
            <span>Total</span>
            <strong>{formatPrice(pedido.total)}</strong>
          </div>

          <div className="order-detail-row order-detail-row--highlight">
            <span>Empanadas cargadas</span>
            <strong>{totalItems}</strong>
          </div>
        </div>

        <section className="order-detail-varieties">
          <h3>Variedades</h3>

          {items && items.length > 0 ? (
            <div className="order-detail-varieties__list">
              {items.map((item) => (
                <div className="order-detail-variety" key={item.nombre}>
                  <strong>{item.nombre}</strong>
                  <span>{item.cantidad} unidades</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="order-detail-empty">Sin variedades cargadas.</p>
          )}
        </section>
      </section>
    </aside>,
    document.body
  );
}

export default OrderDetailDrawer;