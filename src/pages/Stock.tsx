import { useEffect, useMemo, useState } from "react";

import StockCard from "../components/StockCard";
import AppConfirmDialog from "../components/AppConfirmDialog";

import {
  obtenerStockActual,
  actualizarStock,
  registrarPerdidas,
  ajustarStockDisponible,
  type StockItem,
} from "../services/stockApi";

import carneImg from "../assets/variedades/carne_ia.png";
import verduraImg from "../assets/variedades/verdura_ia.png";
import chocloImg from "../assets/variedades/choclo_ia.png";
import polloImg from "../assets/variedades/pollo_ia.png";
import atunImg from "../assets/variedades/atun_ia.png";
import capresseImg from "../assets/variedades/capresse.png";
import fugazzaImg from "../assets/variedades/fugazza_ia.png";
import quesoAzulImg from "../assets/variedades/azul_ia.png";
import bondiolaImg from "../assets/variedades/bondi_ia.png";
import vacioImg from "../assets/variedades/vacio.jpeg";
import campoImg from "../assets/variedades/campo_ia.png";
import jamonQuesoImg from "../assets/variedades/jq_ia.png";

import "../styles/stock.css";

type StockMode = "produccion" | "mermas" | "conteo";

type StockCardItem = StockItem & {
  cantidad: number;
};

const variedadImages: Record<number, string> = {
  1: carneImg,
  2: verduraImg,
  3: chocloImg,
  4: polloImg,
  5: atunImg,
  6: capresseImg,
  7: fugazzaImg,
  8: quesoAzulImg,
  9: bondiolaImg,
  10: vacioImg,
  11: campoImg,
  12: jamonQuesoImg,
};

const stockModes: {
  key: StockMode;
  label: string;
}[] = [
  {
    key: "produccion",
    label: "Producción",
  },
  {
    key: "mermas",
    label: "Pérdidas",
  },
  {
    key: "conteo",
    label: "Conteo real",
  },
];

function getModeInputLabel(mode: StockMode) {
  if (mode === "produccion") return "Cantidad producida";
  if (mode === "mermas") return "Cantidad perdida";
  return "Stock real contado";
}

function getConfirmText(mode: StockMode, saving: boolean) {
  if (saving) return "Guardando...";

  if (mode === "produccion") return "Confirmar producción";
  if (mode === "mermas") return "Confirmar pérdidas";
  return "Confirmar conteo";
}

function getModeHelp(mode: StockMode) {
  if (mode === "produccion") {
    return "Ingresá cuántas empanadas nuevas se elaboraron. Se suman al stock disponible.";
  }

  if (mode === "mermas") {
    return "Ingresá cuántas empanadas se perdieron. Se descuentan del stock disponible.";
  }

  return "Ingresá la cantidad real contada. Reemplaza el stock disponible actual.";
}

function getDialogTitle(mode: StockMode) {
  if (mode === "produccion") return "Confirmar producción";
  if (mode === "mermas") return "Confirmar pérdidas";
  return "Confirmar conteo real";
}

function getDialogDescription(mode: StockMode, totalIngresado: number) {
  if (mode === "produccion") {
    return `Vas a sumar ${totalIngresado} empanadas al stock disponible y al total elaborado.`;
  }

  if (mode === "mermas") {
    return `Vas a descontar ${totalIngresado} empanadas del stock disponible por pérdidas o mermas.`;
  }

  return `Vas a reemplazar el stock disponible de las variedades cargadas por el conteo real ingresado. Total cargado: ${totalIngresado}.`;
}

function getDialogConfirmText(mode: StockMode) {
  if (mode === "produccion") return "Guardar producción";
  if (mode === "mermas") return "Registrar pérdidas";
  return "Aplicar conteo";
}

