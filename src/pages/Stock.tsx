import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";

import AppConfirmDialog from "../components/AppConfirmDialog";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import {
  obtenerStockActual,
  obtenerResumenStock,
  actualizarStock,
  registrarPerdidas,
  ajustarStockDisponible,
  type StockItem,
  type StockSummary,
} from "../services/stockApi";

import "../styles/stock.css";

type StockMode = "produccion" | "mermas" | "conteo";
type StockAction = { id: number; mode: StockMode };

const numberFormatter = new Intl.NumberFormat("es-AR");
const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function AnimatedNumber({ value, kind = "integer" }: { value: number; kind?: "integer" | "money" }) {
  const [displayed, setDisplayed] = useState(value);
  const [changed, setChanged] = useState(false);
  const displayedRef = useRef(value);

  useEffect(() => {
    const from = displayedRef.current;
    if (from === value) return;

    let frame = 0;
    let highlightTimer = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      frame = window.requestAnimationFrame(() => {
        displayedRef.current = value;
        setDisplayed(value);
      });
    } else {
      const duration = kind === "money" ? 700 : 550;
      let startedAt: number | null = null;

      const tick = (now: number) => {
        if (startedAt === null) {
          startedAt = now;
          setChanged(true);
          highlightTimer = window.setTimeout(() => setChanged(false), 900);
        }
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = from + (value - from) * eased;
        const rounded = kind === "money" ? Math.round(next * 100) / 100 : Math.round(next);

        displayedRef.current = rounded;
        setDisplayed(rounded);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };

      frame = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(highlightTimer);
    };
  }, [value, kind]);

  return (
    <span className={`stock-number${changed ? " stock-number--changed" : ""}`}>
      {kind === "money" ? formatMoney(displayed) : numberFormatter.format(displayed)}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const valid =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!valid) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatus(stock: number) {
  if (stock < 50) return { key: "critical", label: "Crítico" };
  if (stock <= 100) return { key: "low", label: "Alerta" };
  return { key: "stable", label: "Disponible" };
}

function getStockPriority(stock: number) {
  if (stock <= 0) return 0;
  if (stock < 50) return 1;
  if (stock <= 100) return 2;
  return 3;
}

function getActionLabel(mode: StockMode) {
  if (mode === "produccion") return "Registrar";
  if (mode === "mermas") return "Pérdidas";
  return "Conteo real";
}

function getActionHelp(mode: StockMode) {
  if (mode === "produccion") {
    return "Las unidades elaboradas se sumarán al disponible y al total elaborado.";
  }
  if (mode === "mermas") {
    return "Las unidades perdidas se descontarán del stock disponible.";
  }
  return "El valor ingresado reemplazará el stock disponible de esta variedad.";
}

