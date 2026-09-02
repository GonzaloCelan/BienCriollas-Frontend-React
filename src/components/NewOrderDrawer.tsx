import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { TOAST_RAPIDO_TIMING } from "../config/toast";


import {
  actualizarPedidoApi,
  crearPedidoApi,
  type PedidoRequestDTO,
  type TipoPagoBackend,
  type TipoVentaBackend,
} from "../services/pedidosApi";
import type { Pedido } from "./PedidosTable";

import { obtenerStockActual, type StockItem } from "../services/stockApi";

import { imprimirComandaPedido } from "../utils/printComanda";
import { calcularTotalPedido } from "../utils/calcularTotalPedido";
import { useCatalogo } from "../context/CatalogoContext";

import "../styles/newOrderDrawer.css";

type NewOrderDrawerProps = {
  open: boolean;
  onClose: () => void;
  pedidoEditando?: Pedido | null;
  onCreated?: () => void | Promise<void>;
  onUpdated?: () => void | Promise<void>;
};

type StockAlert = {
  title: string;
  description: string;
};

const VARIEDADES: Record<number, { nombre: string; descripcion: string }> = {
  1: { nombre: "Carne", descripcion: "Empanada de carne tradicional" },
  2: { nombre: "Verdura", descripcion: "Empanada de verdura" },
  3: { nombre: "Choclo", descripcion: "Empanada de choclo" },
  4: { nombre: "Pollo", descripcion: "Empanada de pollo" },
  5: { nombre: "Atún", descripcion: "Empanada de atún" },
  6: { nombre: "Capresse", descripcion: "Mozzarella, tomate y albahaca" },
  7: { nombre: "Fugazza", descripcion: "Cebolla y mozzarella" },
  8: { nombre: "Queso azul", descripcion: "Queso azul y mozzarella" },
  9: { nombre: "Bondiola", descripcion: "Empanada de bondiola" },
  10: {
    nombre: "Vacío desmenuzado",
    descripcion: "Empanada de vacío desmenuzado",
  },
  11: { nombre: "Campo", descripcion: "Empanada campo" },
  12: { nombre: "Jamón y queso", descripcion: "Jamón cocido y queso" },
};

const variedadesList = Object.entries(VARIEDADES).map(([id, data]) => ({
  id: Number(id),
  ...data,
}));

function parseMoney(value: string) {
  const cleanValue = value.replace(/[^\d]/g, "");
  return Number(cleanValue || 0);
}

function normalizarTipoVentaPedido(tipoVenta: string): TipoVentaBackend {
  return tipoVenta.toLowerCase().includes("pedidos")
    ? "PEDIDOS_YA"
    : "PARTICULAR";
}

function normalizarTipoPagoPedido(tipoPago: string): TipoPagoBackend {
  const value = tipoPago.toLowerCase();

  if (value.includes("combin")) return "COMBINADO";
  if (value.includes("transfer")) return "TRANSFERENCIA";
  return "EFECTIVO";
}

function obtenerNumeroPedidosYa(pedido: Pedido) {
  return String(
    pedido.numeroPedidoPedidosYa ??
      pedido.numeroPedido ??
      pedido.numeroPedidoYa ??
      pedido.nroPedido ??
      ""
  );
}