function Stock() {
  const [items, setItems] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<StockMode>("produccion");
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function cargarStock() {
    try {
      setLoading(true);
      setError("");

      const data = await obtenerStockActual();

      setItems(
        data.map((item) => ({
          ...item,
          cantidad: 0,
        }))
      );
    } catch (error) {
      console.error(error);
      setError("No se pudo cargar el stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarStock();
  }, []);

  function limpiarCantidades() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        cantidad: 0,
      }))
    );
  }

  function handleChangeCantidad(id: number, value: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              cantidad: value,
            }
          : item
      )
    );
  }

  function handleChangeMode(nextMode: StockMode) {
    setMode(nextMode);
    setConfirmOpen(false);
    limpiarCantidades();
  }

  const totalDisponible = useMemo(() => {
    return items.reduce((acc, item) => acc + item.stock, 0);
  }, [items]);

  const totalIngresado = useMemo(() => {
    return items.reduce((acc, item) => acc + item.cantidad, 0);
  }, [items]);

  const sortedItems = useMemo(() => {
    const getPriority = (stock: number) => {
      if (stock <= 0) return 0;
      if (stock < 50) return 1;
      if (stock <= 100) return 2;
      return 3;
    };

    return [...items].sort((a, b) => {
      const priorityA = getPriority(a.stock);
      const priorityB = getPriority(b.stock);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.stock - b.stock;
    });
  }, [items]);

  function abrirConfirmacionOperacion() {
    const hayCantidades = items.some((item) => item.cantidad > 0);

    if (!hayCantidades) {
      alert("No cargaste cantidades en ninguna variedad.");
      return;
    }

    setConfirmOpen(true);
  }

  async function ejecutarOperacionConfirmada() {
    const payload = items
      .filter((item) => item.cantidad > 0)
      .map((item) => ({
        idVariedad: item.id,
        cantidad: item.cantidad,
      }));

    if (payload.length === 0) {
      setConfirmOpen(false);
      alert("No cargaste cantidades en ninguna variedad.");
      return;
    }

    try {
      setSaving(true);

      if (mode === "produccion") {
        await actualizarStock(payload);
      }

      if (mode === "mermas") {
        await registrarPerdidas(payload);
      }

      if (mode === "conteo") {
        const ajustes = items
          .filter((item) => item.cantidad > 0)
          .map((item) => ({
            idVariedad: item.id,
            stockDisponible: item.cantidad,
          }));

        await ajustarStockDisponible(ajustes);
      }

      await cargarStock();
      limpiarCantidades();
      setConfirmOpen(false);
    } catch (error) {
      console.error(error);

      if (mode === "produccion") {
        alert("No se pudo guardar la producción.");
      }

      if (mode === "mermas") {
        alert("No se pudieron registrar las pérdidas.");
      }

      if (mode === "conteo") {
        alert("No se pudo aplicar el conteo real.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stock-page">
     <header className="stock-page__header stock-page__header--clean">
  <div className="stock-page__title">
    <p className="stock-page__eyebrow">Gestión de stock</p>
    <h2>Stock</h2>
    <span>Disponibilidad y carga de producción por variedad.</span>
  </div>

  <div className="stock-page__stock-total-wrap">
    <div className="stock-page__stock-total">
      <span>Stock total</span>
      <strong>{totalDisponible}</strong>
    </div>
  </div>
</header>

      <section className="stock-mode-panel">
        <div className="stock-mode-tabs">
          {stockModes.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`stock-mode-tab ${
                mode === item.key ? "stock-mode-tab--active" : ""
              }`}
              onClick={() => handleChangeMode(item.key)}
              disabled={saving || loading}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={`stock-mode-help stock-mode-help--${mode}`}>
          <p>{getModeHelp(mode)}</p>

          {totalIngresado > 0 && (
            <span>
              Total cargado: <b>{totalIngresado}</b>
            </span>
          )}
        </div>

        <div className="stock-page__confirm-area">
          <button
            className="stock-page__confirm-btn"
            type="button"
            onClick={abrirConfirmacionOperacion}
            disabled={loading || saving}
          >
            {getConfirmText(mode, saving)}
          </button>
        </div>
      </section>

      {error && <div className="stock-page__error">{error}</div>}

      {loading ? (
        <div className="stock-page__empty">Cargando stock...</div>
      ) : (
        <div className="stock-grid">
          {sortedItems.map((item, index) => (
            <div
              key={item.id}
              className="stock-grid__item"
              style={{ animationDelay: `${index * 0.045}s` }}
            >
              <StockCard
                id={item.id}
                nombre={item.nombre}
                stock={item.stock}
                stockTotal={item.stockTotal}
                fechaElaboracion={item.fechaElaboracion}
                produccion={item.cantidad}
                image={variedadImages[item.id]}
                inputLabel={getModeInputLabel(mode)}
                mode={mode}
                onChangeProduccion={handleChangeCantidad}
              />
            </div>
          ))}
        </div>
      )}

      <AppConfirmDialog
        open={confirmOpen}
        title={getDialogTitle(mode)}
        description={getDialogDescription(mode, totalIngresado)}
        confirmText={getDialogConfirmText(mode)}
        cancelText="Cancelar"
        loading={saving}
        variant={mode === "mermas" || mode === "conteo" ? "danger" : "primary"}
        onConfirm={ejecutarOperacionConfirmada}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

export default Stock;