function Stock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<StockAction | null>(null);
  const [closingAction, setClosingAction] = useState<StockAction | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rowOrderRef = useRef<Map<number, number>>(new Map());
  const closingTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (closingTimerRef.current !== null) window.clearTimeout(closingTimerRef.current);
  }, []);

  const cargarStock = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [stockItems, stockSummary] = await Promise.all([
        obtenerStockActual(),
        obtenerResumenStock(),
      ]);
      const previousOrder = rowOrderRef.current;
      stockItems.sort((a, b) => {
        const aRank = previousOrder.get(a.id);
        const bRank = previousOrder.get(b.id);
        if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
        if (aRank !== undefined) return -1;
        if (bRank !== undefined) return 1;
        const priorityDifference = getStockPriority(a.stock) - getStockPriority(b.stock);
        return priorityDifference || a.stock - b.stock || a.id - b.id;
      });
      rowOrderRef.current = new Map(stockItems.map((item, index) => [item.id, index]));
      setItems(stockItems);
      setSummary(stockSummary);
      return true;
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar el stock.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargarStock(), 0);
    return () => window.clearTimeout(timer);
  }, [cargarStock]);

  const totalDisponible = summary?.totalUnidadesDisponibles ?? 0;
  const criticalVarieties = useMemo(
    () => items.filter((item) => item.stock < 50).length,
    [items]
  );
  const showSummaryPlaceholders = summary === null;
  const showCriticalPlaceholder = items.length === 0 && (loading || Boolean(error));

  const activeItem = items.find((item) => item.id === activeAction?.id);
  const quantity = Number(quantityInput);

  function openAction(id: number, mode: StockMode) {
    if (closingTimerRef.current !== null) window.clearTimeout(closingTimerRef.current);
    closingTimerRef.current = null;
    setClosingAction(null);
    setActiveAction({ id, mode });
    setQuantityInput("");
    setActionError("");
    setConfirmOpen(false);
  }

  function closeAction() {
    if (!activeAction) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveAction(null);
      setClosingAction(null);
      return;
    }
    setClosingAction(activeAction);
    setActiveAction(null);
    if (closingTimerRef.current !== null) window.clearTimeout(closingTimerRef.current);
    closingTimerRef.current = window.setTimeout(() => {
      setClosingAction(null);
      closingTimerRef.current = null;
    }, 230);
  }

  function prepareAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction || !activeItem) return;

    if (
      quantityInput.trim() === "" ||
      !Number.isSafeInteger(quantity) ||
      quantity < (activeAction.mode === "conteo" ? 0 : 1)
    ) {
      setActionError(
        activeAction.mode === "conteo"
          ? "Ingresá un número entero igual o mayor que cero."
          : "Ingresá un número entero mayor que cero."
      );
      return;
    }

    if (activeAction.mode === "mermas" && quantity > activeItem.stock) {
      setActionError("La pérdida no puede superar el stock disponible.");
      return;
    }

    setActionError("");
    setConfirmOpen(true);
  }

  async function executeAction() {
    if (!activeAction || !activeItem) return;

    try {
      setSaving(true);
      if (activeAction.mode === "produccion") {
        await actualizarStock([{ idVariedad: activeAction.id, cantidad: quantity }]);
      } else if (activeAction.mode === "mermas") {
        await registrarPerdidas([{ idVariedad: activeAction.id, cantidad: quantity }]);
      } else {
        await ajustarStockDisponible([
          { idVariedad: activeAction.id, stockDisponible: quantity },
        ]);
      }

      const refreshed = await cargarStock();
      const successMessage =
        activeAction.mode === "produccion"
          ? "Producción cargada"
          : activeAction.mode === "mermas"
            ? "Pérdidas registradas"
            : "Conteo real aplicado";

      gooeyToast.success(successMessage, {
        description: refreshed
          ? `${activeItem.nombre}: ${numberFormatter.format(quantity)} unidades.`
          : "El movimiento se guardó, pero no se pudo actualizar la vista. Volvé a ingresar a Stock.",
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
      setConfirmOpen(false);
      closeAction();
      setQuantityInput("");
    } catch (saveError) {
      console.error(saveError);
      setConfirmOpen(false);
      gooeyToast.error("No se pudo actualizar el stock", {
        description: "El stock no fue modificado.",
        timing: TOAST_RAPIDO_TIMING,
        showTimestamp: false,
      });
    } finally {
      setSaving(false);
    }
  }

  const dialogDescription = activeAction && activeItem
    ? activeAction.mode === "produccion"
      ? `Vas a sumar ${quantity} unidades de ${activeItem.nombre} al stock disponible y al total elaborado.`
      : activeAction.mode === "mermas"
        ? `Vas a descontar ${quantity} unidades de ${activeItem.nombre} del stock disponible.`
        : `Vas a reemplazar el stock disponible de ${activeItem.nombre} por ${quantity} unidades.`
    : "";

  return (
    <section className="stock-page">
      <header className="stock-page__header">
        <div className="stock-page__title">
          <p className="stock-page__eyebrow">Gestión de stock</p>
          <h2>Stock</h2>
          <span>Disponibilidad y movimientos por variedad.</span>
        </div>
      </header>

      <section className="stock-strip" aria-label="Resumen de stock">
        <div className="stock-strip__body">
          <div className="stock-strip__title">
            <small>EN N&Uacute;MEROS</small>
            <h3>Inventario</h3>
          </div>
          <div className="stock-strip__metric">
            <small>STOCK TOTAL</small>
            <strong>{showSummaryPlaceholders ? "\u2014" : <AnimatedNumber value={totalDisponible} />}</strong>
          </div>
          <div className="stock-strip__metric">
            <small>VALOR TOTAL EN STOCK</small>
            <strong>{summary === null ? "\u2014" : <AnimatedNumber value={summary.valorTotalStock} kind="money" />}</strong>
          </div>
          <div className="stock-strip__metric stock-strip__metric--critical">
            <small>VARIEDADES CR&Iacute;TICAS</small>
            <strong>{showCriticalPlaceholder ? "\u2014" : <AnimatedNumber value={criticalVarieties} />}</strong>
          </div>
        </div>
        {summary !== null && summary.variedadesSinValoracion > 0 && (
          <p className="stock-strip__warning" role="status">
            {summary.variedadesSinValoracion} {summary.variedadesSinValoracion === 1 ? "variedad no pudo valorizarse" : "variedades no pudieron valorizarse"}. El valor total incluye solo las variedades valorizadas.
          </p>
        )}
      </section>

      <div className="stock-table-heading">
        <div>
          <p className="stock-table-heading__eyebrow">Inventario por variedad</p>
          <h3>Variedades</h3>
        </div>
        <span>Costos actuales según recetas y precios vigentes.</span>
      </div>

      {error && <div className="stock-page__error">{error}</div>}
      {loading && items.length === 0 ? (
        <div className="stock-page__empty">Cargando stock...</div>
      ) : error && items.length === 0 ? null : items.length === 0 ? (
        <div className="stock-page__empty">No hay variedades para mostrar.</div>
      ) : (
        <div className="stock-table-wrap">
          <table className="stock-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Variedad</th>
                <th scope="col">Disponible</th>
                <th scope="col">Costo unitario</th>
                <th scope="col">Valor en stock</th>
                <th scope="col">Estado</th>
                <th scope="col">Última elaboración</th>
                <th scope="col">Total elaborado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const status = getStatus(item.stock);
                const editorAction = activeAction?.id === item.id ? activeAction : closingAction?.id === item.id ? closingAction : null;
                const editing = editorAction !== null;
                const closing = closingAction?.id === item.id && activeAction?.id !== item.id;

                return (
                  <Fragment key={item.id}>
                    <tr className={`${index % 2 === 1 ? "stock-table__row--even" : ""}${editing ? " stock-table__row--editing" : ""}`}>
                      <td>
                        <div className="stock-table__variety">
                          <strong>{item.nombre}</strong>
                        </div>
                      </td>
                      <td className="stock-table__available">
                        <AnimatedNumber value={item.stock} />
                      </td>
                      <td className={item.costoUnitarioActual === null ? "stock-table__unvalued" : undefined}>
                        {item.costoUnitarioActual === null ? "Sin receta" : <AnimatedNumber value={item.costoUnitarioActual} kind="money" />}
                      </td>
                      <td className={item.valorStockActual === null ? "stock-table__unvalued" : "stock-table__value"}>
                        {item.valorStockActual === null ? "No disponible" : <AnimatedNumber value={item.valorStockActual} kind="money" />}
                      </td>
                      <td>
                        <span className={`stock-table__status stock-table__status--${status.key}`}>
                          {status.label}
                        </span>
                      </td>
                      <td>{formatDate(item.fechaElaboracion)}</td>
                      <td><AnimatedNumber value={item.stockTotal} /></td>
                      <td>
                        <div className="stock-table__actions">
                          {(["produccion", "mermas", "conteo"] as const).map((actionMode) => (
                            <button
                              key={actionMode}
                              type="button"
                              className={`stock-table__action stock-table__action--${actionMode}${activeAction?.id === item.id && activeAction.mode === actionMode ? " stock-table__action--active" : ""}`}
                              onClick={() => openAction(item.id, actionMode)}
                              disabled={saving}
                              aria-expanded={activeAction?.id === item.id && activeAction.mode === actionMode}
                            >
                              {getActionLabel(actionMode)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {editorAction && (
                      <tr className="stock-table__editor-row">
                        <td colSpan={8}>
                          <div className={`stock-table__editor-shell${closing ? " stock-table__editor-shell--closing" : ""}`} aria-hidden={closing} inert={closing}>
                            <div className="stock-table__editor-inner">
                              <form className="stock-table__editor" onSubmit={prepareAction}>
                                <div className="stock-table__editor-copy">
                                  <strong>{getActionLabel(editorAction.mode)} · {item.nombre}</strong>
                                  <span>{getActionHelp(editorAction.mode)}</span>
                                </div>
                                <label htmlFor="stock-action-quantity">Cantidad</label>
                                <input
                                  id="stock-action-quantity"
                                  type="number"
                                  min={editorAction.mode === "conteo" ? 0 : 1}
                                  step="1"
                                  inputMode="numeric"
                                  value={quantityInput}
                                  onChange={(event) => {
                                    setQuantityInput(event.target.value);
                                    setActionError("");
                                  }}
                                  placeholder="Unidades"
                                  autoFocus
                                />
                                <button type="submit" className="stock-table__editor-confirm">
                                  Continuar
                                </button>
                                <button
                                  type="button"
                                  className="stock-table__editor-cancel"
                                  onClick={closeAction}
                                >
                                  Cancelar
                                </button>
                                {actionError && <p role="alert">{actionError}</p>}
                              </form>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AppConfirmDialog
        open={confirmOpen}
        title={activeAction ? `Confirmar ${getActionLabel(activeAction.mode).toLowerCase()}` : ""}
        description={dialogDescription}
        confirmText={activeAction ? getActionLabel(activeAction.mode) : "Confirmar"}
        cancelText="Volver"
        loading={saving}
        variant={activeAction?.mode === "mermas" || activeAction?.mode === "conteo" ? "danger" : "primary"}
        onConfirm={() => void executeAction()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

export default Stock;
