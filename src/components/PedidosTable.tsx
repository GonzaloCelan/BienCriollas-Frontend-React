import { ArrowRightCircle, Eye, Printer, Trash2 } from "lucide-react";
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
  numeroPedidoYa?: string | number | null;
  nroPedido?: string | number | null;

  items?: {
    nombre: string;
    cantidad: number;
  }[];
};

type PedidosTableProps = {
  pedidos: Pedido[];
  loading?: boolean;
  estadoActivo: EstadoBackend;
  onNextStatus: (pedido: Pedido) => void;
  onDeletePedido: (idPedido: number) => void;
  onLoadDetail: (idPedido: number) => Promise<Pedido["items"]>;
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

  return "payment-cash";
}

function puedeAvanzarEstado(estado: Pedido["estado"]) {
  return estado !== "Entregado" && estado !== "Cancelado";
}

function puedeCancelarPedido(estado: Pedido["estado"]) {
  return estado !== "Entregado" && estado !== "Cancelado";
}

function getDeleteTitle(estado: Pedido["estado"]) {
  if (estado === "Entregado") return "No se puede cancelar un pedido entregado";
  if (estado === "Cancelado") return "El pedido ya está cancelado";

  return "Cancelar pedido";
}

function getNumeroPedidoExterno(pedido: Pedido) {
  const numero =
    pedido.numeroPedido ?? pedido.numeroPedidoYa ?? pedido.nroPedido ?? null;

  if (!numero) return "-";

  return `#${numero}`;
}

function PedidosTable({
  pedidos,
  loading = false,
  estadoActivo,
  onNextStatus,
  onDeletePedido,
  onLoadDetail,
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
      <div className="orders-table-wrapper">
        <table className="orders-table orders-table--floating">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Pago</th>
              <th>Venta</th>
              <th>N° Pedido</th>
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
                    <td>
                      <div className="orders-client-cell">
                        <strong>{pedido.cliente || "Sin cliente"}</strong>
                        <span>Pedido #{pedido.id}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`orders-payment-pill ${getPaymentClass(
                          pedido.pago
                        )}`}
                      >
                        {pedido.pago}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`orders-sale-pill ${getSaleClass(
                          pedido.tipoVenta
                        )}`}
                      >
                        {pedido.tipoVenta}
                      </span>
                    </td>

                    <td>
                      <span className="orders-external-number">
                        {getNumeroPedidoExterno(pedido)}
                      </span>
                    </td>

                    <td>
                      <strong className="orders-total-price">
                        {formatPrice(pedido.total)}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`orders-status ${getStatusClass(
                          pedido.estado
                        )}`}
                      >
                        {pedido.estado}
                      </span>
                    </td>

                    <td>
                      <div className="orders-actions">
                        <button
                          className="orders-icon-btn"
                          type="button"
                          title="Ver detalle"
                          onClick={() => abrirDetalle(pedido)}
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          className="orders-icon-btn"
                          type="button"
                          title="Imprimir comanda"
                          disabled={printingId === pedido.id}
                          onClick={() => imprimirComanda(pedido)}
                        >
                          <Printer size={15} />
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
                        </button>

                        <button
                          className="orders-icon-btn orders-icon-btn--danger"
                          type="button"
                          title={getDeleteTitle(pedido.estado)}
                          disabled={!puedeCancelar}
                          onClick={() => onDeletePedido(pedido.id)}
                        >
                          <Trash2 size={15} />
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