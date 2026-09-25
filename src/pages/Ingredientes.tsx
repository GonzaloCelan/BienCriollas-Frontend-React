import {
  AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight,
  Edit3, LoaderCircle, PackageCheck, PackageOpen, Plus, RefreshCw,
  Search, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import AppConfirmDialog from "../components/AppConfirmDialog";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import { ApiError } from "../services/httpClient";
import {
  actualizarIngredienteApi, cambiarEstadoIngredienteApi, crearIngredienteApi,
  descontarStockIngredienteApi, establecerStockIngredienteApi,
  incrementarStockIngredienteApi, listarIngredientesApi, obtenerResumenIngredientesApi,
  type FiltroIngredientes, type Ingrediente, type IngredienteEditable,
  type OrdenIngredientes, type PaginaIngredientes, type ResumenIngredientes,
} from "../services/ingredientesApi";
import {
  formatMeasurement, measurementUnitName, measurementUnitSymbol,
  type MeasurementUnit,
} from "../utils/measurementUnits";
import { decimalPlaces, formatDecimalInput, parseDecimalInput } from "../utils/decimalInput";
import "../styles/ingredientes.css";

const PAGE_SIZE = 12;
type IngredientForm = {
  name: string;
  measurementUnit: MeasurementUnit;
  purchasePresentation: string;
  purchaseQuantity: string;
  purchaseDisplayUnit: PurchaseDisplayUnit;
  purchasePrice: string;
  currentStock: string;
  minimumStock: string;
};
type PurchaseDisplayUnit = "GRAM" | "KILOGRAM" | "MILLILITER" | "LITER" | "UNIT";
const EMPTY_FORM: IngredientForm = {
  name: "", measurementUnit: "GRAM", purchasePresentation: "", purchaseQuantity: "",
  purchaseDisplayUnit: "GRAM", purchasePrice: "", currentStock: "", minimumStock: "",
};
type StockAction = "increase" | "decrease" | "set";

function formatMoney(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits }).format(value || 0);
}
function AnimatedStockValue({ value }: { value: number | undefined }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    if (value === undefined) return;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / 650, 1);
      setDisplayValue(progress === 1 ? value : value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  if (value === undefined) return <>—</>;
  return <><span aria-hidden="true">{formatMoney(displayValue)}</span><span className="sr-only">{formatMoney(value)}</span></>;
}
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
    currentStock: String(item.currentStock),
    minimumStock: String(item.minimumStock),
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
    currentStock: Number(form.currentStock),
    minimumStock: Number(form.minimumStock),
  };
}

