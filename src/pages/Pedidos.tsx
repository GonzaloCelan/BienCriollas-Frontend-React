import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { TOAST_RAPIDO_TIMING } from "../config/toast";

import KpiCard from "../components/KpiCard";
import PedidosTable from "../components/PedidosTable";
import NewOrderDrawer from "../components/NewOrderDrawer";
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
  obtenerPaginaPedidosPorEstado,
  obtenerTodosLosPedidosPorEstado,
  obtenerDetallePedidoApi,
  type EstadoBackend,
  type TipoPagoBackend,
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

function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estadoActivo, setEstadoActivo] =
    useState<EstadoBackend>("PENDIENTE");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
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
    cargarPedidosPorEstado(estadoActivo);
  }, [estadoActivo]);

  useEffect(() => {
    cargarContadores();
  }, []);

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
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo cambiar el estado", {
        description: `El pedido #${pedido.id} no fue modificado.`,
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
    const pedido = pedidos.find((item) => item.id === idPedido);

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

      setCounts((prev) => {
        const estadoActualKey = getCountKey(estadoActivo);

        return {
          ...prev,
          [estadoActualKey]: Math.max(prev[estadoActualKey] - 1, 0),
          cancelados:
            pedidoACancelar.estado === "Cancelado"
              ? prev.cancelados
              : prev.cancelados + 1,
        };
      });

      const pedidoCanceladoId = pedidoACancelar.id;
      setPedidoACancelar(null);
      refrescarStockCritico();

      gooeyToast.success("Pedido cancelado", {
        description: `El pedido #${pedidoCanceladoId} fue cancelado correctamente.`,
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } catch (error) {
      console.error(error);
      gooeyToast.error("No se pudo cancelar el pedido", {
        description: `El pedido #${pedidoACancelar.id} continúa en su estado anterior.`,
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
    ]).then(() => {
      refrescarStockCritico();
    });
  });

  async function handlePedidoCreado() {
    setEstadoActivo("PENDIENTE");

    await Promise.all([
      cargarPedidosPorEstado("PENDIENTE"),
      cargarContadores(),
    ]);

    refrescarStockCritico();
    gooeyToast.success("Pedido creado", {
      description: "El pedido fue registrado correctamente.",
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
    ]);

    refrescarStockCritico();
    gooeyToast.success("Pedido actualizado", {
      description: "Los cambios se guardaron correctamente.",
      timing: TOAST_RAPIDO_TIMING,
      showTimestamp: false,
    });
  }

  const fechaPedidos = getFechaPedidosDelDia();

  return (
    <section className="orders-page">
      <div className="orders-mobile-heading">
        <div>
          <span>Bien Criollas</span>
          <h1>Pedidos de hoy</h1>
        </div>
      </div>

      <div className="orders-hero">
        <div className="orders-hero-text">
          <p className="orders-eyebrow">Pedidos del día</p>
          <h2>{fechaPedidos}</h2>
          <span>Estás registrando pedidos para esta fecha.</span>
        </div>
      </div>

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

      <div className="orders-toolbar">
        <AppButton
          className="orders-new-button"
          variant="primary"
          size="md"
          icon={<Plus size={18} />}
          onClick={abrirNuevoPedidoManual}
        >
          Nuevo pedido
        </AppButton>

      </div>

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

        <CriticalStockPanel key={stockRefreshKey} />
      </div>

      <NewOrderDrawer
        open={newOrderOpen}
        onClose={cerrarNuevoPedido}
        pedidoEditando={pedidoEditando}
        onCreated={handlePedidoCreado}
        onUpdated={handlePedidoActualizado}
      />

      <AppConfirmDialog
        open={pedidoACancelar !== null}
        title="Cancelar pedido"
        description={
          pedidoACancelar
            ? `Vas a cancelar el pedido de ${
                pedidoACancelar.cliente || "sin cliente"
              }. Esta acción lo moverá al estado Cancelado.`
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
