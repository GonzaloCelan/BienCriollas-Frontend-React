import {
  AlertTriangle, ChevronLeft, ChevronRight, Edit3, LoaderCircle, MoreVertical,
  PackageOpen, Plus, RefreshCw, Search, SlidersHorizontal, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import AppConfirmDialog from "../components/AppConfirmDialog";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import { ApiError } from "../services/httpClient";
import {
  actualizarCostoIngredienteApi, actualizarIngredienteApi, cambiarEstadoIngredienteApi,
  crearIngredienteApi, listarIngredientesApi, obtenerResumenIngredientesApi,
  type FiltroIngredientes, type Ingrediente, type IngredienteEditable,
  type OrdenIngredientes, type PaginaIngredientes, type ResumenIngredientes,
} from "../services/ingredientesApi";
import {
  formatMeasurement,
  type MeasurementUnit,
} from "../utils/measurementUnits";
import { decimalPlaces, formatDecimalInput, parseDecimalInput } from "../utils/decimalInput";
import "../styles/ingredientes.css";

const PAGE_SIZE = 20;
type IngredientForm = {
  name: string;
  measurementUnit: MeasurementUnit;
  purchasePresentation: string;
  purchaseQuantity: string;
  purchaseDisplayUnit: PurchaseDisplayUnit;
  purchasePrice: string;
};
type PurchaseDisplayUnit = "GRAM" | "KILOGRAM" | "MILLILITER" | "LITER" | "UNIT";
const EMPTY_FORM: IngredientForm = {
  name: "", measurementUnit: "GRAM", purchasePresentation: "", purchaseQuantity: "",
  purchaseDisplayUnit: "GRAM", purchasePrice: "",
};
type FormMode = "create" | "edit" | "price" | null;

function formatMoney(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits }).format(value);
}
const referenceUnitLabels = { KG: "kg", LITER: "L", UNIT: "u." } as const;
function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}
function hasAtMostDecimals(value: string, maximum: number) {
  return decimalPlaces(value) <= maximum;
}
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("es-AR").replace(
    /(^|[\s-])(\p{L})/gu,
    (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("es-AR")}`,
  );
}
function toTitleCase(value: string) {
  return capitalizeWords(value.trim());
}
function toForm(item: Ingrediente): IngredientForm {
  return {
    name: toTitleCase(item.name),
    measurementUnit: item.measurementUnit,
    purchasePresentation: item.purchasePresentation ? toTitleCase(item.purchasePresentation) : "",
    purchaseQuantity: item.purchaseQuantity == null ? "" : formatDecimalInput(item.purchaseQuantity, 4),
    purchaseDisplayUnit: item.measurementUnit,
    purchasePrice: item.purchasePrice == null ? "" : formatDecimalInput(item.purchasePrice, 2),
  };
}
function purchaseUnitMultiplier(unit: PurchaseDisplayUnit) {
  return unit === "KILOGRAM" || unit === "LITER" ? 1000 : 1;
}
function purchaseDisplayOptions(unit: MeasurementUnit): Array<{ value: PurchaseDisplayUnit; label: string }> {
  if (unit === "GRAM") return [{ value: "GRAM", label: "g" }, { value: "KILOGRAM", label: "kg" }];
  if (unit === "MILLILITER") return [{ value: "MILLILITER", label: "ml" }, { value: "LITER", label: "L" }];
  return [{ value: "UNIT", label: "u." }];
}
function parseForm(form: IngredientForm): IngredienteEditable {
  return {
    name: toTitleCase(form.name),
    measurementUnit: form.measurementUnit,
    purchasePresentation: toTitleCase(form.purchasePresentation),
    purchaseQuantity: Number((parseDecimalInput(form.purchaseQuantity) * purchaseUnitMultiplier(form.purchaseDisplayUnit)).toFixed(4)),
    purchasePrice: Number(parseDecimalInput(form.purchasePrice).toFixed(2)),
  };
}

export default function Ingredientes() {
  const [pageData, setPageData] = useState<PaginaIngredientes | null>(null);
  const [summary, setSummary] = useState<ResumenIngredientes | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FiltroIngredientes>("todos");
  const [sort, setSort] = useState<OrdenIngredientes>("name,asc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Ingrediente | null>(null);
  const [form, setForm] = useState<IngredientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmItem, setConfirmItem] = useState<Ingrediente | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(`[data-ingredient-menu="${openMenuId}"]`)) setOpenMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenuId(null);
      document.getElementById(`ingredient-menu-toggle-${openMenuId}`)?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [ingredients, ingredientSummary] = await Promise.all([
        listarIngredientesApi({ filtro: filter, query: debouncedSearch, page, size: PAGE_SIZE, sort }),
        obtenerResumenIngredientesApi(),
      ]);
      setPageData(ingredients);
      setSummary(ingredientSummary);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "No se pudieron cargar los ingredientes."));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, page, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!formMode) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setFormMode(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [formMode, saving]);

  const items = pageData?.content ?? [];
  const pageNumbers = useMemo(() => {
    const total = pageData?.totalPages ?? 0;
    const start = Math.max(0, Math.min(page - 1, total - 3));
    return Array.from({ length: Math.min(3, total) }, (_, index) => start + index);
  }, [page, pageData?.totalPages]);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormMode("create"); setError("");
  }
  function openEdit(item: Ingrediente) {
    setEditing(item); setForm(toForm(item)); setFormMode("edit"); setError("");
  }
  function openPrice(item: Ingrediente) {
    setEditing(item); setForm(toForm(item)); setFormMode("price"); setError("");
  }
  function validateForm() {
    const payload = parseForm(form);
    if (!payload.name || payload.name.length > 100) return "Ingresá un nombre de hasta 100 caracteres.";
    if (!payload.purchasePresentation || payload.purchasePresentation.length > 100) return "Ingresá una presentación de compra de hasta 100 caracteres.";
    if (!form.purchaseQuantity.trim() || !hasAtMostDecimals(form.purchaseQuantity, 4) || !Number.isFinite(payload.purchaseQuantity) || payload.purchaseQuantity <= 0) return "El contenido de la presentación debe ser mayor que cero y admite hasta 4 decimales.";
    if (!form.purchasePrice.trim() || !hasAtMostDecimals(form.purchasePrice, 2) || !Number.isFinite(payload.purchasePrice) || payload.purchasePrice <= 0) return "El precio de la presentación debe ser mayor que cero y admite hasta 2 decimales.";
    return "";
  }

  async function saveIngredient(event: FormEvent) {
    event.preventDefault();
    const validation = validateForm();
    if (validation) { setError(validation); return; }
    try {
      setSaving(true); setError("");
      const payload = parseForm(form);
      if (formMode === "price" && editing) {
        await actualizarCostoIngredienteApi(editing.id, {
          purchasePresentation: payload.purchasePresentation,
          purchaseQuantity: payload.purchaseQuantity,
          purchasePrice: payload.purchasePrice,
        });
      } else if (editing) await actualizarIngredienteApi(editing.id, payload);
      else await crearIngredienteApi(payload);
      gooeyToast.success(formMode === "price" ? "Precio actualizado" : editing ? "Ingrediente actualizado" : "Ingrediente creado", {
        description: `${payload.name} quedó guardado correctamente.`, timing: TOAST_RAPIDO_TIMING,
      });
      setFormMode(null); await loadData();
    } catch (saveError) {
      const message = getErrorMessage(saveError, "No se pudo guardar el ingrediente.");
      setError(message);
      gooeyToast.error("No se pudo guardar", { description: message, timing: TOAST_RAPIDO_TIMING });
    } finally { setSaving(false); }
  }

  async function toggleIngredient() {
    if (!confirmItem) return;
    try {
      setSaving(true); setError("");
      await cambiarEstadoIngredienteApi(confirmItem.id, !confirmItem.active);
      gooeyToast.success(confirmItem.active ? "Ingrediente desactivado" : "Ingrediente activado", {
        description: toTitleCase(confirmItem.name), timing: TOAST_RAPIDO_TIMING,
      });
      setConfirmItem(null); await loadData();
    } catch (toggleError) {
      const message = getErrorMessage(toggleError, "No se pudo cambiar el estado.");
      setError(message); setConfirmItem(null);
      gooeyToast.error("No se pudo cambiar el estado", { description: message, timing: TOAST_RAPIDO_TIMING });
    } finally { setSaving(false); }
  }

  return <section className="ingredients-page page-transition">
    <header className="ingredients-hero">
      <div><p>Producción</p><h2>Ingredientes y precios</h2><span>Materia prima y precios utilizados para calcular el costo de las recetas.</span></div>
      <button type="button" className="ingredients-primary" onClick={openCreate}><Plus size={17} />Nuevo ingrediente</button>
    </header>

    <section className="ingredients-strip" aria-label="Resumen de ingredientes">
      <div className="ingredients-strip__body">
        <div className="ingredients-strip__title"><small>EN NÚMEROS</small><h3>Materias primas</h3></div>
        <div className="ingredients-strip__metric"><small>TOTAL INGREDIENTES</small><strong>{summary?.totalIngredients ?? "—"}</strong></div>
        <div className="ingredients-strip__metric"><small>ACTIVOS</small><strong>{summary?.activeIngredients ?? "—"}</strong></div>
        <div className="ingredients-strip__metric"><small>INACTIVOS</small><strong>{summary?.inactiveIngredients ?? "—"}</strong></div>
      </div>
    </section>

    <div className="ingredients-card">
      <div className="ingredients-toolbar">
        <div className="ingredients-search"><Search size={17} /><input value={search} onChange={(event) => { setFilter("todos"); setSearch(event.target.value); setPage(0); }} placeholder="Buscar ingrediente..." aria-label="Buscar ingrediente" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <div className="ingredients-filter" role="group" aria-label="Filtrar ingredientes">
          {(["todos", "activos", "inactivos"] as FiltroIngredientes[]).map((value) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => { setFilter(value); setPage(0); setSearch(""); }}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}
        </div>
        <label className="ingredients-sort"><SlidersHorizontal size={16} /><span className="sr-only">Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value as OrdenIngredientes); setPage(0); }} aria-label="Ordenar ingredientes"><option value="name,asc">Nombre A–Z</option><option value="name,desc">Nombre Z–A</option></select></label>
        <button type="button" className="ingredients-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Actualizar ingredientes" title="Actualizar"><RefreshCw size={17} className={loading ? "is-spinning" : ""} /></button>
      </div>

      {error && !formMode && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar error"><X size={15} /></button></div>}

      <section className="ingredient-grid" aria-label="Listado de ingredientes" aria-busy={loading}>
        {items.map((item) => <article className={`ingredient-tile ${item.active ? "" : "is-inactive"} ${openMenuId === item.id ? "is-menu-open" : ""}`} key={item.id}>
          <header className="ingredient-tile__heading">
            <div><h3>{toTitleCase(item.name)}</h3><small>Actualizado {formatUpdatedAt(item.updatedAt)}</small></div>
            {!item.active && <span>Inactivo</span>}
          </header>
          <div className="ingredient-tile__price">
            <small>PRECIO DE REFERENCIA</small>
            {item.referencePrice != null && item.referencePriceUnit
              ? <div className="ingredient-reference-price"><strong>{formatMoney(item.referencePrice)}</strong><span>/ {referenceUnitLabels[item.referencePriceUnit]}</span></div>
              : <span className="ingredient-reference-price--missing">Precio pendiente</span>}
          </div>
          <div className="ingredient-tile__purchase">
            {item.purchaseDataComplete && item.purchasePresentation && item.purchaseQuantity != null && item.purchasePrice != null
              ? <span>{toTitleCase(item.purchasePresentation)} de {formatMeasurement(item.purchaseQuantity, item.measurementUnit)} · {formatMoney(item.purchasePrice)}</span>
              : <span className="ingredient-tile__incomplete"><AlertTriangle size={12} aria-hidden="true" />Presentación de compra incompleta</span>}
          </div>
          <footer className="ingredient-tile__actions">
            <button type="button" className="ingredient-tile__price-action" onClick={() => openPrice(item)}>Actualizar precio</button>
            <button type="button" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Edit3 size={14} />Editar</button>
            <div className="ingredient-tile__menu" data-ingredient-menu={item.id}>
              <button id={`ingredient-menu-toggle-${item.id}`} type="button" className="ingredient-tile__menu-trigger" onClick={() => setOpenMenuId((current) => current === item.id ? null : item.id)} aria-label={`Más opciones para ${item.name}`} aria-expanded={openMenuId === item.id} aria-controls={`ingredient-menu-${item.id}`}><MoreVertical size={17} /></button>
              {openMenuId === item.id && <div id={`ingredient-menu-${item.id}`} className="ingredient-tile__menu-popover"><button type="button" autoFocus className={item.active ? "is-danger" : "is-restore"} onClick={() => { setOpenMenuId(null); setConfirmItem(item); }}>{item.active ? "Desactivar" : "Activar"}</button></div>}
            </div>
          </footer>
        </article>)}
        {loading && items.length === 0 && <div className="ingredients-state"><LoaderCircle size={25} className="is-spinning" />Cargando ingredientes…</div>}
        {!loading && items.length === 0 && <div className="ingredients-state"><span><PackageOpen size={28} /></span><strong>{search ? "No encontramos coincidencias" : "No hay ingredientes para mostrar"}</strong><p>{search ? "Probá con otro nombre." : filter === "inactivos" ? "No hay ingredientes inactivos." : "Creá el primer ingrediente para empezar."}</p></div>}
      </section>

      {(pageData?.totalPages ?? 0) > 1 && <footer className="ingredients-pagination"><span>Mostrando {items.length} de {pageData?.totalElements ?? 0}</span><div><button type="button" disabled={pageData?.first} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>{pageNumbers.map((number) => <button type="button" key={number} className={page === number ? "is-active" : ""} onClick={() => setPage(number)}>{number + 1}</button>)}<button type="button" disabled={pageData?.last} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></footer>}
    </div>

    {createPortal(<AnimatePresence>{formMode && <motion.div className="ingredient-modal" role="dialog" aria-modal="true" aria-labelledby="ingredient-form-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}><button type="button" className="ingredient-modal__backdrop" onClick={() => { if (!saving) setFormMode(null); }} aria-label="Cerrar formulario" /><motion.form className={`ingredient-drawer__panel ingredient-modal__panel ${formMode === "price" ? "ingredient-modal__panel--compact" : ""}`} onSubmit={saveIngredient} initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 22, scale: .97 }} transition={{ duration: .34, ease: [0.16, 1, 0.3, 1] }}>
      <header><div><p>{formMode === "price" ? "Actualizar precio" : editing ? "Editar ingrediente" : "Nuevo ingrediente"}</p><h3 id="ingredient-form-title">{editing ? toTitleCase(editing.name) : "Nuevo ingrediente"}</h3></div><button type="button" onClick={() => setFormMode(null)} disabled={saving} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="ingredient-drawer__body">
        {editing && !editing.purchaseDataComplete && <div className="ingredient-purchase-warning"><AlertTriangle size={17} /><div><strong>Faltan datos de compra</strong><span>Completá la presentación, el contenido y su precio para actualizar el costo.</span></div></div>}
        {formMode !== "price" && <><label className="ingredient-field ingredient-field--wide"><span>Nombre</span><input autoFocus maxLength={100} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: capitalizeWords(event.target.value) }))} onBlur={() => setForm((value) => ({ ...value, name: toTitleCase(value.name) }))} placeholder="Ej. Harina 000" required /></label>
        <label className="ingredient-field ingredient-field--wide"><span>Unidad de medida</span><select value={form.measurementUnit} onChange={(event) => { const measurementUnit = event.target.value as MeasurementUnit; setForm((value) => ({ ...value, measurementUnit, purchaseDisplayUnit: measurementUnit, purchaseQuantity: "" })); }} required><option value="GRAM">Gramos (g)</option><option value="MILLILITER">Mililitros (ml)</option><option value="UNIT">Unidades (u.)</option></select><small>Unidad utilizada en las recetas y en producción.</small></label></>}
        <section className="ingredient-purchase-form">
          <header><div><span>Compra habitual</span><strong>Presentación y precio de compra</strong></div></header>
          <div className="ingredient-purchase-form__grid">
            <label className="ingredient-field ingredient-field--wide"><span>Presentación de compra</span><input maxLength={100} value={form.purchasePresentation} onChange={(event) => setForm((value) => ({ ...value, purchasePresentation: capitalizeWords(event.target.value) }))} onBlur={() => setForm((value) => ({ ...value, purchasePresentation: toTitleCase(value.purchasePresentation) }))} placeholder="Ej. Botella, Bolsa, Maple" required /></label>
            <label className="ingredient-field"><span>Contenido</span><div className="ingredient-unit-input"><input type="text" inputMode="decimal" value={form.purchaseQuantity} onChange={(event) => setForm((value) => ({ ...value, purchaseQuantity: event.target.value }))} placeholder="0" required /><select value={form.purchaseDisplayUnit} onChange={(event) => setForm((value) => ({ ...value, purchaseDisplayUnit: event.target.value as PurchaseDisplayUnit }))} aria-label="Unidad del contenido">{purchaseDisplayOptions(form.measurementUnit).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></label>
            <label className="ingredient-field"><span>Precio de la presentación <small>ARS</small></span><div className="ingredient-money-input"><span>$</span><input type="text" inputMode="decimal" value={form.purchasePrice} onChange={(event) => setForm((value) => ({ ...value, purchasePrice: event.target.value }))} onFocus={(event) => event.currentTarget.select()} autoFocus={formMode === "price"} placeholder="0,00" required /></div><small>Precio total de la presentación de compra.</small></label>
          </div>
        </section>
        {error && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      </div>
      <footer><button type="button" className="ingredient-secondary" onClick={() => setFormMode(null)} disabled={saving}>Cancelar</button><button type="submit" className="ingredients-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}{formMode === "price" ? "Guardar precio" : editing ? "Guardar cambios" : "Crear ingrediente"}</button></footer>
    </motion.form></motion.div>}</AnimatePresence>, document.body)}

    <AppConfirmDialog open={Boolean(confirmItem)} title={confirmItem?.active ? "Desactivar ingrediente" : "Activar ingrediente"} description={confirmItem ? `${confirmItem.active ? "Dejará de aparecer en búsquedas y operaciones" : "Volverá a estar disponible"}: ${toTitleCase(confirmItem.name)}.` : ""} confirmText={confirmItem?.active ? "Desactivar" : "Activar"} variant={confirmItem?.active ? "danger" : "primary"} loading={saving} onConfirm={() => void toggleIngredient()} onCancel={() => setConfirmItem(null)} />
  </section>;
}