export default function Ingredientes() {
  const [pageData, setPageData] = useState<PaginaIngredientes | null>(null);
  const [summary, setSummary] = useState<ResumenIngredientes | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FiltroIngredientes>("activos");
  const [sort, setSort] = useState<OrdenIngredientes>("name,asc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingrediente | null>(null);
  const [form, setForm] = useState<IngredientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [stockItem, setStockItem] = useState<Ingrediente | null>(null);
  const [stockAction, setStockAction] = useState<StockAction>("increase");
  const [stockQuantity, setStockQuantity] = useState("");
  const [confirmItem, setConfirmItem] = useState<Ingrediente | null>(null);

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
    if (!formOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setFormOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [formOpen, saving]);

  const items = pageData?.content ?? [];
  const enteredPurchaseQuantity = parseDecimalInput(form.purchaseQuantity) * purchaseUnitMultiplier(form.purchaseDisplayUnit);
  const enteredPurchasePrice = parseDecimalInput(form.purchasePrice);
  const enteredBaseCost = enteredPurchasePrice / enteredPurchaseQuantity;
  const enteredStock = Number(form.currentStock);
  const calculatedStockValue = enteredBaseCost * enteredStock;
  const pageNumbers = useMemo(() => {
    const total = pageData?.totalPages ?? 0;
    const start = Math.max(0, Math.min(page - 1, total - 3));
    return Array.from({ length: Math.min(3, total) }, (_, index) => start + index);
  }, [page, pageData?.totalPages]);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); setError("");
  }
  function openEdit(item: Ingrediente) {
    setEditing(item); setForm(toForm(item)); setFormOpen(true); setError("");
  }
  function openStock(item: Ingrediente) {
    setStockItem(item); setStockAction("increase"); setStockQuantity(""); setError("");
  }
  function validateForm() {
    const payload = parseForm(form);
    if (!payload.name || payload.name.length > 100) return "Ingresá un nombre de hasta 100 caracteres.";
    if (!payload.purchasePresentation || payload.purchasePresentation.length > 100) return "Ingresá una presentación de compra de hasta 100 caracteres.";
    if (!form.purchaseQuantity.trim() || !hasAtMostDecimals(form.purchaseQuantity, 4) || !Number.isFinite(payload.purchaseQuantity) || payload.purchaseQuantity <= 0) return "El contenido de la presentación debe ser mayor que cero y admite hasta 4 decimales.";
    if (!form.purchasePrice.trim() || !hasAtMostDecimals(form.purchasePrice, 2) || !Number.isFinite(payload.purchasePrice) || payload.purchasePrice <= 0) return "El precio de la presentación debe ser mayor que cero y admite hasta 2 decimales.";
    if (!form.currentStock.trim() || !hasAtMostDecimals(form.currentStock, 4)) return "El stock actual admite hasta 4 decimales.";
    if (!form.minimumStock.trim() || !hasAtMostDecimals(form.minimumStock, 4)) return "El stock mínimo admite hasta 4 decimales.";
    if (!Number.isFinite(payload.currentStock) || payload.currentStock < 0) return "El stock actual debe ser cero o mayor.";
    if (!Number.isFinite(payload.minimumStock) || payload.minimumStock < 0) return "El stock mínimo debe ser cero o mayor.";
    return "";
  }

  async function saveIngredient(event: FormEvent) {
    event.preventDefault();
    const validation = validateForm();
    if (validation) { setError(validation); return; }
    try {
      setSaving(true); setError("");
      const payload = parseForm(form);
      if (editing) await actualizarIngredienteApi(editing.id, payload);
      else await crearIngredienteApi(payload);
      gooeyToast.success(editing ? "Ingrediente actualizado" : "Ingrediente creado", {
        description: `${payload.name} quedó guardado correctamente.`, timing: TOAST_RAPIDO_TIMING,
      });
      setFormOpen(false); await loadData();
    } catch (saveError) {
      const message = getErrorMessage(saveError, "No se pudo guardar el ingrediente.");
      setError(message);
      gooeyToast.error("No se pudo guardar", { description: message, timing: TOAST_RAPIDO_TIMING });
    } finally { setSaving(false); }
  }

  async function saveStock(event: FormEvent) {
    event.preventDefault();
    if (!stockItem) return;
    const quantity = Number(stockQuantity);
    if (!stockQuantity.trim() || !hasAtMostDecimals(stockQuantity, 4)) { setError("La cantidad admite hasta 4 decimales."); return; }
    const invalid = !Number.isFinite(quantity) || (stockAction === "set" ? quantity < 0 : quantity <= 0);
    if (invalid) { setError(stockAction === "set" ? "Ingresá un stock de cero o más." : "Ingresá una cantidad mayor que cero."); return; }
    try {
      setSaving(true); setError("");
      if (stockAction === "increase") await incrementarStockIngredienteApi(stockItem.id, quantity);
      if (stockAction === "decrease") await descontarStockIngredienteApi(stockItem.id, quantity);
      if (stockAction === "set") await establecerStockIngredienteApi(stockItem.id, quantity);
      const actionLabel = stockAction === "increase" ? "Ingreso registrado" : stockAction === "decrease" ? "Consumo registrado" : "Stock ajustado";
      gooeyToast.success(actionLabel, { description: `${toTitleCase(stockItem.name)} fue actualizado.`, timing: TOAST_RAPIDO_TIMING });
      setStockItem(null); setStockQuantity(""); await loadData();
    } catch (stockError) {
      const message = getErrorMessage(stockError, "No se pudo modificar el stock.");
      setError(message); gooeyToast.error("No se pudo modificar el stock", { description: message, timing: TOAST_RAPIDO_TIMING });
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
      <div><p>Producción</p><h2>Ingredientes</h2><span>Controlá existencias, costos y mínimos de tus materias primas.</span></div>
      <button type="button" className="ingredients-primary" onClick={openCreate}><Plus size={17} />Nuevo ingrediente</button>
    </header>

    <section className="ingredients-strip" aria-label="Resumen de ingredientes">
      <div className="ingredients-strip__body">
        <div className="ingredients-strip__title"><small>EN NÚMEROS</small><h3>Inventario</h3></div>
        <div className="ingredients-strip__metric"><small>TOTAL INGREDIENTES</small><strong>{summary?.totalIngredients ?? "—"}</strong></div>
        <div className="ingredients-strip__metric"><small>ACTIVOS</small><strong>{summary?.activeIngredients ?? "—"}</strong></div>
        <div className={`ingredients-strip__metric ${(summary?.lowStockIngredients ?? 0) > 0 ? "is-warning" : ""}`}><small>STOCK BAJO</small><strong>{summary?.lowStockIngredients ?? "—"}</strong></div>
        <div className="ingredients-strip__metric"><small>VALOR EN STOCK</small><strong><AnimatedStockValue value={summary?.totalStockValue} /></strong></div>
      </div>
    </section>

    <div className="ingredients-card">
      <div className="ingredients-toolbar">
        <div className={`ingredients-search ${filter === "inactivos" ? "is-disabled" : ""}`}><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={filter === "inactivos" ? "Búsqueda disponible en activos" : "Buscar ingrediente..."} aria-label="Buscar ingrediente" disabled={filter === "inactivos"} />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <div className="ingredients-filter" role="group" aria-label="Filtrar ingredientes">
          {(["activos", "stock-bajo", "inactivos"] as FiltroIngredientes[]).map((value) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => { setFilter(value); setPage(0); setSearch(""); }}>{value === "stock-bajo" ? "Stock bajo" : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}
        </div>
        <label className="ingredients-sort"><SlidersHorizontal size={16} /><span className="sr-only">Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value as OrdenIngredientes); setPage(0); }} aria-label="Ordenar ingredientes"><option value="name,asc">Nombre A–Z</option><option value="name,desc">Nombre Z–A</option><option value="currentStock,asc">Menor stock</option><option value="currentStock,desc">Mayor stock</option><option value="costPerBaseUnit,asc">Menor costo</option><option value="costPerBaseUnit,desc">Mayor costo</option></select></label>
        <button type="button" className="ingredients-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Actualizar ingredientes" title="Actualizar"><RefreshCw size={17} className={loading ? "is-spinning" : ""} /></button>
      </div>

      {error && !formOpen && !stockItem && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar error"><X size={15} /></button></div>}

      <div className="ingredients-table-wrap">
        <table className="ingredients-table">
          <thead><tr><th>Ingrediente</th><th>Stock actual</th><th>Stock mínimo</th><th>Compra habitual</th><th>Valor stock</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className={item.lowStock ? "is-low-stock" : ""}>
            <td data-label="Ingrediente"><div className="ingredient-name"><span><PackageOpen size={18} /></span><div><strong>{toTitleCase(item.name)}</strong><small>Actualizado {formatUpdatedAt(item.updatedAt)}</small></div></div></td>
            <td data-label="Stock actual"><strong className="ingredient-stock">{formatMeasurement(item.currentStock, item.measurementUnit)}</strong></td>
            <td data-label="Stock mínimo">{formatMeasurement(item.minimumStock, item.measurementUnit)}</td>
            <td data-label="Compra habitual">{item.purchaseDataComplete && item.purchasePresentation && item.purchaseQuantity != null && item.purchasePrice != null
              ? <div className="ingredient-purchase-summary"><strong>{toTitleCase(item.purchasePresentation)} · {formatMeasurement(item.purchaseQuantity, item.measurementUnit)}</strong><small>{formatMoney(item.purchasePrice)} · {formatMoney(item.costPerBaseUnit, 6)} / {measurementUnitSymbol(item.measurementUnit)}</small></div>
              : <span className="ingredient-purchase-missing"><AlertTriangle size={13} />Faltan datos de compra</span>}
            </td>
            <td data-label="Valor stock"><strong>{formatMoney(item.stockValue)}</strong></td>
            <td data-label="Estado"><span className={`ingredient-status ${!item.active ? "is-inactive" : item.lowStock ? "is-low" : "is-ok"}`}>{!item.active ? "Inactivo" : item.lowStock ? "Stock bajo" : "Disponible"}</span></td>
            <td data-label="Acciones"><div className="ingredient-actions">
              {item.active && <button type="button" onClick={() => openStock(item)} aria-label={`Modificar stock de ${item.name}`} title="Modificar stock"><ArrowDownUp size={16} /></button>}
              <button type="button" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`} title="Editar"><Edit3 size={15} /></button>
              <button type="button" className={item.active ? "is-danger" : "is-restore"} onClick={() => setConfirmItem(item)} aria-label={`${item.active ? "Desactivar" : "Activar"} ${item.name}`} title={item.active ? "Desactivar" : "Activar"}>{item.active ? <Trash2 size={15} /> : <RefreshCw size={15} />}</button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {loading && <div className="ingredients-state"><LoaderCircle size={25} className="is-spinning" />Cargando ingredientes…</div>}
        {!loading && items.length === 0 && <div className="ingredients-state"><span><PackageOpen size={28} /></span><strong>{search ? "No encontramos coincidencias" : filter === "stock-bajo" ? "Todo está en orden" : "No hay ingredientes para mostrar"}</strong><p>{search ? "Probá con otro nombre." : filter === "stock-bajo" ? "No hay ingredientes con stock bajo." : "Creá el primer ingrediente para empezar."}</p></div>}
      </div>

      {(pageData?.totalPages ?? 0) > 1 && <footer className="ingredients-pagination"><span>Mostrando {items.length} de {pageData?.totalElements ?? 0}</span><div><button type="button" disabled={pageData?.first} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>{pageNumbers.map((number) => <button type="button" key={number} className={page === number ? "is-active" : ""} onClick={() => setPage(number)}>{number + 1}</button>)}<button type="button" disabled={pageData?.last} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></footer>}
    </div>

    {createPortal(<AnimatePresence>{formOpen && <motion.div className="ingredient-modal" role="dialog" aria-modal="true" aria-labelledby="ingredient-form-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}><button type="button" className="ingredient-modal__backdrop" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario" /><motion.form className="ingredient-drawer__panel ingredient-modal__panel" onSubmit={saveIngredient} initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 22, scale: .97 }} transition={{ duration: .34, ease: [0.16, 1, 0.3, 1] }}>
      <header><div><p>{editing ? "Editar ingrediente" : "Nuevo ingrediente"}</p><h3 id="ingredient-form-title">{editing ? toTitleCase(editing.name) : "Sumar Materia Prima"}</h3></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="ingredient-drawer__body">
        {editing && !editing.purchaseDataComplete && <div className="ingredient-purchase-warning"><AlertTriangle size={17} /><div><strong>Faltan datos de compra</strong><span>Completá la presentación, el contenido y su precio para actualizar el costo.</span></div></div>}
        <label className="ingredient-field ingredient-field--wide"><span>Nombre</span><input autoFocus maxLength={100} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: capitalizeWords(event.target.value) }))} onBlur={() => setForm((value) => ({ ...value, name: toTitleCase(value.name) }))} placeholder="Ej. Harina 000" required /></label>
        <label className="ingredient-field ingredient-field--wide"><span>Unidad de consumo</span><select value={form.measurementUnit} disabled={Boolean(editing)} onChange={(event) => { const measurementUnit = event.target.value as MeasurementUnit; setForm((value) => ({ ...value, measurementUnit, purchaseDisplayUnit: measurementUnit, purchaseQuantity: "" })); }} required><option value="GRAM">Gramos (g)</option><option value="MILLILITER">Mililitros (ml)</option><option value="UNIT">Unidades (u.)</option></select><small>{editing ? "La unidad de consumo es estructural y no se modifica desde la edición." : "Las recetas y el stock utilizarán esta unidad base."}</small></label>
        <section className="ingredient-purchase-form">
          <header><div><span>Compra habitual</span><strong>Cómo comprás este ingrediente</strong></div><PackageCheck size={18} /></header>
          <div className="ingredient-purchase-form__grid">
            <label className="ingredient-field ingredient-field--wide"><span>Presentación de compra</span><input maxLength={100} value={form.purchasePresentation} onChange={(event) => setForm((value) => ({ ...value, purchasePresentation: capitalizeWords(event.target.value) }))} onBlur={() => setForm((value) => ({ ...value, purchasePresentation: toTitleCase(value.purchasePresentation) }))} placeholder="Ej. Botella, Bolsa, Maple" required /></label>
            <label className="ingredient-field"><span>Contenido</span><div className="ingredient-unit-input"><input type="text" inputMode="decimal" value={form.purchaseQuantity} onChange={(event) => setForm((value) => ({ ...value, purchaseQuantity: event.target.value }))} placeholder="0" required /><select value={form.purchaseDisplayUnit} onChange={(event) => setForm((value) => ({ ...value, purchaseDisplayUnit: event.target.value as PurchaseDisplayUnit }))} aria-label="Unidad del contenido">{purchaseDisplayOptions(form.measurementUnit).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></label>
            <label className="ingredient-field"><span>Precio de la presentación <small>ARS</small></span><div className="ingredient-money-input"><span>$</span><input type="text" inputMode="decimal" value={form.purchasePrice} onChange={(event) => setForm((value) => ({ ...value, purchasePrice: event.target.value }))} placeholder="0,00" required /></div></label>
          </div>
        </section>
        <label className="ingredient-field"><span>Stock actual <small>{measurementUnitName(form.measurementUnit)}</small></span><input type="number" min="0" step="0.0001" value={form.currentStock} onChange={(event) => setForm((value) => ({ ...value, currentStock: event.target.value }))} placeholder="0" required /></label>
        <label className="ingredient-field"><span>Stock mínimo <small>{measurementUnitName(form.measurementUnit)}</small></span><input type="number" min="0" step="0.0001" value={form.minimumStock} onChange={(event) => setForm((value) => ({ ...value, minimumStock: event.target.value }))} placeholder="0" required /></label>
        {Number.isFinite(enteredBaseCost) && enteredBaseCost > 0 && <div className="ingredient-calculated"><div><span>Costo aproximado por {measurementUnitSymbol(form.measurementUnit)}</span><strong>{formatMoney(enteredBaseCost, 6)}</strong></div><div><span>Valor estimado del stock</span><strong>{formatMoney(Number.isFinite(calculatedStockValue) ? calculatedStockValue : 0)}</strong></div><small>El costo definitivo lo calcula el sistema al guardar.</small></div>}
        {error && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      </div>
      <footer><button type="button" className="ingredient-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="ingredients-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}{editing ? "Guardar cambios" : "Crear ingrediente"}</button></footer>
    </motion.form></motion.div>}</AnimatePresence>, document.body)}

    {stockItem && <div className="ingredient-drawer" role="dialog" aria-modal="true" aria-labelledby="stock-form-title"><button type="button" className="ingredient-drawer__backdrop" onClick={() => setStockItem(null)} aria-label="Cerrar formulario" /><form className="ingredient-drawer__panel ingredient-stock-panel" onSubmit={saveStock}>
      <header><div><p>Movimiento de stock</p><h3 id="stock-form-title">{toTitleCase(stockItem.name)}</h3></div><button type="button" onClick={() => setStockItem(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="ingredient-drawer__body"><div className="stock-current"><span>Stock disponible</span><strong>{formatMeasurement(stockItem.currentStock, stockItem.measurementUnit)}</strong><small>Mínimo recomendado: {formatMeasurement(stockItem.minimumStock, stockItem.measurementUnit)}</small></div>
        <div className="stock-action-tabs" role="group" aria-label="Tipo de movimiento"><button type="button" className={stockAction === "increase" ? "is-active" : ""} onClick={() => setStockAction("increase")}><ArrowUp size={16} />Ingreso</button><button type="button" className={stockAction === "decrease" ? "is-active" : ""} onClick={() => setStockAction("decrease")}><ArrowDown size={16} />Consumo</button><button type="button" className={stockAction === "set" ? "is-active" : ""} onClick={() => setStockAction("set")}><ArrowDownUp size={16} />Ajuste</button></div>
        <label className="ingredient-field"><span>{stockAction === "set" ? "Nuevo stock exacto" : "Cantidad"} <small>{measurementUnitName(stockItem.measurementUnit)}</small></span><input autoFocus type="number" min={stockAction === "set" ? "0" : "0.0001"} step="0.0001" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="0" required /></label>
        <p className="stock-action-help">{stockAction === "increase" ? "Sumá una compra o ingreso de mercadería." : stockAction === "decrease" ? "Registrá el consumo sin permitir stock negativo." : "Reemplazá el stock por el valor de un conteo real."}</p>
        {error && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      </div><footer><button type="button" className="ingredient-secondary" onClick={() => setStockItem(null)}>Cancelar</button><button type="submit" className="ingredients-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}Confirmar movimiento</button></footer>
    </form></div>}

    <AppConfirmDialog open={Boolean(confirmItem)} title={confirmItem?.active ? "Desactivar ingrediente" : "Activar ingrediente"} description={confirmItem ? `${confirmItem.active ? "Dejará de aparecer en búsquedas y operaciones" : "Volverá a estar disponible"}: ${toTitleCase(confirmItem.name)}.` : ""} confirmText={confirmItem?.active ? "Desactivar" : "Activar"} variant={confirmItem?.active ? "danger" : "primary"} loading={saving} onConfirm={() => void toggleIngredient()} onCancel={() => setConfirmItem(null)} />
  </section>;
}