function NewOrderDrawer({
  open,
  onClose,
  pedidoEditando = null,
  onCreated,
  onUpdated,
}: NewOrderDrawerProps) {
  const {
    catalogo,
    catalogoLoading,
    catalogoError,
    catalogoUsandoRespaldo,
    recargarCatalogo,
  } = useCatalogo();
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cliente, setCliente] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [hora, setHora] = useState("");
  const [tipoPago, setTipoPago] = useState<TipoPagoBackend>("EFECTIVO");
  const [tipoVenta, setTipoVenta] = useState<TipoVentaBackend>("PARTICULAR");
  const [totalManual, setTotalManual] = useState("");
  const [totalModificadoManualmente, setTotalModificadoManualmente] =
    useState(false);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [cantidadesOriginales, setCantidadesOriginales] = useState<
    Record<number, number>
  >({});
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");

  const [stockActual, setStockActual] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");

  const [stockAlert, setStockAlert] = useState<StockAlert | null>(null);

  const esEdicion = pedidoEditando !== null;

  function cargarDatosFormulario(pedido: Pedido | null) {
    if (!pedido) {
      resetForm();
      return;
    }

    const cantidadesPedido = (pedido.items ?? []).reduce<Record<number, number>>(
      (acc, item) => {
        if (item.idVariedad && item.cantidad > 0) {
          acc[item.idVariedad] = Number(item.cantidad);
        }

        return acc;
      },
      {}
    );
    const venta = normalizarTipoVentaPedido(pedido.tipoVenta);
    const pago = normalizarTipoPagoPedido(pedido.pago);

    setCliente(pedido.cliente ?? "");
    setNumeroPedido(obtenerNumeroPedidosYa(pedido));
    setHora(pedido.horario && pedido.horario !== "-" ? pedido.horario.slice(0, 5) : "");
    setTipoVenta(venta);
    setTipoPago(pago);
    setCantidades(cantidadesPedido);
    setCantidadesOriginales(cantidadesPedido);
    setTotalManual(venta === "PEDIDOS_YA" ? String(pedido.total ?? "") : "");
    setTotalModificadoManualmente(false);
    setMontoEfectivo(
      pago === "COMBINADO" && pedido.montoEfectivo
        ? String(pedido.montoEfectivo)
        : ""
    );
    setMontoTransferencia(
      pago === "COMBINADO" && pedido.montoTransferencia
        ? String(pedido.montoTransferencia)
        : ""
    );
  }

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setClosing(false);
      cargarDatosFormulario(pedidoEditando);
      cargarStockParaPedido();
    }
  }, [open, pedidoEditando]);

  useEffect(() => {
    if (!shouldRender) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  async function cargarStockParaPedido() {
    try {
      setStockLoading(true);
      setStockError("");

      const data = await obtenerStockActual();
      setStockActual(data);
    } catch (error) {
      console.error(error);
      setStockError("No se pudo validar el stock actual.");
      setStockActual([]);
    } finally {
      setStockLoading(false);
    }
  }

  function resetForm() {
    setCliente("");
    setNumeroPedido("");
    setHora("");
    setTipoPago("EFECTIVO");
    setTipoVenta("PARTICULAR");
    setTotalManual("");
    setTotalModificadoManualmente(false);
    setCantidades({});
    setCantidadesOriginales({});
    setMontoEfectivo("");
    setMontoTransferencia("");
  }

  function closeWithAnimation(force = false) {
    if (saving && !force) return;

    setClosing(true);

    window.setTimeout(() => {
      resetForm();
      setShouldRender(false);
      setClosing(false);
      onClose();
    }, 260);
  }

  const totalEmpanadas = useMemo(() => {
    return Object.values(cantidades).reduce((acc, value) => acc + value, 0);
  }, [cantidades]);

  const totalCalculado = useMemo(() => {
    return calcularTotalPedido(cantidades, catalogo);
  }, [cantidades, catalogo]);

  const usaTotalManual =
    tipoVenta === "PEDIDOS_YA" || totalModificadoManualmente;
  const totalPedidoActual = usaTotalManual
    ? parseMoney(totalManual)
    : totalCalculado;
  const totalPagoCombinado =
    parseMoney(montoEfectivo) + parseMoney(montoTransferencia);
  const diferenciaPagoCombinado = totalPedidoActual - totalPagoCombinado;

  function obtenerNombreVariedad(idVariedad: number) {
    return VARIEDADES[idVariedad]?.nombre ?? `Variedad #${idVariedad}`;
  }

  function obtenerStockDisponible(idVariedad: number) {
    const item = stockActual.find((stock) => stock.id === idVariedad);
    if (!item) return null;

    const cantidadYaReservada = esEdicion
      ? cantidadesOriginales[idVariedad] ?? 0
      : 0;

    return item.stock + cantidadYaReservada;
  }

  function mostrarAvisoStockInsuficiente(
    idVariedad: number,
    cantidadSolicitada: number,
    stockDisponible: number
  ) {
    const nombre = obtenerNombreVariedad(idVariedad);

    setStockAlert({
      title: "Stock insuficiente",
      description: `No hay stock suficiente de ${nombre}. Disponible: ${stockDisponible}. Intentaste cargar: ${cantidadSolicitada}.`,
    });
  }

  function validarCantidadContraStock(idVariedad: number, nuevaCantidad: number) {
    if (nuevaCantidad <= 0) return true;

    if (stockLoading) {
      setStockAlert({
        title: "Validando stock",
        description:
          "El stock todavía se está cargando. Esperá unos segundos y volvé a intentar.",
      });

      return false;
    }

    if (stockError) {
      setStockAlert({
        title: "No se pudo validar el stock",
        description:
          "No se pudo consultar el stock actual. Cerrá el aviso y volvé a abrir el pedido para reintentar.",
      });

      return false;
    }

    const stockDisponible = obtenerStockDisponible(idVariedad);

    if (stockDisponible === null) {
      setStockAlert({
        title: "Stock no encontrado",
        description: `No se encontró stock para ${obtenerNombreVariedad(
          idVariedad
        )}. Revisá la pantalla de stock antes de cargar el pedido.`,
      });

      return false;
    }

    if (nuevaCantidad > stockDisponible) {
      mostrarAvisoStockInsuficiente(
        idVariedad,
        nuevaCantidad,
        stockDisponible
      );

      return false;
    }

    return true;
  }

  function updateCantidad(idVariedad: number, value: number) {
    const nuevaCantidad = Math.max(Number(value) || 0, 0);

    if (!validarCantidadContraStock(idVariedad, nuevaCantidad)) return;

    setCantidades((prev) => ({
      ...prev,
      [idVariedad]: nuevaCantidad,
    }));
  }

  function sumar(idVariedad: number, cantidad: number) {
    const actual = cantidades[idVariedad] ?? 0;
    const nuevaCantidad = actual + cantidad;

    updateCantidad(idVariedad, nuevaCantidad);
  }

  function restar(idVariedad: number) {
    const actual = cantidades[idVariedad] ?? 0;
    const nuevaCantidad = Math.max(actual - 1, 0);

    updateCantidad(idVariedad, nuevaCantidad);
  }

  function validarPedidoCompleto(detalles: { idVariedad: number; cantidad: number }[]) {
    for (const detalle of detalles) {
      const valido = validarCantidadContraStock(
        detalle.idVariedad,
        detalle.cantidad
      );

      if (!valido) return false;
    }

    return true;
  }

  async function confirmarPedido() {
    if (saving) return;

    const clienteTrim = cliente.trim();

    if (
      tipoVenta === "PARTICULAR" &&
      catalogoLoading &&
      catalogo.length === 0 &&
      !totalModificadoManualmente
    ) {
      alert("El catálogo de precios todavía se está cargando.");
      return;
    }

    if (
      tipoVenta === "PARTICULAR" &&
      catalogo.length === 0 &&
      !totalModificadoManualmente
    ) {
      alert(
        "No se pudo cargar el catálogo de precios. Tocá Reintentar precios o ingresá el total manualmente."
      );
      return;
    }

    const totalPedido = totalPedidoActual;

    const detalles = Object.entries(cantidades)
      .map(([idVariedad, cantidad]) => ({
        idVariedad: Number(idVariedad),
        cantidad,
      }))
      .filter((item) => item.cantidad > 0);

    if (!clienteTrim) {
      alert("Cargá el nombre del cliente.");
      return;
    }

    if (detalles.length === 0) {
      alert("Cargá al menos una variedad.");
      return;
    }

    if (totalPedido <= 0) {
      alert("Cargá el total del pedido.");
      return;
    }

    const montoEfectivoPedido =
      tipoPago === "EFECTIVO"
        ? totalPedido
        : tipoPago === "COMBINADO"
          ? parseMoney(montoEfectivo)
          : 0;
    const montoTransferenciaPedido =
      tipoPago === "TRANSFERENCIA"
        ? totalPedido
        : tipoPago === "COMBINADO"
          ? parseMoney(montoTransferencia)
          : 0;

    if (
      tipoPago === "COMBINADO" &&
      montoEfectivoPedido + montoTransferenciaPedido !== totalPedido
    ) {
      alert("Los importes de efectivo y transferencia deben sumar el total del pedido.");
      return;
    }

    if (!validarPedidoCompleto(detalles)) return;

    const payload: PedidoRequestDTO = {
      cliente: clienteTrim,
      tipoVenta,
      tipoPago,
      numeroPedidoPedidosYa:
        tipoVenta === "PEDIDOS_YA" && numeroPedido.trim()
          ? numeroPedido.trim()
          : null,
      horaEntrega: hora ? `${hora.slice(0, 5)}:00` : null,
      montoEfectivo: montoEfectivoPedido,
      montoTransferencia: montoTransferenciaPedido,
      totalPedido,
      detalles,
    };

    try {
      setSaving(true);

      if (pedidoEditando) {
        await actualizarPedidoApi(pedidoEditando.id, payload);
        resetForm();
        await onUpdated?.();
        closeWithAnimation(true);
        return;
      }

      const pedidoCreado = await crearPedidoApi(payload);

      const itemsComanda = detalles.map((detalle) => ({
        nombre:
          VARIEDADES[detalle.idVariedad]?.nombre ??
          `Variedad #${detalle.idVariedad}`,
        cantidad: detalle.cantidad,
      }));

      resetForm();
      closeWithAnimation(true);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 450);
      });
      await imprimirComandaPedido(pedidoCreado, itemsComanda);
      await onCreated?.();
    } catch (error) {
      console.error(error);
      gooeyToast.error(
        esEdicion ? "No se pudo actualizar el pedido" : "No se pudo crear el pedido",
        {
          description: "Revisá los datos e intentá nuevamente.",
          timing: TOAST_RAPIDO_TIMING,
          showTimestamp: false,
        }
      );
    } finally {
      setSaving(false);
    }
  }

  if (!shouldRender) return null;

  return createPortal(
    <aside
      className={`new-order-drawer ${
        closing ? "new-order-drawer--closing" : ""
      }`}
    >
      <div
        className="new-order-drawer__backdrop"
        onClick={() => closeWithAnimation()}
      />

      <section className="new-order-drawer__panel">
        <header className="new-order-drawer__header">
          <div>
            <h3>{esEdicion ? `Editar pedido #${pedidoEditando.id}` : "Nuevo pedido"}</h3>
            <p>
              {esEdicion
                ? "Modificá los datos y las variedades"
                : "Registro rápido de venta"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => closeWithAnimation()}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="new-order-drawer__body">
          <section className="drawer-section">
            <div className="drawer-section__title">
              <span>Datos del pedido</span>
            </div>

            <label className="drawer-floating-field drawer-floating-field--full">
              <input
                value={cliente}
                onChange={(event) => setCliente(event.target.value)}
                placeholder=" "
              />
              <span>Nombre del cliente</span>
            </label>

            <div className="drawer-grid">
              <label className="drawer-floating-field">
                <input
                  value={numeroPedido}
                  onChange={(event) => setNumeroPedido(event.target.value)}
                  placeholder=" "
                  disabled={tipoVenta === "PARTICULAR"}
                />
                <span>Número de pedido</span>
              </label>

              <label className="drawer-floating-field">
                <input
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                  type="time"
                  placeholder=" "
                />
                <span>Hora</span>
              </label>
            </div>

            <div className="drawer-field drawer-field--full">
              <span>Tipo de pago</span>

              <div className="drawer-segment drawer-segment--three">
                <button
                  type="button"
                  className={tipoPago === "EFECTIVO" ? "active" : ""}
                  onClick={() => {
                    setTipoPago("EFECTIVO");
                    setMontoEfectivo("");
                    setMontoTransferencia("");
                  }}
                >
                  Efectivo
                </button>

                <button
                  type="button"
                  className={tipoPago === "TRANSFERENCIA" ? "active" : ""}
                  onClick={() => {
                    setTipoPago("TRANSFERENCIA");
                    setMontoEfectivo("");
                    setMontoTransferencia("");
                  }}
                >
                  Transferencia
                </button>

                <button
                  type="button"
                  className={tipoPago === "COMBINADO" ? "active" : ""}
                  onClick={() => setTipoPago("COMBINADO")}
                >
                  Combinado
                </button>
              </div>
            </div>

            {tipoPago === "COMBINADO" && (
              <>
                <div className="drawer-grid drawer-combined-payment">
                  <label className="drawer-floating-field">
                    <input
                      value={montoEfectivo}
                      onChange={(event) =>
                        setMontoEfectivo(event.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder=" "
                      inputMode="numeric"
                    />
                    <span>Monto en efectivo</span>
                  </label>

                  <label className="drawer-floating-field">
                    <input
                      value={montoTransferencia}
                      onChange={(event) =>
                        setMontoTransferencia(
                          event.target.value.replace(/[^\d]/g, "")
                        )
                      }
                      placeholder=" "
                      inputMode="numeric"
                    />
                    <span>Monto por transferencia</span>
                  </label>
                </div>
                <small
                  className={`drawer-combined-payment__status ${
                    diferenciaPagoCombinado === 0
                      ? "drawer-combined-payment__status--ok"
                      : ""
                  }`}
                >
                  {diferenciaPagoCombinado === 0
                    ? "Los importes coinciden con el total."
                    : diferenciaPagoCombinado > 0
                      ? `Faltan $${diferenciaPagoCombinado.toLocaleString("es-AR")}.`
                      : `Te pasaste $${Math.abs(diferenciaPagoCombinado).toLocaleString("es-AR")}.`}
                </small>
              </>
            )}

            <div className="drawer-field drawer-field--full">
              <span>Tipo de venta</span>

              <div className="drawer-segment">
                <button
                  type="button"
                  className={tipoVenta === "PARTICULAR" ? "active" : ""}
                  onClick={() => {
                    setTipoVenta("PARTICULAR");
                    setNumeroPedido("");
                    setTotalManual("");
                    setTotalModificadoManualmente(false);
                  }}
                >
                  Particular
                </button>

                <button
                  type="button"
                  className={tipoVenta === "PEDIDOS_YA" ? "active" : ""}
                  onClick={() => {
                    setTipoVenta("PEDIDOS_YA");
                    setTotalManual("");
                    setTotalModificadoManualmente(false);
                  }}
                >
                  Pedidos Ya
                </button>
              </div>
            </div>

            <label className="drawer-floating-field drawer-floating-field--full">
              <input
                value={
                  tipoVenta === "PEDIDOS_YA" || totalModificadoManualmente
                    ? totalManual
                    : catalogoLoading && catalogo.length === 0
                      ? "Cargando precios..."
                      : catalogo.length === 0
                        ? "Precios no disponibles"
                        : totalCalculado || ""
                }
                onChange={(event) => {
                  setTotalManual(event.target.value.replace(/[^\d]/g, ""));
                  if (tipoVenta === "PARTICULAR") {
                    setTotalModificadoManualmente(true);
                  }
                }}
                onFocus={(event) => event.currentTarget.select()}
                placeholder=" "
                inputMode="numeric"
                aria-busy={
                  tipoVenta === "PARTICULAR" &&
                  catalogoLoading &&
                  catalogo.length === 0
                }
              />
              <span>
                {tipoVenta === "PEDIDOS_YA"
                  ? "Total informado por Pedidos Ya"
                  : totalModificadoManualmente
                    ? "Total manual"
                    : "Total calculado"}
              </span>
            </label>

            <div className="drawer-total-mode">
              <small>
                {tipoVenta === "PEDIDOS_YA"
                  ? "Ingresá el importe que figura en la aplicación."
                  : totalModificadoManualmente
                    ? "Este importe reemplaza el cálculo automático."
                    : catalogoUsandoRespaldo
                      ? "Usando los últimos precios guardados. Podés crear el pedido normalmente."
                      : catalogoError
                        ? "No se pudieron cargar los precios. Reintentá o ingresá el total manualmente."
                        : "Se actualiza automáticamente según las cantidades."}
              </small>

              {tipoVenta === "PARTICULAR" && totalModificadoManualmente && (
                <button
                  type="button"
                  onClick={() => {
                    setTotalManual("");
                    setTotalModificadoManualmente(false);
                  }}
                >
                  Volver al cálculo automático
                </button>
              )}

              {tipoVenta === "PARTICULAR" &&
                !totalModificadoManualmente &&
                catalogoError && (
                  <button
                    type="button"
                    onClick={() => void recargarCatalogo()}
                    disabled={catalogoLoading}
                  >
                    {catalogoLoading
                      ? "Reintentando..."
                      : "Reintentar precios"}
                  </button>
                )}
            </div>
          </section>

          <section className="drawer-section drawer-section--variedades">
            <div className="drawer-varieties">
              {variedadesList.map((variedad) => {
                const cantidad = cantidades[variedad.id] ?? 0;

                return (
                  <article className="drawer-variety" key={variedad.id}>
                    <div className="drawer-variety__name">
                      <strong>{variedad.nombre}</strong>

                      {cantidad > 0 && (
                        <span>{cantidad} seleccionadas</span>
                      )}
                    </div>

                    <div className="drawer-variety__controls">
                      <button type="button" onClick={() => restar(variedad.id)}>
                        <Minus size={14} />
                      </button>

                      <input
                        value={cantidad === 0 ? "" : cantidad}
                        onChange={(event) =>
                          updateCantidad(
                            variedad.id,
                            Number(event.target.value)
                          )
                        }
                        placeholder="0"
                        inputMode="numeric"
                      />

                      <button type="button" onClick={() => sumar(variedad.id, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="drawer-variety__quick">
                      <button type="button" onClick={() => sumar(variedad.id, 2)}>
                        +2
                      </button>

                      <button type="button" onClick={() => sumar(variedad.id, 6)}>
                        +6
                      </button>

                      <button
                        type="button"
                        onClick={() => sumar(variedad.id, 12)}
                      >
                        +12
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="new-order-drawer__footer">
          <div>
            <span>Total pedido</span>
            <strong>${totalPedidoActual.toLocaleString("es-AR")}</strong>
          </div>

          <div>
            <span>Empanadas</span>
            <strong>{totalEmpanadas}</strong>
          </div>

          <button
            type="button"
            className="drawer-cancel"
            onClick={() => closeWithAnimation()}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="drawer-confirm"
            onClick={confirmarPedido}
            disabled={
              saving ||
              stockLoading ||
              (tipoVenta === "PARTICULAR" &&
                catalogo.length === 0 &&
                !totalModificadoManualmente)
            }
          >
            {tipoVenta === "PARTICULAR" &&
            catalogoLoading &&
            catalogo.length === 0 &&
            !totalModificadoManualmente
              ? "Cargando precios..."
              : stockLoading
                ? "Validando stock..."
                : saving
                  ? "Guardando..."
                  : esEdicion
                    ? "Guardar cambios"
                    : "Confirmar"}
          </button>
        </footer>

        {stockAlert && (
  <div className="stock-alert">
    <div
      className="stock-alert__backdrop"
      onClick={() => setStockAlert(null)}
    />

    <section className="stock-alert__panel">
      <h3>{stockAlert.title}</h3>
      <p>{stockAlert.description}</p>

      <button type="button" onClick={() => setStockAlert(null)}>
        Entendido
      </button>
    </section>
  </div>
)}
      </section>
    </aside>,
    document.body
  );
}

export default NewOrderDrawer;
