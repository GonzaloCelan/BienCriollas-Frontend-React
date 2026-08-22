import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

import { useCatalogo } from "../context/CatalogoContext";
import type { CatalogoItem } from "../services/catalogoApi";
import AppConfirmDialog from "../components/AppConfirmDialog";
import {
  calcularSubtotalVariedad,
  calcularTotalPedido,
} from "../utils/calcularTotalPedido";

import carneImg from "../assets/variedades/thumbs/carne.jpg";
import verduraImg from "../assets/variedades/thumbs/verdura.jpg";
import chocloImg from "../assets/variedades/thumbs/choclo.jpg";
import polloImg from "../assets/variedades/thumbs/pollo.jpg";
import atunImg from "../assets/variedades/thumbs/atun.jpg";
import capresseImg from "../assets/variedades/thumbs/capresse.jpg";
import fugazzaImg from "../assets/variedades/thumbs/fugazza.jpg";
import quesoAzulImg from "../assets/variedades/thumbs/queso-azul.jpg";
import bondiolaImg from "../assets/variedades/thumbs/bondiola.jpg";
import vacioImg from "../assets/variedades/thumbs/vacio.jpg";
import campoImg from "../assets/variedades/thumbs/campo.jpg";
import jamonQuesoImg from "../assets/variedades/thumbs/jamon-queso.jpg";

import "../styles/catalogo.css";

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

