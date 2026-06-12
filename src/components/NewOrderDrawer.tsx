import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";


import {
  crearPedidoApi,
  type PedidoRequestDTO,
  type TipoPagoBackend,
  type TipoVentaBackend,
} from "../services/pedidosApi";

import { obtenerStockActual, type StockItem } from "../services/stockApi";

import { imprimirComandaPedido } from "../utils/printComanda";

import "../styles/newOrderDrawer.css";

type NewOrderDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
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

function NewOrderDrawer({ open, onClose, onCreated }: NewOrderDrawerProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cliente, setCliente] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [hora, setHora] = useState("");
  const [tipoPago, setTipoPago] = useState<TipoPagoBackend>("EFECTIVO");
  const [tipoVenta, setTipoVenta] = useState<TipoVentaBackend>("PARTICULAR");
  const [total, setTotal] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const [stockActual, setStockActual] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");

  const [stockAlert, setStockAlert] = useState<StockAlert | null>(null);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setClosing(false);
      cargarStockParaPedido();
    }
  }, [open]);

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
    setTotal("");
    setCantidades({});
  }

  function closeWithAnimation(force = false) {
    if (saving && !force) return;

    setClosing(true);

    window.setTimeout(() => {
      setShouldRender(false);
      setClosing(false);
      onClose();
    }, 260);
  }

  const totalEmpanadas = useMemo(() => {
    return Object.values(cantidades).reduce((acc, value) => acc + value, 0);
  }, [cantidades]);

  function obtenerNombreVariedad(idVariedad: number) {
    return VARIEDADES[idVariedad]?.nombre ?? `Variedad #${idVariedad}`;
  }

  function obtenerStockDisponible(idVariedad: number) {
    const item = stockActual.find((stock) => stock.id === idVariedad);
    return item?.stock ?? null;
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
    const totalPedido = parseMoney(total);

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

    if (!validarPedidoCompleto(detalles)) return;

    const payload: PedidoRequestDTO = {
      cliente: clienteTrim,
      tipoVenta,
      tipoPago,
      numeroPedidoPedidosYa:
        tipoVenta === "PEDIDOS_YA" && numeroPedido.trim()
          ? numeroPedido.trim()
          : null,
      horaEntrega: hora || null,
      montoEfectivo: tipoPago === "EFECTIVO" ? totalPedido : 0,
      montoTransferencia: tipoPago === "TRANSFERENCIA" ? totalPedido : 0,
      totalPedido,
      detalles,
    };

    try {
      setSaving(true);

      const pedidoCreado = await crearPedidoApi(payload);

      const itemsComanda = detalles.map((detalle) => ({
        nombre:
          VARIEDADES[detalle.idVariedad]?.nombre ??
          `Variedad #${detalle.idVariedad}`,
        cantidad: detalle.cantidad,
      }));

      resetForm();
      await onCreated?.();
      closeWithAnimation(true);

      window.setTimeout(() => {
        imprimirComandaPedido(pedidoCreado, itemsComanda);
      }, 450);
    } catch (error) {
      console.error(error);
      alert("No se pudo crear el pedido.");
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
            <h3>Nuevo pedido</h3>
            <p>Registro rápido de venta</p>
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

              <div className="drawer-segment">
                <button
                  type="button"
                  className={tipoPago === "EFECTIVO" ? "active" : ""}
                  onClick={() => setTipoPago("EFECTIVO")}
                >
                  Efectivo
                </button>

                <button
                  type="button"
                  className={tipoPago === "TRANSFERENCIA" ? "active" : ""}
                  onClick={() => setTipoPago("TRANSFERENCIA")}
                >
                  Transferencia
                </button>
              </div>
            </div>

            <div className="drawer-field drawer-field--full">
              <span>Tipo de venta</span>

              <div className="drawer-segment">
                <button
                  type="button"
                  className={tipoVenta === "PARTICULAR" ? "active" : ""}
                  onClick={() => {
                    setTipoVenta("PARTICULAR");
                    setNumeroPedido("");
                  }}
                >
                  Particular
                </button>

                <button
                  type="button"
                  className={tipoVenta === "PEDIDOS_YA" ? "active" : ""}
                  onClick={() => setTipoVenta("PEDIDOS_YA")}
                >
                  Pedidos Ya
                </button>
              </div>
            </div>

            <label className="drawer-floating-field drawer-floating-field--full">
              <input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                placeholder=" "
                inputMode="numeric"
              />
              <span>Total del pedido</span>
            </label>
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
            <strong>${parseMoney(total).toLocaleString("es-AR")}</strong>
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
            disabled={saving || stockLoading}
          >
            {stockLoading
              ? "Validando stock..."
              : saving
                ? "Guardando..."
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