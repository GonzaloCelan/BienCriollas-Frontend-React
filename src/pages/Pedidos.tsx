import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { gooeyToast } from "goey-toast";
import { TOAST_RAPIDO_TIMING } from "../config/toast";

import KpiCard from "../components/KpiCard";
import PedidosTable from "../components/PedidosTable";
import NewOrderDrawer from "../components/NewOrderDrawer";
import ScheduledOrdersView from "../components/ScheduledOrdersView";
import CriticalStockPanel from "../components/CriticalStockPanel";
import AppButton from "../components/AppButton";
import AppConfirmDialog from "../components/AppConfirmDialog";

import type { Pedido } from "../components/PedidosTable";

import pendingAnimation from "../assets/lotties/pending.json";
import readyAnimation from "../assets/lotties/ready2.json";
import deliveredAnimation from "../assets/lotties/entregados.json";
import cancelledAnimation from "../assets/lotties/cancel.json";

import {
  actualizarEstadoPedidoApi,
  actualizarTipoPagoPedidoApi,
  obtenerPedidosProgramadosApi,
  obtenerResumenPedidosProgramadosApi,
  obtenerPaginaPedidosPorEstado,
  obtenerTodosLosPedidosPorEstado,
  obtenerDetallePedidoApi,
  type EstadoBackend,
  type TipoPagoBackend,
  type ScheduledOrdersSummary,
} from "../services/pedidosApi";
import {
  usePedidosRealtime,
  type PedidoEvento,
} from "../hooks/usePedidosRealtime";

import "../styles/pedidos.css";
import "../styles/kpiCard.css";
import "../styles/newOrderDrawer.css";
import "../styles/criticalStockPanel.css";
import "../styles/ordersStates.css";
import "../styles/pedidosTable.css";
import "../styles/appButton.css";

type StatusCounts = {
  pendientes: number;
  preparados: number;
  entregados: number;
  cancelados: number;
};

type OrdersView = "TODAY" | "SCHEDULED";

const EMPTY_SCHEDULED_SUMMARY: ScheduledOrdersSummary = {
  totalPedidosProgramados: 0,
  pedidosParaHoy: 0,
  pedidosParaManana: 0,
  totalUnidadesComprometidas: 0,
};

