import {
  AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight,
  CircleDollarSign, Edit3, LoaderCircle, PackageCheck, Plus, RefreshCw, Search,
  SlidersHorizontal, Trash2, Wheat, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
import "../styles/ingredientes.css";

const PAGE_SIZE = 12;
const EMPTY_FORM = { name: "", currentStockGrams: "", minimumStockGrams: "", costPerKilogram: "" };
type IngredientForm = typeof EMPTY_FORM;
type StockAction = "increase" | "decrease" | "set";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value || 0);
}
function formatWeight(value: number) {
  if (Math.abs(value) >= 1000) return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value / 1000)} kg`;
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} g`;
}
function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}
function hasAtMostDecimals(value: string, maximum: number) {
  const decimals = value.trim().split(/[.,]/)[1];
  return !decimals || decimals.length <= maximum;
}
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
function toForm(item: Ingrediente): IngredientForm {
  return {
    name: item.name,
    currentStockGrams: String(item.currentStockGrams),
    minimumStockGrams: String(item.minimumStockGrams),
    costPerKilogram: String(item.costPerKilogram),
  };
}
function parseForm(form: IngredientForm): IngredienteEditable {
  return {
    name: form.name.trim(),
    currentStockGrams: Number(form.currentStockGrams),
    minimumStockGrams: Number(form.minimumStockGrams),
    costPerKilogram: Number(form.costPerKilogram),
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

  const items = pageData?.content ?? [];
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
    if (!form.currentStockGrams.trim() || !hasAtMostDecimals(form.currentStockGrams, 2)) return "El stock actual admite hasta 2 decimales.";
    if (!form.minimumStockGrams.trim() || !hasAtMostDecimals(form.minimumStockGrams, 2)) return "El stock mínimo admite hasta 2 decimales.";
    if (!form.costPerKilogram.trim() || !hasAtMostDecimals(form.costPerKilogram, 3)) return "El costo por kilo admite hasta 3 decimales.";
    if (!payload.name || payload.name.length > 100) return "Ingresá un nombre de hasta 100 caracteres.";
    if (!Number.isFinite(payload.currentStockGrams) || payload.currentStockGrams < 0) return "El stock actual debe ser cero o mayor.";
    if (!Number.isFinite(payload.minimumStockGrams) || payload.minimumStockGrams < 0) return "El stock mínimo debe ser cero o mayor.";
    if (!Number.isFinite(payload.costPerKilogram) || payload.costPerKilogram < 0.001) return "El costo por kilo debe ser mayor que cero.";
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
      setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); await loadData();
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
    if (!stockQuantity.trim() || !hasAtMostDecimals(stockQuantity, 2)) { setError("La cantidad admite hasta 2 decimales."); return; }
    const invalid = !Number.isFinite(quantity) || (stockAction === "set" ? quantity < 0 : quantity < 0.01);
    if (invalid) { setError(stockAction === "set" ? "Ingresá un stock de cero o más." : "Ingresá una cantidad mayor que cero."); return; }
    try {
      setSaving(true); setError("");
      if (stockAction === "increase") await incrementarStockIngredienteApi(stockItem.id, quantity);
      if (stockAction === "decrease") await descontarStockIngredienteApi(stockItem.id, quantity);
      if (stockAction === "set") await establecerStockIngredienteApi(stockItem.id, quantity);
      const actionLabel = stockAction === "increase" ? "Ingreso registrado" : stockAction === "decrease" ? "Consumo registrado" : "Stock ajustado";
      gooeyToast.success(actionLabel, { description: `${stockItem.name} fue actualizado.`, timing: TOAST_RAPIDO_TIMING });
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
        description: confirmItem.name, timing: TOAST_RAPIDO_TIMING,
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

    <div className="ingredients-summary" aria-label="Resumen de ingredientes">
      <article><span className="ingredients-summary__icon"><Wheat size={20} /></span><div><small>Total</small><strong>{summary?.totalIngredients ?? 0}</strong><p>ingredientes registrados</p></div></article>
      <article><span className="ingredients-summary__icon ingredients-summary__icon--ok"><PackageCheck size={20} /></span><div><small>Activos</small><strong>{summary?.activeIngredients ?? 0}</strong><p>disponibles para usar</p></div></article>
      <article className={(summary?.lowStockIngredients ?? 0) > 0 ? "is-warning" : ""}><span className="ingredients-summary__icon ingredients-summary__icon--warning"><AlertTriangle size={20} /></span><div><small>Stock bajo</small><strong>{summary?.lowStockIngredients ?? 0}</strong><p>requieren atención</p></div></article>
      <article><span className="ingredients-summary__icon ingredients-summary__icon--money"><CircleDollarSign size={20} /></span><div><small>Valor en stock</small><strong>{formatMoney(summary?.totalStockValue ?? 0)}</strong><p>capital disponible</p></div></article>
    </div>

    <div className="ingredients-card">
      <div className="ingredients-toolbar">
        <div className={`ingredients-search ${filter === "inactivos" ? "is-disabled" : ""}`}><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={filter === "inactivos" ? "Búsqueda disponible en activos" : "Buscar ingrediente..."} aria-label="Buscar ingrediente" disabled={filter === "inactivos"} />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <div className="ingredients-filter" role="group" aria-label="Filtrar ingredientes">
          {(["activos", "stock-bajo", "inactivos"] as FiltroIngredientes[]).map((value) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => { setFilter(value); setPage(0); setSearch(""); }}>{value === "stock-bajo" ? "Stock bajo" : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}
        </div>
        <label className="ingredients-sort"><SlidersHorizontal size={16} /><span className="sr-only">Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value as OrdenIngredientes); setPage(0); }} aria-label="Ordenar ingredientes"><option value="name,asc">Nombre A–Z</option><option value="name,desc">Nombre Z–A</option><option value="currentStockGrams,asc">Menor stock</option><option value="currentStockGrams,desc">Mayor stock</option><option value="costPerKilogram,asc">Menor costo</option><option value="costPerKilogram,desc">Mayor costo</option></select></label>
        <button type="button" className="ingredients-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Actualizar ingredientes" title="Actualizar"><RefreshCw size={17} className={loading ? "is-spinning" : ""} /></button>
      </div>

      {error && !formOpen && !stockItem && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar error"><X size={15} /></button></div>}

      <div className="ingredients-table-wrap">
        <table className="ingredients-table">
          <thead><tr><th>Ingrediente</th><th>Stock actual</th><th>Stock mínimo</th><th>Costo / kg</th><th>Valor stock</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className={item.lowStock ? "is-low-stock" : ""}>
            <td data-label="Ingrediente"><div className="ingredient-name"><span><Wheat size={18} /></span><div><strong>{item.name}</strong><small>Actualizado {formatUpdatedAt(item.updatedAt)}</small></div></div></td>
            <td data-label="Stock actual"><strong className="ingredient-stock">{formatWeight(item.currentStockGrams)}</strong></td>
            <td data-label="Stock mínimo">{formatWeight(item.minimumStockGrams)}</td>
            <td data-label="Costo / kg">{formatMoney(item.costPerKilogram)}</td>
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
        {!loading && items.length === 0 && <div className="ingredients-state"><span><Wheat size={28} /></span><strong>{search ? "No encontramos coincidencias" : filter === "stock-bajo" ? "Todo está en orden" : "No hay ingredientes para mostrar"}</strong><p>{search ? "Probá con otro nombre." : filter === "stock-bajo" ? "No hay ingredientes con stock bajo." : "Creá el primer ingrediente para empezar."}</p></div>}
      </div>

      {(pageData?.totalPages ?? 0) > 1 && <footer className="ingredients-pagination"><span>Mostrando {items.length} de {pageData?.totalElements ?? 0}</span><div><button type="button" disabled={pageData?.first} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>{pageNumbers.map((number) => <button type="button" key={number} className={page === number ? "is-active" : ""} onClick={() => setPage(number)}>{number + 1}</button>)}<button type="button" disabled={pageData?.last} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></footer>}
    </div>

    {formOpen && <div className="ingredient-drawer" role="dialog" aria-modal="true" aria-labelledby="ingredient-form-title"><button type="button" className="ingredient-drawer__backdrop" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario" /><form className="ingredient-drawer__panel" onSubmit={saveIngredient}>
      <header><div><p>{editing ? "Editar ingrediente" : "Nuevo ingrediente"}</p><h3 id="ingredient-form-title">{editing?.name ?? "Sumar materia prima"}</h3></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="ingredient-drawer__body">
        <label className="ingredient-field ingredient-field--wide"><span>Nombre</span><input autoFocus maxLength={100} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Ej. Harina 000" required /></label>
        <label className="ingredient-field"><span>Stock actual <small>gramos</small></span><input type="number" min="0" step="0.01" value={form.currentStockGrams} onChange={(event) => setForm((value) => ({ ...value, currentStockGrams: event.target.value }))} placeholder="0,00" required /></label>
        <label className="ingredient-field"><span>Stock mínimo <small>gramos</small></span><input type="number" min="0" step="0.01" value={form.minimumStockGrams} onChange={(event) => setForm((value) => ({ ...value, minimumStockGrams: event.target.value }))} placeholder="0,00" required /></label>
        <label className="ingredient-field ingredient-field--wide"><span>Costo por kilogramo <small>ARS</small></span><input type="number" min="0.001" step="0.001" value={form.costPerKilogram} onChange={(event) => setForm((value) => ({ ...value, costPerKilogram: event.target.value }))} placeholder="0,000" required /></label>
        {editing && <div className="ingredient-calculated"><div><span>Costo por gramo</span><strong>{formatMoney(editing.costPerGram)}</strong></div><div><span>Valor actual</span><strong>{formatMoney(editing.stockValue)}</strong></div></div>}
        {error && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      </div>
      <footer><button type="button" className="ingredient-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="ingredients-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}{editing ? "Guardar cambios" : "Crear ingrediente"}</button></footer>
    </form></div>}

    {stockItem && <div className="ingredient-drawer" role="dialog" aria-modal="true" aria-labelledby="stock-form-title"><button type="button" className="ingredient-drawer__backdrop" onClick={() => setStockItem(null)} aria-label="Cerrar formulario" /><form className="ingredient-drawer__panel ingredient-stock-panel" onSubmit={saveStock}>
      <header><div><p>Movimiento de stock</p><h3 id="stock-form-title">{stockItem.name}</h3></div><button type="button" onClick={() => setStockItem(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="ingredient-drawer__body"><div className="stock-current"><span>Stock disponible</span><strong>{formatWeight(stockItem.currentStockGrams)}</strong><small>Mínimo recomendado: {formatWeight(stockItem.minimumStockGrams)}</small></div>
        <div className="stock-action-tabs" role="group" aria-label="Tipo de movimiento"><button type="button" className={stockAction === "increase" ? "is-active" : ""} onClick={() => setStockAction("increase")}><ArrowUp size={16} />Ingreso</button><button type="button" className={stockAction === "decrease" ? "is-active" : ""} onClick={() => setStockAction("decrease")}><ArrowDown size={16} />Consumo</button><button type="button" className={stockAction === "set" ? "is-active" : ""} onClick={() => setStockAction("set")}><ArrowDownUp size={16} />Ajuste</button></div>
        <label className="ingredient-field"><span>{stockAction === "set" ? "Nuevo stock exacto" : "Cantidad"} <small>gramos</small></span><input autoFocus type="number" min={stockAction === "set" ? "0" : "0.01"} step="0.01" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="0,00" required /></label>
        <p className="stock-action-help">{stockAction === "increase" ? "Sumá una compra o ingreso de mercadería." : stockAction === "decrease" ? "Registrá el consumo sin permitir stock negativo." : "Reemplazá el stock por el valor de un conteo real."}</p>
        {error && <div className="ingredients-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      </div><footer><button type="button" className="ingredient-secondary" onClick={() => setStockItem(null)}>Cancelar</button><button type="submit" className="ingredients-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}Confirmar movimiento</button></footer>
    </form></div>}

    <AppConfirmDialog open={Boolean(confirmItem)} title={confirmItem?.active ? "Desactivar ingrediente" : "Activar ingrediente"} description={confirmItem ? `${confirmItem.active ? "Dejará de aparecer en búsquedas y operaciones" : "Volverá a estar disponible"}: ${confirmItem.name}.` : ""} confirmText={confirmItem?.active ? "Desactivar" : "Activar"} variant={confirmItem?.active ? "danger" : "primary"} loading={saving} onConfirm={() => void toggleIngredient()} onCancel={() => setConfirmItem(null)} />
  </section>;
}
