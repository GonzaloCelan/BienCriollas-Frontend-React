import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  Trash2,
  Clock3,
  User,
  ReceiptText,
  CreditCard,
  Hash,
  DollarSign,
} from "lucide-react";

import "../styles/nuevoPedido.css";

const variedades = [
  { id: 1, nombre: "Criolla", stock: 790 },
  { id: 2, nombre: "Jamón y queso", stock: 181 },
  { id: 3, nombre: "Pollo", stock: 76 },
  { id: 4, nombre: "Verdura", stock: 81 },
  { id: 5, nombre: "Choclo", stock: 135 },
  { id: 6, nombre: "Capresse", stock: 107 },
  { id: 7, nombre: "Fugazza", stock: 79 },
  { id: 8, nombre: "Queso azul", stock: 118 },
  { id: 9, nombre: "Atún", stock: 110 },
  { id: 10, nombre: "Campo picante", stock: 69 },
  { id: 11, nombre: "Vacío", stock: 14, bajoStock: true },
];

type TipoVenta = "PARTICULAR" | "PEDIDOS_YA";

function NuevoPedido() {
  const navigate = useNavigate();

  const orderSoundRef = useRef<HTMLAudioElement | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>("PARTICULAR");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [totalManual, setTotalManual] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const esPedidosYa = tipoVenta === "PEDIDOS_YA";

  const totalEmpanadas = Object.values(cantidades).reduce(
    (acc, cantidad) => acc + cantidad,
    0
  );

  const variedadesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return variedades;

    return variedades.filter((variedad) =>
      variedad.nombre.toLowerCase().includes(texto)
    );
  }, [busqueda]);

  function playOrderCreatedSound() {
    if (!orderSoundRef.current) {
      orderSoundRef.current = new Audio("/sound/order.mp3");
      orderSoundRef.current.volume = 0.65;
      orderSoundRef.current.preload = "auto";
    }

    orderSoundRef.current.currentTime = 0;

    return orderSoundRef.current.play().catch((error) => {
      console.warn("No se pudo reproducir el sonido:", error);
    });
  }

  function cambiarTipoVenta(value: TipoVenta) {
    setTipoVenta(value);

    if (value === "PARTICULAR") {
      setNumeroPedido("");
    }
  }

  function cambiarCantidad(id: number, value: string) {
    const numero = Number(value);

    if (Number.isNaN(numero) || numero < 0) return;

    setCantidades((prev) => ({
      ...prev,
      [id]: numero,
    }));
  }

  function sumar(id: number, cantidad: number) {
    setCantidades((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + cantidad,
    }));
  }

  function restar(id: number) {
    setCantidades((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] || 0) - 1, 0),
    }));
  }

  function limpiar() {
    setCantidades({});
  }

  async function crearPedido() {
    if (saving) return;

    if (totalEmpanadas <= 0) {
      alert("Cargá al menos una empanada.");
      return;
    }

    if (!totalManual || Number(totalManual) <= 0) {
      alert("Cargá el total del pedido.");
      return;
    }

    try {
      setSaving(true);

      /*
        Acá después iría el POST real al backend.
        Cuando conectes el endpoint real, dejá el sonido después del await.
        
        Ejemplo:
        await crearPedidoApi(payload);
        await playOrderCreatedSound();
      */

      await playOrderCreatedSound();

      limpiar();
      setTotalManual("");
      setNumeroPedido("");
      setTipoVenta("PARTICULAR");

      setTimeout(() => {
        navigate("/pedidos");
      }, 350);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="quick-order-page">
      <header className="quick-order-header">
        <button
          className="quick-order-back"
          type="button"
          onClick={() => navigate("/pedidos")}
        >
          <ArrowLeft size={15} />
          Volver
        </button>

        <div>
          <p className="quick-order-eyebrow">Carga rápida</p>
          <h2>Nuevo pedido</h2>
        </div>
      </header>

      <section className="quick-order-form-panel">
        <div className="quick-order-form-grid">
          <label className="quick-order-field">
            <span>Cliente</span>
            <div className="quick-order-input">
              <User size={15} />
              <input placeholder="Nombre" />
            </div>
          </label>

          <label className="quick-order-field">
            <span>Venta</span>
            <div className="quick-order-input">
              <ReceiptText size={15} />
              <select
                value={tipoVenta}
                onChange={(event) =>
                  cambiarTipoVenta(event.target.value as TipoVenta)
                }
              >
                <option value="PARTICULAR">Particular</option>
                <option value="PEDIDOS_YA">Pedidos Ya</option>
              </select>
            </div>
          </label>

          <label className="quick-order-field">
            <span>Pago</span>
            <div className="quick-order-input">
              <CreditCard size={15} />
              <select defaultValue="EFECTIVO">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
          </label>

          <label className="quick-order-field">
            <span>Hora</span>
            <div className="quick-order-input">
              <Clock3 size={15} />
              <input type="time" />
            </div>
          </label>

          <label className="quick-order-field">
            <span>N° pedido</span>
            <div
              className={`quick-order-input ${
                !esPedidosYa ? "quick-order-input--disabled" : ""
              }`}
            >
              <Hash size={15} />
              <input
                value={numeroPedido}
                onChange={(event) => setNumeroPedido(event.target.value)}
                placeholder={esPedidosYa ? "#12345" : "Solo Pedidos Ya"}
                disabled={!esPedidosYa}
              />
            </div>
          </label>

          <label className="quick-order-field">
            <span>Total</span>
            <div className="quick-order-input quick-order-input--money">
              <DollarSign size={15} />
              <input
                inputMode="numeric"
                value={totalManual}
                onChange={(event) => setTotalManual(event.target.value)}
                placeholder="0"
              />
            </div>
          </label>
        </div>
      </section>

      <section className="quick-order-tools">
        <div className="quick-order-search">
          <Search size={15} />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar sabor..."
          />
        </div>

        <button className="quick-order-clear" type="button" onClick={limpiar}>
          <Trash2 size={14} />
          Limpiar cantidades
        </button>
      </section>

      <section className="quick-varieties-section">
        <div className="quick-varieties-header">
          <div>
            <h3>Variedades</h3>
            <p>Cargá manualmente o sumá rápido por sabor.</p>
          </div>
        </div>

        <div className="quick-varieties-table-wrapper">
          <table className="quick-varieties-table">
            <thead>
              <tr>
                <th>Variedad</th>
                <th>Stock</th>
                <th>Cantidad</th>
                <th>Acciones rápidas</th>
              </tr>
            </thead>

            <tbody>
              {variedadesFiltradas.map((variedad, index) => {
                const cantidad = cantidades[variedad.id] || 0;

                return (
                  <tr
                    key={variedad.id}
                    className={cantidad > 0 ? "row-selected" : ""}
                    style={{ animationDelay: `${index * 0.035}s` }}
                  >
                    <td>
                      <div className="quick-variety-name">
                        <strong>{variedad.nombre}</strong>
                        {cantidad > 0 && <span>{cantidad} seleccionadas</span>}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`quick-stock ${
                          variedad.bajoStock ? "quick-stock--low" : ""
                        }`}
                      >
                        {variedad.stock}
                      </span>
                    </td>

                    <td>
                      <div className="quantity-cell">
                        <button
                          type="button"
                          onClick={() => restar(variedad.id)}
                        >
                          <Minus size={14} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={cantidad}
                          onChange={(event) =>
                            cambiarCantidad(variedad.id, event.target.value)
                          }
                        />

                        <button
                          className="quick-plus"
                          type="button"
                          onClick={() => sumar(variedad.id, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>

                    <td>
                      <div className="quick-actions-cell">
                        <button
                          type="button"
                          onClick={() => sumar(variedad.id, 2)}
                        >
                          +2
                        </button>

                        <button
                          type="button"
                          onClick={() => sumar(variedad.id, 6)}
                        >
                          +6
                        </button>

                        <button
                          type="button"
                          onClick={() => sumar(variedad.id, 12)}
                        >
                          +12
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="quick-order-bottom-bar">
        <div>
          <span>Empanadas</span>
          <strong>{totalEmpanadas}</strong>
        </div>

        <div>
          <span>Total cargado</span>
          <strong>${totalManual || "0"}</strong>
        </div>

        <button
          className="quick-order-save"
          type="button"
          onClick={crearPedido}
          disabled={saving}
        >
          {saving ? "Creando..." : "Crear pedido"}
        </button>
      </div>
    </section>
  );
}

export default NuevoPedido;