function getFechaPedidosDelDia() {
  const fecha = new Date();

  const diaSemana = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
  }).format(fecha);

  const dia = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
  }).format(fecha);

  const mes = new Intl.DateTimeFormat("es-AR", {
    month: "long",
  }).format(fecha);

  const año = new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
  }).format(fecha);

  return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} ${dia} de ${
    mes.charAt(0).toUpperCase() + mes.slice(1)
  } de ${año}`;
}

function getEstadoBackendSiguiente(estado: Pedido["estado"]): EstadoBackend {
  if (estado === "Pendiente") return "PREPARADO";
  if (estado === "Preparado") return "ENTREGADO";
  return "ENTREGADO";
}

function getEstadoFrontendSiguiente(estado: Pedido["estado"]): Pedido["estado"] {
  if (estado === "Pendiente") return "Preparado";
  if (estado === "Preparado") return "Entregado";
  return "Entregado";
}

function getCountKey(estado: EstadoBackend): keyof StatusCounts {
  if (estado === "PENDIENTE") return "pendientes";
  if (estado === "PREPARADO") return "preparados";
  if (estado === "ENTREGADO") return "entregados";
  return "cancelados";
}

function getNuevoPagoBackend(pagoActual: string): TipoPagoBackend {
  const value = pagoActual.toLowerCase();

  if (value.includes("transfer")) {
    return "EFECTIVO";
  }

  return "TRANSFERENCIA";
}

function getPagoFrontend(pagoBackend: TipoPagoBackend) {
  if (pagoBackend === "TRANSFERENCIA") return "Transferencia";
  if (pagoBackend === "COMBINADO") return "Combinado";
  return "Efectivo";
}

function formatScheduledDelivery(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const label = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return `${label.charAt(0).toUpperCase() + label.slice(1)} · ${timeValue.slice(0, 5)}`;
}

type PedidosProps = {
  onNavigateToStock: () => void;
};

function Pedidos({ onNavigateToStock }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [view, setView] = useState<OrdersView>("TODAY");
  const [scheduledOrders, setScheduledOrders] = useState<Pedido[]>([]);
  const [scheduledSummary, setScheduledSummary] = useState<ScheduledOrdersSummary>(EMPTY_SCHEDULED_SUMMARY);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [scheduledError, setScheduledError] = useState("");
  const [estadoActivo, setEstadoActivo] =
    useState<EstadoBackend>("PENDIENTE");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderMode, setNewOrderMode] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pedidoACancelar, setPedidoACancelar] = useState<Pedido | null>(null);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);

  const [stockRefreshKey, setStockRefreshKey] = useState(0);

  const [counts, setCounts] = useState<StatusCounts>({
    pendientes: 0,
    preparados: 0,
    entregados: 0,
    cancelados: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function refrescarStockCritico() {
    setStockRefreshKey((prev) => prev + 1);
  }

  async function cargarPedidosProgramados(
    fecha = scheduledDate,
    silencioso = false
  ) {
    try {
      if (!silencioso) setScheduledLoading(true);
      setScheduledError("");
      const [orders, summary] = await Promise.all([
        obtenerPedidosProgramadosApi(fecha || undefined),
        obtenerResumenPedidosProgramadosApi(),
      ]);
      const withDetails = await Promise.all(
        orders.map(async (pedido) => {
          try {
            return { ...pedido, items: await obtenerDetallePedidoApi(pedido.id) };
          } catch {
            return pedido;
          }
        })
      );
      setScheduledOrders(withDetails);
      setScheduledSummary(summary);
    } catch (scheduledLoadError) {
      console.error(scheduledLoadError);
      setScheduledError(
        scheduledLoadError instanceof Error
          ? scheduledLoadError.message
          : "No se pudieron cargar los pedidos programados."
      );
    } finally {
      if (!silencioso) setScheduledLoading(false);
    }
  }

  async function cargarPedidosPorEstado(
    estado: EstadoBackend,
    silencioso = false
  ) {
    try {
      if (!silencioso) setLoading(true);
      setError("");

	      const data = await obtenerTodosLosPedidosPorEstado(estado, 50);
	      setPedidos(data.pedidos);

	      setCounts((prev) => ({
	        ...prev,
	        [getCountKey(estado)]: data.totalElements,
      }));
    } catch (error) {
      console.error(error);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }

  async function cargarContadores() {
    try {
      const [pendientes, preparados, entregados, cancelados] =
        await Promise.all([
	          obtenerPaginaPedidosPorEstado("PENDIENTE", 0, 1),
	          obtenerPaginaPedidosPorEstado("PREPARADO", 0, 1),
	          obtenerPaginaPedidosPorEstado("ENTREGADO", 0, 1),
	          obtenerPaginaPedidosPorEstado("CANCELADO", 0, 1),
	        ]);

	      setCounts({
	        pendientes: pendientes.totalElements,
	        preparados: preparados.totalElements,
	        entregados: entregados.totalElements,
	        cancelados: cancelados.totalElements,
      });
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void cargarPedidosPorEstado(estadoActivo), 0);
    return () => window.clearTimeout(task);
  }, [estadoActivo]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void cargarContadores();
      void cargarPedidosProgramados();
    }, 0);
    return () => window.clearTimeout(task);
    // Initial dashboard load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view !== "SCHEDULED") return;
    const task = window.setTimeout(
      () => void cargarPedidosProgramados(scheduledDate),
      0
    );
    return () => window.clearTimeout(task);
    // Refetch when the selected scheduled date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledDate]);

  useEffect(() => {
    function refreshOnFocus() {
      void Promise.all([
        cargarPedidosPorEstado(estadoActivo, true),
        cargarContadores(),
        cargarPedidosProgramados(scheduledDate, true),
      ]);
    }
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
    // The handler is rebound when the active filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoActivo, scheduledDate]);

  async function avanzarEstadoPedido(pedido: Pedido) {
    if (pedido.estado === "Entregado" || pedido.estado === "Cancelado") return;

    const nuevoEstadoBackend = getEstadoBackendSiguiente(pedido.estado);
    const nuevoEstadoFrontend = getEstadoFrontendSiguiente(pedido.estado);

    try {
      await actualizarEstadoPedidoApi(pedido.id, nuevoEstadoBackend);

      setPedidos((prev) => prev.filter((item) => item.id !== pedido.id));

      setCounts((prev) => {
        const estadoActualKey =
          pedido.estado === "Pendiente" ? "pendientes" : "preparados";

        const nuevoEstadoKey =
          nuevoEstadoFrontend === "Preparado" ? "preparados" : "entregados";

        return {
          ...prev,
          [estadoActualKey]: Math.max(prev[estadoActualKey] - 1, 0),
          [nuevoEstadoKey]: prev[nuevoEstadoKey] + 1,
        };
      });

      gooeyToast.success("Estado actualizado", {
        description: `Pedido #${pedido.id} pasó a ${nuevoEstadoFrontend}.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
      await Promise.all([
        cargarPedidosProgramados(scheduledDate, true),
        cargarContadores(),
      ]);
      refrescarStockCritico();
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo cambiar el estado", {
        description:
          error instanceof Error
            ? error.message
            : `El pedido #${pedido.id} no fue modificado.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    }
  }

  async function cambiarTipoPagoPedido(pedido: Pedido) {
    if (pedido.estado === "Cancelado") return;

    const nuevoPagoBackend = getNuevoPagoBackend(pedido.pago);
    const nuevoPagoFrontend = getPagoFrontend(nuevoPagoBackend);

    try {
      await actualizarTipoPagoPedidoApi(pedido.id, nuevoPagoBackend);

      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id
            ? {
                ...item,
                pago: nuevoPagoFrontend,
              }
            : item
        )
      );

      gooeyToast.success("Medio de pago actualizado", {
        description: `Pedido #${pedido.id}: ${nuevoPagoFrontend}.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo cambiar el pago", {
        description: `El pedido #${pedido.id} mantiene su medio de pago anterior.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    }
  }

  async function cargarDetallePedido(idPedido: number) {
    return await obtenerDetallePedidoApi(idPedido);
  }

  function abrirConfirmacionCancelacion(idPedido: number) {
    const pedido = [...pedidos, ...scheduledOrders].find(
      (item) => item.id === idPedido
    );

    if (!pedido) {
      gooeyToast.error("Pedido no encontrado", {
        description: "Actualizá la lista e intentá nuevamente.",
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
      return;
    }

    setPedidoACancelar(pedido);
  }

  async function confirmarCancelacionPedido() {
    if (!pedidoACancelar) return;

    try {
      setCancelandoPedido(true);

      await actualizarEstadoPedidoApi(pedidoACancelar.id, "CANCELADO");

      setPedidos((prev) =>
        prev.filter((pedido) => pedido.id !== pedidoACancelar.id)
      );
      setScheduledOrders((prev) =>
        prev.filter((pedido) => pedido.id !== pedidoACancelar.id)
      );

      const pedidoCanceladoId = pedidoACancelar.id;
      setPedidoACancelar(null);
      refrescarStockCritico();
      await Promise.all([
        cargarPedidosPorEstado(estadoActivo, true),
        cargarContadores(),
        cargarPedidosProgramados(scheduledDate, true),
      ]);

      gooeyToast.success("Pedido cancelado", {
        description: `El pedido #${pedidoCanceladoId} fue cancelado correctamente.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo cancelar el pedido", {
        description:
          error instanceof Error
            ? error.message
            : `El pedido #${pedidoACancelar.id} continúa en su estado anterior.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } finally {
      setCancelandoPedido(false);
    }
  }

  function cerrarNuevoPedido() {
    setNewOrderOpen(false);
    setPedidoEditando(null);
  }

  function abrirNuevoPedidoManual() {
    setPedidoEditando(null);
    setNewOrderMode("IMMEDIATE");
    setNewOrderOpen(true);
  }

  function abrirProgramarPedido() {
    setPedidoEditando(null);
    setNewOrderMode("SCHEDULED");
    setNewOrderOpen(true);
  }

  async function abrirEditorPedido(pedido: Pedido) {
    if (editingId !== null) return;

    try {
      setEditingId(pedido.id);
      const detalles = await obtenerDetallePedidoApi(pedido.id);

      setPedidoEditando({
        ...pedido,
        items: detalles ?? [],
      });
      setNewOrderMode(pedido.fechaEntrega ? "SCHEDULED" : "IMMEDIATE");
      setNewOrderOpen(true);
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo abrir el pedido", {
        description: `No se pudieron cargar los datos del pedido #${pedido.id}.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } finally {
      setEditingId(null);
    }
  }

  usePedidosRealtime((evento: PedidoEvento) => {
    console.info("Pedido actualizado en tiempo real:", evento);

    void Promise.all([
      cargarPedidosPorEstado(estadoActivo, true),
      cargarContadores(),
      cargarPedidosProgramados(scheduledDate, true),
    ]).then(() => {
      refrescarStockCritico();
    });
  });

  async function handlePedidoCreado(pedido: Pedido, totalUnidades: number) {
    const programado = Boolean(pedido.fechaEntrega || pedido.scheduled);
    if (programado) {
      setView("SCHEDULED");
      setScheduledDate("");
    } else {
      setView("TODAY");
      setEstadoActivo("PENDIENTE");
    }

    await Promise.all([
      cargarPedidosPorEstado("PENDIENTE", programado),
      cargarContadores(),
      cargarPedidosProgramados("", programado),
    ]);

    if (!programado) refrescarStockCritico();
    gooeyToast.success(programado ? "Pedido programado correctamente" : "Pedido creado", {
      description:
        programado && pedido.fechaEntrega
          ? `${formatScheduledDelivery(pedido.fechaEntrega, pedido.horario)} · ${pedido.cliente} · ${totalUnidades} empanadas`
          : "El pedido fue registrado correctamente.",
      timing: TOAST_RAPIDO_TIMING,
      showProgress: true,
      showTimestamp: false,
      preset: "bouncy",
    });
  }

  async function handlePedidoActualizado() {
    await Promise.all([
      cargarPedidosPorEstado(estadoActivo),
      cargarContadores(),
      cargarPedidosProgramados(scheduledDate),
    ]);

    refrescarStockCritico();
    gooeyToast.success("Pedido actualizado", {
      description: "Los cambios se guardaron correctamente.",
      timing: TOAST_RAPIDO_TIMING,
      showTimestamp: false,
    });
  }

  const fechaPedidos = getFechaPedidosDelDia();
  const orderActions = (
    <div className="orders-hero__actions">
      <AppButton
        className="orders-new-button"
        variant="primary"
        size="md"
        onClick={abrirNuevoPedidoManual}
      >
        Nuevo pedido
      </AppButton>
      <AppButton
        className="orders-schedule-button"
        variant="secondary"
        size="md"
        icon={<CalendarClock size={17} />}
        onClick={abrirProgramarPedido}
      >
        Programar pedido
      </AppButton>
    </div>
  );
  const scheduledOrderAction = (
    <div className="orders-hero__actions">
      <AppButton
        className="orders-schedule-button"
        variant="secondary"
        size="md"
        icon={<CalendarClock size={17} />}
        onClick={abrirProgramarPedido}
      >
        Programar pedido
      </AppButton>
    </div>
  );

  return (
    <section className="orders-page">
      <div className="orders-mobile-heading">
        <div>
          <span>Bien Criollas</span>
          <h1>{view === "TODAY" ? "Pedidos de hoy" : "Programados"}</h1>
        </div>
      </div>

      <div className="orders-hero">
        <div className="orders-hero-text">
          <p className="orders-eyebrow">
            {view === "TODAY" ? "Pedidos del día" : "Agenda de pedidos"}
          </p>
          <h2>{view === "TODAY" ? fechaPedidos : "Próximas entregas"}</h2>
          <span>
            {view === "TODAY"
              ? "Estás registrando pedidos para esta fecha."
              : "Todo lo que fue encargado para los próximos días."}
          </span>
        </div>
      </div>

      <nav className="orders-view-tabs" aria-label="Vista de pedidos">
        <button type="button" className={view === "TODAY" ? "is-active" : ""} onClick={() => setView("TODAY")}>Pedidos de hoy</button>
        <button type="button" className={view === "SCHEDULED" ? "is-active" : ""} onClick={() => setView("SCHEDULED")}>
          Programados
          {scheduledSummary.totalPedidosProgramados > 0 && <strong>{scheduledSummary.totalPedidosProgramados}</strong>}
        </button>
      </nav>

      <div className="orders-scheduled-alerts">
        <AnimatePresence initial={false}>
          {scheduledSummary.pedidosParaHoy > 0 && (
            <motion.section
              layout
              key="scheduled-today"
              className="orders-scheduled-alert orders-scheduled-alert--today"
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <CalendarClock size={20} />
              <div><strong>Tenés {scheduledSummary.pedidosParaHoy} {scheduledSummary.pedidosParaHoy === 1 ? "pedido programado" : "pedidos programados"} para hoy</strong><span>Ya están incluidos en la operación del día.</span></div>
            </motion.section>
          )}

          {scheduledSummary.pedidosParaManana > 0 && (
            <motion.section
              layout
              key="scheduled-tomorrow"
              className="orders-scheduled-alert orders-scheduled-alert--tomorrow"
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <CalendarClock size={18} />
              <div><strong>Mañana hay {scheduledSummary.pedidosParaManana} {scheduledSummary.pedidosParaManana === 1 ? "pedido programado" : "pedidos programados"}.</strong><span>Revisá la agenda y el stock comprometido con anticipación.</span></div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {view === "TODAY" ? <>
        <div className="orders-stats">
        <KpiCard
          title="Pendientes"
          value={counts.pendientes}
          animationData={pendingAnimation}
          active={estadoActivo === "PENDIENTE"}
          onClick={() => setEstadoActivo("PENDIENTE")}
        />

        <KpiCard
          title="Preparados"
          value={counts.preparados}
          animationData={readyAnimation}
          active={estadoActivo === "PREPARADO"}
          onClick={() => setEstadoActivo("PREPARADO")}
        />

        <KpiCard
          title="Entregados"
          value={counts.entregados}
          animationData={deliveredAnimation}
          active={estadoActivo === "ENTREGADO"}
          onClick={() => setEstadoActivo("ENTREGADO")}
        />

        <KpiCard
          title="Cancelados"
          value={counts.cancelados}
          animationData={cancelledAnimation}
          active={estadoActivo === "CANCELADO"}
          onClick={() => setEstadoActivo("CANCELADO")}
        />
        </div>

        <div className="orders-actions-row">{orderActions}</div>

        <div className="orders-content-grid">
        <div className="orders-panel">
          {error && <div className="orders-error">{error}</div>}

          <PedidosTable
            pedidos={pedidos}
            loading={loading}
            estadoActivo={estadoActivo}
            onNextStatus={avanzarEstadoPedido}
            onDeletePedido={abrirConfirmacionCancelacion}
            onLoadDetail={cargarDetallePedido}
            onChangePayment={cambiarTipoPagoPedido}
            onEditPedido={abrirEditorPedido}
            editingId={editingId}
          />
        </div>

        <CriticalStockPanel key={stockRefreshKey} onNavigateToStock={onNavigateToStock} />
        </div>
      </> : (
        <>
          <div className="orders-actions-row">{scheduledOrderAction}</div>
          <ScheduledOrdersView
            pedidos={scheduledOrders}
            summary={scheduledSummary}
            loading={scheduledLoading}
            error={scheduledError}
            selectedDate={scheduledDate}
            onDateChange={setScheduledDate}
            onClearDate={() => setScheduledDate("")}
            onEdit={abrirEditorPedido}
            onCancel={abrirConfirmacionCancelacion}
            onLoadDetail={cargarDetallePedido}
          />
        </>
      )}

      <NewOrderDrawer
        open={newOrderOpen}
        onClose={cerrarNuevoPedido}
        mode={newOrderMode}
        pedidoEditando={pedidoEditando}
        onCreated={handlePedidoCreado}
        onUpdated={handlePedidoActualizado}
      />

      <AppConfirmDialog
        open={pedidoACancelar !== null}
        title={pedidoACancelar?.fechaEntrega ? "¿Cancelar pedido programado?" : "Cancelar pedido"}
        description={
          pedidoACancelar
            ? pedidoACancelar.fechaEntrega
              ? `${pedidoACancelar.cliente || "Sin cliente"} · ${formatScheduledDelivery(pedidoACancelar.fechaEntrega, pedidoACancelar.horario)}. El backend actualizará automáticamente el stock comprometido.`
              : `Vas a cancelar el pedido de ${pedidoACancelar.cliente || "sin cliente"}. Esta acción lo moverá al estado Cancelado.`
            : "Vas a cancelar este pedido."
        }
        confirmText="Cancelar pedido"
        cancelText="Volver"
        loading={cancelandoPedido}
        variant="danger"
        onConfirm={confirmarCancelacionPedido}
        onCancel={() => setPedidoACancelar(null)}
      />

    </section>
  );
}

export default Pedidos;
