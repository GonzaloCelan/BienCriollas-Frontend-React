import {
  ArrowRightCircle,
  Clock3,
  CreditCard,
  Eye,
  Pencil,
  Printer,
  Store,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import OrderDetailDrawer from "./OrderDetailDrawer";
import OrdersEmptyState from "./OrdersEmptyState";
import OrdersLoadingState from "./OrdersLoadingState";

import { imprimirComandaPedido } from "../utils/printComanda";

import type { EstadoBackend } from "../services/pedidosApi";

export type EstadoPedidoFrontend =
  | "Pendiente"
  | "Preparado"
  | "Entregado"
  | "Cancelado";

export type Pedido = {
  id: number;
  cliente: string;
  tipoVenta: string;
  pago: string;
  horario: string;
  estado: EstadoPedidoFrontend;
  total: number;

  numeroPedido?: string | number | null;
  numeroPedidoPedidosYa?: string | number | null;
  numeroPedidoYa?: string | number | null;
  nroPedido?: string | number | null;
  montoEfectivo?: number;
  montoTransferencia?: number;

  items?: {
    idVariedad?: number;
    nombre: string;
    cantidad: number;
    subtotal?: number;
  }[];
};

type PedidosTableProps = {
  pedidos: Pedido[];
  loading?: boolean;
  estadoActivo: EstadoBackend;
  onNextStatus: (pedido: Pedido) => void;
  onDeletePedido: (idPedido: number) => void;
  onLoadDetail: (idPedido: number) => Promise<Pedido["items"]>;
  onChangePayment: (pedido: Pedido) => void;
  onEditPedido: (pedido: Pedido) => void | Promise<void>;
  editingId?: number | null;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusClass(estado: Pedido["estado"]) {
  if (estado === "Pendiente") return "status-pending";
  if (estado === "Preparado") return "status-ready";
  if (estado === "Entregado") return "status-delivered";
  return "status-cancelled";
}

function getSaleClass(tipoVenta: string) {
  const value = tipoVenta.toLowerCase();

  if (value.includes("pedidos")) return "sale-pedidos-ya";

  return "sale-particular";
}

function getPaymentClass(pago: string) {
  const value = pago.toLowerCase();

  if (value.includes("transfer")) return "payment-transfer";
  if (value.includes("combin")) return "payment-combined";

  return "payment-cash";
}

function puedeAvanzarEstado(estado: Pedido["estado"]) {
  return estado !== "Entregado" && estado !== "Cancelado";
}

function puedeCancelarPedido(estado: Pedido["estado"]) {
  return estado !== "Entregado" && estado !== "Cancelado";
}

function puedeCambiarPago(estado: Pedido["estado"]) {
  return estado !== "Cancelado";
}

function puedeEditarPedido(estado: Pedido["estado"]) {
  return estado !== "Entregado" && estado !== "Cancelado";
}

function getNextStatusLabel(estado: Pedido["estado"]) {
  if (estado === "Pendiente") return "Pasar a preparación";
  if (estado === "Preparado") return "Marcar como entregado";
  return "Ver detalle";
}

function getDeleteTitle(estado: Pedido["estado"]) {
  if (estado === "Entregado") return "No se puede cancelar un pedido entregado";
  if (estado === "Cancelado") return "El pedido ya está cancelado";

  return "Cancelar pedido";
}

function getPaymentTitle(pedido: Pedido) {
  if (!puedeCambiarPago(pedido.estado)) {
    return "No se puede cambiar el pago de un pedido cancelado";
  }

  const pagoActual = pedido.pago.toLowerCase();

  if (pagoActual.includes("transfer")) {
    return "Cambiar pago a efectivo";
  }

  return "Cambiar pago a transferencia";
}

function getNumeroPedidoExterno(pedido: Pedido) {
  const numero =
    pedido.numeroPedidoPedidosYa ??
    pedido.numeroPedido ??
    pedido.numeroPedidoYa ??
    pedido.nroPedido ??
    null;

  if (!numero) return "-";

  return `#${numero}`;
}

function getHorarioPedido(horario: string) {
  const value = horario?.trim();

  if (!value || value === "-" || value === "--:--") return "Sin horario";

  return value.slice(0, 5);
}

function PedidosTable({
  pedidos,
  loading = false,
  estadoActivo,
  onNextStatus,
  onDeletePedido,
  onLoadDetail,
  onChangePayment,
  onEditPedido,
  editingId = null,
}: PedidosTableProps) {
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [detalleItems, setDetalleItems] = useState<Pedido["items"]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const totalItems = (detalleItems ?? []).reduce(
    (acc, item) => acc + item.cantidad,
    0
  );
  async function abrirDetalle(pedido: Pedido) {
    try {
      setSelectedPedido(pedido);
      setDetalleItems([]);
      setLoadingDetail(true);

      const detalle = await onLoadDetail(pedido.id);
      setDetalleItems(detalle ?? []);
    } catch (error) {
      console.error(error);
      setDetalleItems([]);
      alert("No se pudo cargar el detalle del pedido.");
    } finally {
      setLoadingDetail(false);
    }
  }

  function cerrarDetalle() {
    setSelectedPedido(null);
    setDetalleItems([]);
    setLoadingDetail(false);
  }

  async function imprimirComanda(pedido: Pedido) {
    if (printingId === pedido.id) return;

    try {
      setPrintingId(pedido.id);

      const detalle = await onLoadDetail(pedido.id);

      if (!detalle || detalle.length === 0) {
        alert("Este pedido no tiene variedades cargadas.");
        return;
      }

      imprimirComandaPedido(pedido, detalle);
    } catch (error) {
      console.error(error);
      alert("No se pudo imprimir la comanda.");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <>
      <div className="orders-mobile-list">
        {loading ? (
          <div className="orders-mobile-state">
            <OrdersLoadingState />
          </div>
        ) : pedidos.length > 0 ? (
          pedidos.map((pedido, index) => {
            const puedeAvanzar = puedeAvanzarEstado(pedido.estado);
            const puedeCancelar = puedeCancelarPedido(pedido.estado);
            const esPedidosYa = pedido.tipoVenta
              .toLowerCase()
              .includes("pedidos");
            const numeroPedidoExterno = getNumeroPedidoExterno(pedido);
            const horarioPedido = getHorarioPedido(pedido.horario);

            return (
              <article
                key={pedido.id}
                className="orders-mobile-card"
                style={{ animationDelay: `${index * 0.045}s` }}
              >
                <div className="orders-mobile-card__topline">
                  <strong>Pedido #{pedido.id}</strong>
                  <span>
                    <Clock3 size={15} />
                    {horarioPedido}
                  </span>
                </div>

                <button
                  type="button"
                  className="orders-mobile-card__summary"
                  onClick={() => abrirDetalle(pedido)}
                >
                  <span className="orders-mobile-card__client">
                    {pedido.cliente || "Sin cliente"}
                  </span>
                  <span className="orders-mobile-card__meta">
                    {esPedidosYa && numeroPedidoExterno !== "-"
                      ? `Pedidos Ya ${numeroPedidoExterno}`
                      : pedido.pago}
                    {` · ${pedido.tipoVenta}`}
                  </span>
                </button>

                <div className="orders-mobile-card__amount">
                  <span>{pedido.tipoVenta}</span>
                  <strong>{formatPrice(pedido.total)}</strong>
                </div>

                <div className="orders-mobile-card__actions">
                  <button
                    type="button"
                    className="orders-mobile-card__primary"
                    onClick={() =>
                      puedeAvanzar
                        ? onNextStatus(pedido)
                        : abrirDetalle(pedido)
                    }
                  >
                    {getNextStatusLabel(pedido.estado)}
                  </button>

                  {puedeCancelar && (
                    <button
                      type="button"
                      className="orders-mobile-card__secondary"
                      onClick={() => onDeletePedido(pedido.id)}
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="orders-mobile-state">
            <OrdersEmptyState estado={estadoActivo} />
          </div>
        )}
      </div>

      <div className="orders-table-wrapper">
        <table className="orders-table orders-table--floating">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Pago</th>
              <th>Canal</th>
              <th>Horario</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className="orders-state-row">
                <td colSpan={7}>
                  <OrdersLoadingState />
                </td>
              </tr>
            ) : pedidos.length > 0 ? (
              pedidos.map((pedido, index) => {
                const puedeAvanzar = puedeAvanzarEstado(pedido.estado);
                const puedeCancelar = puedeCancelarPedido(pedido.estado);
                const puedeCambiarPagoPedido = puedeCambiarPago(pedido.estado);
                const puedeEditar = puedeEditarPedido(pedido.estado);
                const horarioPedido = getHorarioPedido(pedido.horario);

                return (
                  <tr
                    key={pedido.id}
                    className={
                      selectedPedido?.id === pedido.id
                        ? "orders-row-active"
                        : ""
                    }
                    style={{ animationDelay: `${index * 0.045}s` }}
                  >
                    <td data-label="Cliente">
                      <div className="orders-client-cell">
                        <strong>{pedido.cliente || "Sin cliente"}</strong>
                        <span>Pedido #{pedido.id}</span>
                      </div>
                    </td>

                    <td data-label="Pago">
                      <button
                        type="button"
                        className={`orders-payment-pill orders-payment-pill--clickable ${getPaymentClass(
                          pedido.pago
                        )}`}
                        title={getPaymentTitle(pedido)}
                        disabled={!puedeCambiarPagoPedido}
                        onClick={() => onChangePayment(pedido)}
                      >
                        <CreditCard
                          className="orders-mobile-meta-icon"
                          size={11}
                        />
                        {pedido.pago}
                      </button>
                    </td>

                    <td data-label="Venta">
                      <span
                        className={`orders-sale-pill ${getSaleClass(
                          pedido.tipoVenta
                        )}`}
                      >
                        <Store
                          className="orders-mobile-meta-icon"
                          size={11}
                        />
                        {pedido.tipoVenta}
                      </span>
                    </td>

                    <td
                      className={`orders-schedule-cell ${
                        horarioPedido === "Sin horario"
                          ? "orders-schedule-cell--empty"
                          : ""
                      }`}
                      data-label="Horario"
                    >
                      <span className="orders-mobile-schedule-label">
                        Horario
                      </span>
                      <span className="orders-schedule-value">
                        {horarioPedido}
                      </span>
                    </td>

                    <td data-label="Total">
                      <strong className="orders-total-price">
                        {formatPrice(pedido.total)}
                      </strong>
                    </td>

                    <td data-label="Estado">
                      <div className="orders-status-meta">
                        <span
                          className={`orders-status ${getStatusClass(
                            pedido.estado
                          )}`}
                        >
                          {pedido.estado}
                        </span>
                      </div>
                    </td>

                    <td data-label="Acciones">
                      <div className="orders-actions">
                        <button
                          className="orders-icon-btn orders-icon-btn--view"
                          type="button"
                          title="Ver detalle"
                          onClick={() => abrirDetalle(pedido)}
                        >
                          <Eye size={15} />
                          <span className="orders-action-label">Ver</span>
                        </button>

                        <button
                          className="orders-icon-btn orders-icon-btn--edit"
                          type="button"
                          title={
                            puedeEditar
                              ? "Editar pedido"
                              : "No se puede editar un pedido cerrado"
                          }
                          disabled={!puedeEditar || editingId === pedido.id}
                          onClick={() => onEditPedido(pedido)}
                        >
                          <Pencil size={15} />
                          <span className="orders-action-label">Editar</span>
                        </button>

                        <button
                          className="orders-icon-btn orders-icon-btn--print"
                          type="button"
                          title="Imprimir comanda"
                          disabled={printingId === pedido.id}
                          onClick={() => imprimirComanda(pedido)}
                        >
                          <Printer size={15} />
                          <span className="orders-action-label">Imprimir</span>
                        </button>

                        <button
                          className="orders-icon-btn orders-icon-btn--next"
                          type="button"
                          title={
                            puedeAvanzar
                              ? "Siguiente estado"
                              : "El pedido ya está cerrado"
                          }
                          disabled={!puedeAvanzar}
                          onClick={() => onNextStatus(pedido)}
                        >
                          <ArrowRightCircle size={15} />
                          <span className="orders-action-label">Avanzar</span>
                        </button>

                        <button
                          className="orders-icon-btn orders-icon-btn--danger"
                          type="button"
                          title={getDeleteTitle(pedido.estado)}
                          disabled={!puedeCancelar}
                          onClick={() => onDeletePedido(pedido.id)}
                        >
                          <Trash2 size={15} />
                          <span className="orders-action-label">Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="orders-state-row">
                <td colSpan={7}>
                  <OrdersEmptyState estado={estadoActivo} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <OrderDetailDrawer
        pedido={selectedPedido}
        items={loadingDetail ? [] : detalleItems ?? []}
        totalItems={loadingDetail ? 0 : totalItems}
        onClose={cerrarDetalle}
      />
    </>
  );
}

export default PedidosTable;
