import { useEffect, useState } from "react";

import KpiCard from "../components/KpiCard";
import PedidosTable from "../components/PedidosTable";
import NewOrderDrawer from "../components/NewOrderDrawer";
import CriticalStockPanel from "../components/CriticalStockPanel";
import OrderToast from "../components/OrderToast";
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
  obtenerPedidosPorEstado,
  obtenerDetallePedidoApi,
  type EstadoBackend,
  type TipoPagoBackend,
} from "../services/pedidosApi";

import "../styles/pedidos.css";
import "../styles/kpiCard.css";
import "../styles/newOrderDrawer.css";
import "../styles/criticalStockPanel.css";
import "../styles/orderToast.css";
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
  return "Efectivo";
}

function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estadoActivo, setEstadoActivo] =
    useState<EstadoBackend>("PENDIENTE");

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
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

  async function cargarPedidosPorEstado(estado: EstadoBackend) {
    try {
      setLoading(true);
      setError("");

      const data = await obtenerPedidosPorEstado(estado, 0, 50);
      setPedidos(data);

      setCounts((prev) => ({
        ...prev,
        [getCountKey(estado)]: data.length,
      }));
    } catch (error) {
      console.error(error);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function cargarContadores() {
    try {
      const [pendientes, preparados, entregados, cancelados] =
        await Promise.all([
          obtenerPedidosPorEstado("PENDIENTE", 0, 50),
          obtenerPedidosPorEstado("PREPARADO", 0, 50),
          obtenerPedidosPorEstado("ENTREGADO", 0, 50),
          obtenerPedidosPorEstado("CANCELADO", 0, 50),
        ]);

      setCounts({
        pendientes: pendientes.length,
        preparados: preparados.length,
        entregados: entregados.length,
        cancelados: cancelados.length,
      });
    } catch (error) {
      console.error(error);
    }
  }

  function mostrarToastPedidoCreado() {
    setToastOpen(true);

    window.setTimeout(() => {
      setToastOpen(false);
    }, 3200);
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
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el estado del pedido.");
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
    } catch (error) {
      console.error(error);
      alert("No se pudo cambiar el medio de pago del pedido.");
    }
  }

  async function cargarDetallePedido(idPedido: number) {
    return await obtenerDetallePedidoApi(idPedido);
  }

  function abrirConfirmacionCancelacion(idPedido: number) {
    const pedido = pedidos.find((item) => item.id === idPedido);

    if (!pedido) {
      alert("No se encontró el pedido.");
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

      setPedidoACancelar(null);
      refrescarStockCritico();
    } catch (error) {
      console.error(error);
      alert("No se pudo cancelar el pedido.");
    } finally {
      setCancelandoPedido(false);
    }
  }

  function cerrarNuevoPedido() {
    setNewOrderOpen(false);
  }

  async function handlePedidoCreado() {
    setEstadoActivo("PENDIENTE");

    await Promise.all([
      cargarPedidosPorEstado("PENDIENTE"),
      cargarContadores(),
    ]);

    refrescarStockCritico();
    mostrarToastPedidoCreado();
  }

  const fechaPedidos = getFechaPedidosDelDia();

  return (
    <section className="orders-page">
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

      <AppButton
        variant="primary"
        size="md"
        onClick={() => setNewOrderOpen(true)}
      >
        Nuevo pedido
      </AppButton>

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
          />
        </div>

        <CriticalStockPanel key={stockRefreshKey} />
      </div>

      <NewOrderDrawer
        open={newOrderOpen}
        onClose={cerrarNuevoPedido}
        onCreated={handlePedidoCreado}
      />

      <OrderToast
        show={toastOpen}
        message="El pedido fue registrado correctamente."
        onClose={() => setToastOpen(false)}
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