type PriceDraft = {
  precioUnitario: string;
  precioMediaDocena: string;
  precioDocena: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function Catalogo() {
  const {
    catalogo,
    catalogoLoading,
    catalogoError,
    catalogoUsandoRespaldo,
    recargarCatalogo,
    actualizarPreciosCatalogo,
  } = useCatalogo();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState<PriceDraft | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cantidadesPresupuesto, setCantidadesPresupuesto] = useState<
    Record<number, number>
  >({});
  const [copyFeedback, setCopyFeedback] = useState("");

  const totalPresupuesto = useMemo(
    () => calcularTotalPedido(cantidadesPresupuesto, catalogo),
    [cantidadesPresupuesto, catalogo]
  );
  const variedadesPresupuesto = useMemo(
    () =>
      catalogo
        .map((item) => ({
          item,
          cantidad: cantidadesPresupuesto[item.id_variedad] ?? 0,
        }))
        .filter(({ cantidad }) => cantidad > 0),
    [cantidadesPresupuesto, catalogo]
  );
  const totalEmpanadasPresupuesto = useMemo(
    () =>
      variedadesPresupuesto.reduce(
        (total, variedad) => total + variedad.cantidad,
        0
      ),
    [variedadesPresupuesto]
  );

  const editingItem = catalogo.find((item) => item.id_variedad === editingId);
  const pendingPrices = priceDraft
    ? {
        precioUnitario: Number(priceDraft.precioUnitario),
        precioMediaDocena: Number(priceDraft.precioMediaDocena),
        precioDocena: Number(priceDraft.precioDocena),
      }
    : null;

  function comenzarEdicion(item: CatalogoItem) {
    setEditingId(item.id_variedad);
    setPriceDraft({
      precioUnitario: String(item.precioUnitario),
      precioMediaDocena: String(item.precioMediaDocena),
      precioDocena: String(item.precioDocena),
    });
    setEditError("");
  }

  function cancelarEdicion() {
    setConfirmOpen(false);
    setEditingId(null);
    setPriceDraft(null);
    setEditError("");
  }

  function cambiarPrecio(field: keyof PriceDraft, value: string) {
    setPriceDraft((actual) =>
      actual ? { ...actual, [field]: value } : actual
    );
  }

  function solicitarConfirmacion() {
    if (!pendingPrices) return;

    const preciosValidos = Object.values(pendingPrices).every(
      (precio) => Number.isFinite(precio) && precio > 0
    );

    if (!preciosValidos) {
      setEditError("Los tres precios deben ser números mayores a cero.");
      return;
    }

    setEditError("");
    setConfirmOpen(true);
  }

  async function guardarPreciosConfirmados() {
    if (editingId === null || !pendingPrices) return;

    try {
      setSavingId(editingId);
      setEditError("");
      await actualizarPreciosCatalogo(editingId, pendingPrices);
      setConfirmOpen(false);
      setEditingId(null);
      setPriceDraft(null);
    } catch (error) {
      console.error("No se pudieron actualizar los precios.", error);
      setEditError("No se pudieron guardar los precios. Volvé a intentarlo.");
    } finally {
      setSavingId(null);
    }
  }

  function actualizarCantidadPresupuesto(idVariedad: number, value: number) {
    const cantidad = Math.max(Math.floor(Number(value) || 0), 0);

    setCantidadesPresupuesto((actual) => ({
      ...actual,
      [idVariedad]: cantidad,
    }));
    setCopyFeedback("");
  }

  function limpiarPresupuesto() {
    setCantidadesPresupuesto({});
    setCopyFeedback("");
  }

  async function copiarPresupuesto() {
    if (variedadesPresupuesto.length === 0) return;

    const detalle = variedadesPresupuesto.map(({ item, cantidad }) => {
      const subtotal = calcularSubtotalVariedad(cantidad, item);
      return `- ${cantidad} ${item.nombre} — ${formatMoney(subtotal)}`;
    });
    const mensaje = [
      "Detalle del pedido",
      "",
      ...detalle,
      "",
      `${totalEmpanadasPresupuesto} empanadas`,
      `Total: ${formatMoney(totalPresupuesto)}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(mensaje);
      setCopyFeedback("Detalle copiado. Ya podés pegarlo en WhatsApp.");
    } catch (error) {
      console.error("No se pudo copiar el detalle.", error);
      setCopyFeedback("No se pudo copiar. Probá nuevamente.");
    }
  }

  return (
    <section className="catalog-page">
      <header className="catalog-page__header catalog-page__header--clean">
        <div className="catalog-page__title">
          <p className="catalog-page__eyebrow">Lista de precios</p>
          <h2>Catálogo</h2>
          <span>
            Precios vigentes utilizados para calcular los pedidos particulares.
          </span>
        </div>

        {catalogo.length > 0 && (
          <div className="catalog-status">
            <span />
            {catalogo.length} variedades
            {catalogoUsandoRespaldo ? " · precios guardados" : " activas"}
          </div>
        )}
      </header>

      {catalogoLoading && catalogo.length === 0 && (
        <div className="catalog-message">Cargando precios del catálogo…</div>
      )}

      {catalogoError && (
        <div
          className={`catalog-message catalog-message--with-action ${
            catalogoUsandoRespaldo
              ? "catalog-message--warning"
              : "catalog-message--error"
          }`}
        >
          <span>{catalogoError}</span>
          <button
            type="button"
            onClick={() => void recargarCatalogo()}
            disabled={catalogoLoading}
          >
            {catalogoLoading ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      )}

      {catalogo.length > 0 && (
        <>
          {editError && <div className="catalog-edit-error">{editError}</div>}

          <div className="catalog-workspace">
          <section className="catalog-calculator">
            <header className="catalog-calculator__header">
              <div className="catalog-calculator__heading">
                <div>
                  <h3>Cálculo rápido</h3>
                </div>
              </div>
            </header>

            <div className="catalog-calculator__layout">
              <div className="catalog-calculator__items">
                {catalogo.map((item) => {
                  const cantidad =
                    cantidadesPresupuesto[item.id_variedad] ?? 0;
                  const subtotal = calcularSubtotalVariedad(cantidad, item);

                  return (
                    <article
                      key={item.id_variedad}
                      className={`catalog-calculator__item ${
                        cantidad > 0 ? "catalog-calculator__item--active" : ""
                      }`}
                    >
                      <div className="catalog-calculator__item-info">
                        <strong>{item.nombre}</strong>
                        <span>
                          {cantidad > 0 ? formatMoney(subtotal) : "Sin agregar"}
                        </span>
                      </div>

                      <div className="catalog-calculator__quantity">
                        <button
                          type="button"
                          onClick={() =>
                            actualizarCantidadPresupuesto(
                              item.id_variedad,
                              cantidad - 1
                            )
                          }
                          disabled={cantidad === 0}
                          aria-label={`Quitar una empanada de ${item.nombre}`}
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={cantidad}
                          onChange={(event) =>
                            actualizarCantidadPresupuesto(
                              item.id_variedad,
                              Number(event.target.value)
                            )
                          }
                          aria-label={`Cantidad de ${item.nombre}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            actualizarCantidadPresupuesto(
                              item.id_variedad,
                              cantidad + 1
                            )
                          }
                          aria-label={`Agregar una empanada de ${item.nombre}`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="catalog-calculator__summary">
                <div className="catalog-calculator__summary-title">
                  <span>Detalle del pedido</span>
                  <strong>{totalEmpanadasPresupuesto} empanadas</strong>
                </div>

                <div className="catalog-calculator__summary-lines">
                  {variedadesPresupuesto.length === 0 ? (
                    <p>Agregá cantidades para calcular el total.</p>
                  ) : (
                    variedadesPresupuesto.map(({ item, cantidad }) => (
                      <div key={item.id_variedad}>
                        <span>
                          {cantidad} × {item.nombre}
                        </span>
                        <strong>
                          {formatMoney(
                            calcularSubtotalVariedad(cantidad, item)
                          )}
                        </strong>
                      </div>
                    ))
                  )}
                </div>

                <div className="catalog-calculator__total">
                  <span>Total</span>
                  <strong>{formatMoney(totalPresupuesto)}</strong>
                </div>

                <div className="catalog-calculator__actions">
                  <button
                    type="button"
                    className="catalog-calculator__copy"
                    onClick={copiarPresupuesto}
                    disabled={variedadesPresupuesto.length === 0}
                  >
                    <Copy size={16} />
                    Copiar para WhatsApp
                  </button>
                  <button
                    type="button"
                    className="catalog-calculator__clear"
                    onClick={limpiarPresupuesto}
                    disabled={variedadesPresupuesto.length === 0}
                    aria-label="Limpiar cálculo"
                    title="Limpiar cálculo"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {copyFeedback && (
                  <p className="catalog-calculator__feedback">
                    {copyFeedback}
                  </p>
                )}
              </aside>
            </div>
          </section>

          <div className="catalog-table-wrap">
            <table className="catalog-table">
            <thead>
              <tr>
                <th>Variedad</th>
                <th>Unidad</th>
                <th>Media docena</th>
                <th>Docena</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {catalogo.map((item) => {
                const isEditing = editingId === item.id_variedad;
                const isSaving = savingId === item.id_variedad;

                return (
                  <tr
                    key={item.id_variedad}
                    className={isEditing ? "catalog-table__row--editing" : ""}
                  >
                  <td data-label="Variedad">
                    <div className="catalog-table__variety">
                      <img
                        src={variedadImages[item.id_variedad]}
                        alt={`Empanada de ${item.nombre}`}
                        loading="lazy"
                        decoding="async"
                      />
                      <strong>{item.nombre}</strong>
                    </div>
                  </td>
                  <td data-label="Unidad">
                    {isEditing && priceDraft ? (
                      <input
                        className="catalog-table__price-input"
                        type="number"
                        min="1"
                        step="1"
                        value={priceDraft.precioUnitario}
                        onChange={(event) =>
                          cambiarPrecio("precioUnitario", event.target.value)
                        }
                        aria-label={`Precio unitario de ${item.nombre}`}
                        disabled={isSaving}
                      />
                    ) : (
                      formatMoney(item.precioUnitario)
                    )}
                  </td>
                  <td data-label="Media docena">
                    {isEditing && priceDraft ? (
                      <input
                        className="catalog-table__price-input"
                        type="number"
                        min="1"
                        step="1"
                        value={priceDraft.precioMediaDocena}
                        onChange={(event) =>
                          cambiarPrecio("precioMediaDocena", event.target.value)
                        }
                        aria-label={`Precio de media docena de ${item.nombre}`}
                        disabled={isSaving}
                      />
                    ) : (
                      formatMoney(item.precioMediaDocena)
                    )}
                  </td>
                  <td
                    className="catalog-table__featured-price"
                    data-label="Docena"
                  >
                    {isEditing && priceDraft ? (
                      <input
                        className="catalog-table__price-input"
                        type="number"
                        min="1"
                        step="1"
                        value={priceDraft.precioDocena}
                        onChange={(event) =>
                          cambiarPrecio("precioDocena", event.target.value)
                        }
                        aria-label={`Precio de docena de ${item.nombre}`}
                        disabled={isSaving}
                      />
                    ) : (
                      formatMoney(item.precioDocena)
                    )}
                  </td>
                  <td data-label="Acciones">
                    <div className="catalog-table__actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="catalog-table__action catalog-table__action--save"
                            onClick={solicitarConfirmacion}
                            disabled={isSaving}
                            aria-label={`Guardar precios de ${item.nombre}`}
                            title="Guardar precios"
                          >
                            <Check size={17} />
                          </button>
                          <button
                            type="button"
                            className="catalog-table__action catalog-table__action--cancel"
                            onClick={cancelarEdicion}
                            disabled={isSaving}
                            aria-label={`Cancelar edición de ${item.nombre}`}
                            title="Cancelar"
                          >
                            <X size={17} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="catalog-table__action catalog-table__action--edit"
                          onClick={() => comenzarEdicion(item)}
                          disabled={savingId !== null}
                          aria-label={`Editar precios de ${item.nombre}`}
                          title="Editar precios"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      <AppConfirmDialog
        open={confirmOpen}
        title={`Actualizar precios de ${editingItem?.nombre ?? "la variedad"}`}
        description={
          pendingPrices
            ? `Vas a guardar estos precios: unidad ${formatMoney(
                pendingPrices.precioUnitario
              )}, media docena ${formatMoney(
                pendingPrices.precioMediaDocena
              )} y docena ${formatMoney(pendingPrices.precioDocena)}.`
            : "Confirmá los nuevos precios antes de continuar."
        }
        confirmText="Guardar precios"
        cancelText="Seguir editando"
        loading={savingId !== null}
        variant="primary"
        onConfirm={guardarPreciosConfirmados}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

export default Catalogo;
