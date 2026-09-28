import {
  ArrowRightCircle,
  CalendarClock,
  Clock3,
  CreditCard,
  Eye,
  Pause,
  Pencil,
  Printer,
  Store,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { gooeyToast } from "goey-toast";
import { TOAST_RAPIDO_TIMING } from "../config/toast";

import OrderDetailDrawer from "./OrderDetailDrawer";
import DeliveryEtaCountdown from "./DeliveryEtaCountdown";
import DeliveryEtaDialog from "./DeliveryEtaDialog";
import PaymentStatusBadge from "./PaymentStatusBadge";
import OrdersEmptyState from "./OrdersEmptyState";
import OrdersLoadingState from "./OrdersLoadingState";

import { imprimirComandaPedido } from "../utils/printComanda";

import type { EstadoBackend } from "../services/pedidosApi";
import { getDeliveryEtaClock, getDeliveryEtaPresentation, toggleDeliveryEtaPlayback, type DeliveryEtaPlayback } from "../utils/deliveryEta";

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
  pagado: boolean;
  horario: string;
  fechaHoraEstimadaDelivery: string | null;
  estado: EstadoPedidoFrontend;
  total: number;

  numeroPedido?: string | number | null;
  numeroPedidoPedidosYa?: string | number | null;
  numeroPedidoYa?: string | number | null;
  nroPedido?: string | number | null;
  montoEfectivo?: number;
  montoTransferencia?: number;
  fechaPedido?: string | null;
  fechaEntrega?: string | null;
  scheduled?: boolean;
  deliveryToday?: boolean;
  stockDiscounted?: boolean;

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
  onChangePaymentStatus: (pedido: Pedido) => void;
  onChangeDeliveryEta: (pedido: Pedido, minutes: number | null) => Promise<void>;
  updatingPaymentId?: number | null;
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

function isPedidosYa(pedido: Pedido) {
  return pedido.tipoVenta.toLowerCase().includes("pedidos");
}

function canEditDeliveryEta(pedido: Pedido) {
  return isPedidosYa(pedido) && pedido.estado !== "Entregado" && pedido.estado !== "Cancelado";
}

function getCurrentTimestamp() {
  return Date.now();
}

type ScheduleTone = "normal" | "soon" | "urgent" | "critical" | "late";

function getSchedulePresentation(pedido: Pedido, now: number) {
  const horario = getHorarioPedido(pedido.horario);
  const isClosed = pedido.estado === "Entregado" || pedido.estado === "Cancelado";
  const timeMatch = horario.match(/^(\d{1,2}):(\d{2})$/);

  if (horario === "Sin horario" || isClosed || !timeMatch) {
    return { tone: "normal" as ScheduleTone, label: horario, title: undefined };
  }

  const currentDate = new Date(now);
  const rawDate = pedido.fechaEntrega || pedido.fechaPedido || "";
  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const target = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  target.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  const minutesRemaining = Math.ceil((target.getTime() - now) / 60000);

  if (minutesRemaining <= 0) {
    const delayedMinutes = Math.abs(minutesRemaining);
    return {
      tone: "late" as ScheduleTone,
      label: `Demorado · ${horario}`,
      title: delayedMinutes > 0
        ? `El horario se superó hace ${delayedMinutes} min`
        : "El horario de entrega ya llegó",
    };
  }

  const title = `Faltan ${minutesRemaining} min para la entrega`;
  if (minutesRemaining <= 10) return { tone: "critical" as ScheduleTone, label: horario, title };
  if (minutesRemaining <= 30) return { tone: "urgent" as ScheduleTone, label: horario, title };
  if (minutesRemaining <= 60) return { tone: "soon" as ScheduleTone, label: horario, title };
  return { tone: "normal" as ScheduleTone, label: horario, title: `Entrega prevista a las ${horario}` };
}

function PedidosTable({
  pedidos,
  loading = false,
  estadoActivo,
  onNextStatus,
  onDeletePedido,
  onLoadDetail,
  onChangePayment,
  onChangePaymentStatus,
  onChangeDeliveryEta,
  updatingPaymentId = null,
  onEditPedido,
  editingId = null,
}: PedidosTableProps) {
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [detalleItems, setDetalleItems] = useState<Pedido["items"]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [etaPedido, setEtaPedido] = useState<Pedido | null>(null);
  const [etaPlayback, setEtaPlayback] = useState<Record<number, DeliveryEtaPlayback>>({});
  const [now, setNow] = useState(() => Date.now());
  const hasRunningEta = pedidos.some((pedido) => {
    const target = pedido.fechaHoraEstimadaDelivery;
    if (!canEditDeliveryEta(pedido) || !target) return false;
    const clock = getDeliveryEtaClock(target, now, etaPlayback[pedido.id]);
    const presentation = getDeliveryEtaPresentation(target, clock.now);
    return !clock.paused && presentation !== null && presentation.tone !== "finished";
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), hasRunningEta ? 1000 : 30000);
    const updateOnFocus = () => setNow(Date.now());
    window.addEventListener("focus", updateOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateOnFocus);
    };
  }, [hasRunningEta]);

  function handleEtaPauseClick(pedido: Pedido) {
    const target = pedido.fechaHoraEstimadaDelivery;
    if (!target) return;
    const clickedAt = getCurrentTimestamp();
    setEtaPlayback((current) => ({
      ...current,
      [pedido.id]: toggleDeliveryEtaPlayback(target, clickedAt, current[pedido.id]),
    }));
    setNow(clickedAt);
  }

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
      gooeyToast.error("No se pudo cargar el detalle", {
        description: `No se pudo obtener la información del pedido #${pedido.id}.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
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
        gooeyToast.warning("Pedido sin variedades", {
          description: `El pedido #${pedido.id} no tiene un detalle para imprimir.`,
          timing: TOAST_RAPIDO_TIMING,
          showTimestamp: false,
        });
        return;
      }

      await imprimirComandaPedido(pedido, detalle);
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo imprimir la comanda", {
        description: `Ocurrió un problema con el pedido #${pedido.id}.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
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
            const esPedidosYa = isPedidosYa(pedido);
            const numeroPedidoExterno = getNumeroPedidoExterno(pedido);
            const horarioPedido = getHorarioPedido(pedido.horario);
            const editableEta = canEditDeliveryEta(pedido);
            const etaClock = getDeliveryEtaClock(pedido.fechaHoraEstimadaDelivery ?? "", now, etaPlayback[pedido.id]);
            const etaPresentation = getDeliveryEtaPresentation(pedido.fechaHoraEstimadaDelivery, etaClock.now);
            const hasEta = etaPresentation !== null;

            return (
              <article
                key={pedido.id}
                className="orders-mobile-card"
                style={{ animationDelay: `${index * 0.045}s` }}
              >
                <div className="orders-mobile-card__topline">
                  <strong>Pedido #{pedido.id}</strong>
                  {editableEta ? (
                    <span className="orders-eta-controls orders-mobile-card__eta">
                      {hasEta && etaPresentation.tone === "finished" ? (
                        <DeliveryEtaCountdown fechaHoraEstimadaDelivery={pedido.fechaHoraEstimadaDelivery} now={etaClock.now} />
                      ) : hasEta ? (
                        <button
                          type="button"
                          className="orders-eta-trigger"
                          onClick={() => handleEtaPauseClick(pedido)}
                          aria-pressed={etaClock.paused}
                          title={etaClock.paused ? "Reanudar cronómetro" : "Pausar cronómetro"}
                          aria-label={`${etaPresentation.description}. ${etaClock.paused ? "Reanudar" : "Pausar"} cronómetro del pedido #${pedido.id}`}
                        >
                          <DeliveryEtaCountdown fechaHoraEstimadaDelivery={pedido.fechaHoraEstimadaDelivery} now={etaClock.now} />
                          {etaClock.paused && <Pause size={11} aria-hidden="true" />}
                        </button>
                      ) : (
                        <span className="orders-delivery-eta--empty">Sin ETA</span>
                      )}
                      <button type="button" className="orders-eta-edit" onClick={() => setEtaPedido(pedido)} title="Editar tiempo estimado del delivery" aria-label={`Editar tiempo estimado del delivery del pedido #${pedido.id}`}>
                        <Pencil size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <span>
                      <Clock3 size={15} />
                      {esPedidosYa && !hasEta ? "Sin ETA" : horarioPedido}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="orders-mobile-card__summary"
                  onClick={() => abrirDetalle(pedido)}
                >
                  <span className="orders-mobile-card__client">
                    {pedido.cliente || "Sin cliente"}
                    {pedido.deliveryToday && (
                      <CalendarClock
                        className="orders-programmed-client-icon"
                        size={15}
                        aria-label="Pedido programado"
                      />
                    )}
                  </span>
                  <span className="orders-mobile-card__meta">
                    {esPedidosYa && numeroPedidoExterno !== "-"
                      ? `Pedidos Ya ${numeroPedidoExterno}`
                      : pedido.pago}
                    {` · ${pedido.tipoVenta}`}
                  </span>
                </button>

                <div className="orders-mobile-card__payment">
                  <span>Estado de pago</span>
                  <PaymentStatusBadge
                    pagado={pedido.pagado}
                    onClick={pedido.estado === "Entregado" || pedido.estado === "Cancelado" ? undefined : () => onChangePaymentStatus(pedido)}
                    busy={updatingPaymentId === pedido.id}
                  />
                </div>

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
              <th>Estado de pago</th>
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
                <td colSpan={8}>
                  <OrdersLoadingState />
                </td>
              </tr>
            ) : pedidos.length > 0 ? (
              pedidos.map((pedido) => {
                const puedeAvanzar = puedeAvanzarEstado(pedido.estado);
                const puedeCancelar = puedeCancelarPedido(pedido.estado);
                const puedeCambiarPagoPedido = puedeCambiarPago(pedido.estado);
                const puedeEditar = puedeEditarPedido(pedido.estado);
                const horarioPedido = getHorarioPedido(pedido.horario);
                const schedulePresentation = getSchedulePresentation(pedido, now);
                const editableEta = canEditDeliveryEta(pedido);
                const etaClock = getDeliveryEtaClock(pedido.fechaHoraEstimadaDelivery ?? "", now, etaPlayback[pedido.id]);
                const etaPresentation = getDeliveryEtaPresentation(pedido.fechaHoraEstimadaDelivery, etaClock.now);
                const hasEta = etaPresentation !== null;

                return (
                  <tr
                    key={pedido.id}
                    className={
                      selectedPedido?.id === pedido.id
                        ? "orders-row-active"
                        : ""
                    }
                  >
                    <td data-label="Cliente">
                      <div className="orders-client-cell">
                        <div className="orders-client-cell__name">
                          <strong>{pedido.cliente || "Sin cliente"}</strong>
                          {pedido.deliveryToday && (
                            <CalendarClock
                              className="orders-programmed-client-icon"
                              size={15}
                              aria-label="Pedido programado"
                            />
                          )}
                        </div>
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

                    <td data-label="Estado de pago">
                      <PaymentStatusBadge
                        pagado={pedido.pagado}
                        onClick={pedido.estado === "Entregado" || pedido.estado === "Cancelado" ? undefined : () => onChangePaymentStatus(pedido)}
                        busy={updatingPaymentId === pedido.id}
                      />
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
                      {editableEta ? (
                        <span className="orders-eta-controls">
                          {hasEta && etaPresentation.tone === "finished" ? (
                            <DeliveryEtaCountdown fechaHoraEstimadaDelivery={pedido.fechaHoraEstimadaDelivery} now={etaClock.now} />
                          ) : hasEta ? (
                            <button
                              type="button"
                              className="orders-eta-trigger"
                              onClick={() => handleEtaPauseClick(pedido)}
                              aria-pressed={etaClock.paused}
                              title={etaClock.paused ? "Reanudar cronómetro" : "Pausar cronómetro"}
                              aria-label={`${etaPresentation.description}. ${etaClock.paused ? "Reanudar" : "Pausar"} cronómetro del pedido #${pedido.id}`}
                            >
                              <DeliveryEtaCountdown fechaHoraEstimadaDelivery={pedido.fechaHoraEstimadaDelivery} now={etaClock.now} />
                              {etaClock.paused && <Pause size={11} aria-hidden="true" />}
                            </button>
                          ) : (
                            <span className="orders-delivery-eta--empty">Sin ETA</span>
                          )}
                          <button type="button" className="orders-eta-edit" onClick={() => setEtaPedido(pedido)} title="Editar tiempo estimado del delivery" aria-label={`Editar tiempo estimado del delivery del pedido #${pedido.id}`}>
                            <Pencil size={12} aria-hidden="true" />
                          </button>
                        </span>
                      ) : isPedidosYa(pedido) && !hasEta ? (
                        <span className="orders-schedule-value">Sin ETA</span>
                      ) : (
                        <span
                          className={`orders-schedule-value orders-schedule-value--${schedulePresentation.tone} ${
                            pedido.estado === "Preparado" ? "orders-schedule-value--ready" : ""
                          }`}
                          title={schedulePresentation.title}
                          aria-label={schedulePresentation.title || schedulePresentation.label}
                        >
                          {schedulePresentation.tone !== "normal" && (
                            <span className="orders-schedule-dot" aria-hidden="true" />
                          )}
                          {schedulePresentation.label}
                        </span>
                      )}
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
                <td colSpan={8}>
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
      {etaPedido && (
        <DeliveryEtaDialog
          key={etaPedido.id}
          pedido={etaPedido}
          onClose={() => setEtaPedido(null)}
          onSave={(minutes) => onChangeDeliveryEta(etaPedido, minutes)}
        />
      )}
    </>
  );
}

export default PedidosTable;
