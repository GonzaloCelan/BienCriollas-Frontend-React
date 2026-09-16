import {
  AlertTriangle, BookOpen, Calculator, ChefHat, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock3, Edit3, Eye, History, Layers3, LoaderCircle,
  Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Wheat, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import { getVarietyImage } from "../features/procesos/recipes";
import { obtenerCatalogoApi, type CatalogoItem } from "../services/catalogoApi";
import { ApiError } from "../services/httpClient";
import { listarIngredientesApi, type Ingrediente } from "../services/ingredientesApi";
import {
  calcularProduccionRecetaApi, crearRecetaApi, crearVersionRecetaApi,
  listarRecetasApi, obtenerHistorialRecetaApi,
  type CalculoReceta, type OrdenRecetas, type PaginaRecetas, type Receta,
} from "../services/recetasApi";
import "../styles/recetas.css";

const PAGE_SIZE = 9;
type RecipeFilter = "vigentes" | "historicas";
type RecipeIngredientForm = { ingredientId: string; quantityGrams: string };
type RecipeForm = {
  varietyId: string;
  baseYieldUnits: string;
  notes: string;
  ingredients: RecipeIngredientForm[];
};

const EMPTY_FORM: RecipeForm = {
  varietyId: "",
  baseYieldUnits: "12",
  notes: "",
  ingredients: [{ ingredientId: "", quantityGrams: "" }],
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatWeight(value: number) {
  const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  return Math.abs(value) >= 1000 ? `${formatter.format(value / 1000)} kg` : `${formatter.format(value)} g`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}

function hasAtMostDecimals(value: string, maximum: number) {
  const decimals = value.trim().split(/[.,]/)[1];
  return !decimals || decimals.length <= maximum;
}

function formFromRecipe(recipe: Receta): RecipeForm {
  return {
    varietyId: String(recipe.varietyId),
    baseYieldUnits: String(recipe.baseYieldUnits),
    notes: recipe.notes ?? "",
    ingredients: recipe.ingredients.map((item) => ({
      ingredientId: String(item.ingredientId),
      quantityGrams: String(item.quantityGrams),
    })),
  };
}

export default function Recetas() {
  const [activeRecipes, setActiveRecipes] = useState<Receta[]>([]);
  const [historyPage, setHistoryPage] = useState<PaginaRecetas | null>(null);
  const [catalog, setCatalog] = useState<CatalogoItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [filter, setFilter] = useState<RecipeFilter>("vigentes");
  const [sort, setSort] = useState<OrdenRecetas>("varietyName,asc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [versionBase, setVersionBase] = useState<Receta | null>(null);
  const [form, setForm] = useState<RecipeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [calculationRecipe, setCalculationRecipe] = useState<Receta | null>(null);
  const [productionQuantity, setProductionQuantity] = useState("");
  const [calculation, setCalculation] = useState<CalculoReceta | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [historyRecipe, setHistoryRecipe] = useState<Receta | null>(null);
  const [recipeHistory, setRecipeHistory] = useState<Receta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const drawerOpen = formOpen || Boolean(calculationRecipe) || Boolean(historyRecipe);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const historicalSize = filter === "historicas" ? PAGE_SIZE : 1;
      const historicalPage = filter === "historicas" ? page : 0;
      const [activeData, historicalData, catalogData, ingredientData] = await Promise.all([
        listarRecetasApi({ active: true, page: 0, size: 100, sort }),
        listarRecetasApi({ active: false, page: historicalPage, size: historicalSize, sort }),
        obtenerCatalogoApi(),
        listarIngredientesApi({ filtro: "activos", page: 0, size: 100, sort: "name,asc" }),
      ]);
      setActiveRecipes(activeData.content);
      setHistoryPage(historicalData);
      setCatalog(catalogData);
      setIngredients(ingredientData.content);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "No se pudieron cargar las recetas."));
    } finally {
      setLoading(false);
    }
  }, [filter, page, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const filteredActiveRecipes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return activeRecipes;
    return activeRecipes.filter((recipe) => recipe.varietyName.toLocaleLowerCase("es").includes(query));
  }, [activeRecipes, search]);

  const activeTotalPages = Math.max(1, Math.ceil(filteredActiveRecipes.length / PAGE_SIZE));
  const visibleRecipes = filter === "vigentes"
    ? filteredActiveRecipes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : historyPage?.content ?? [];
  const totalElements = filter === "vigentes" ? filteredActiveRecipes.length : historyPage?.totalElements ?? 0;
  const totalPages = filter === "vigentes" ? activeTotalPages : historyPage?.totalPages ?? 0;
  const firstPage = page === 0;
  const lastPage = totalPages === 0 || page >= totalPages - 1;
  const selectedRecipe = visibleRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? visibleRecipes[0] ?? null;
  const pageNumbers = useMemo(() => {
    const start = Math.max(0, Math.min(page - 1, totalPages - 3));
    return Array.from({ length: Math.min(3, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);

  const availableVarieties = useMemo(() => {
    const assignedIds = new Set(activeRecipes.map((recipe) => recipe.varietyId));
    return catalog.filter((item) => !assignedIds.has(item.id_variedad));
  }, [activeRecipes, catalog]);

  const averageUnitCost = activeRecipes.length
    ? activeRecipes.reduce((total, recipe) => total + recipe.estimatedCostPerUnit, 0) / activeRecipes.length
    : 0;

  function openCreate() {
    setVersionBase(null);
    setForm({ ...EMPTY_FORM, varietyId: availableVarieties[0] ? String(availableVarieties[0].id_variedad) : "" });
    setDrawerError("");
    setFormOpen(true);
  }

  function openVersion(recipe: Receta) {
    setHistoryRecipe(null);
    setCalculationRecipe(null);
    setVersionBase(recipe);
    setForm(formFromRecipe(recipe));
    setDrawerError("");
    setFormOpen(true);
  }

  function updateIngredientRow(index: number, field: keyof RecipeIngredientForm, value: string) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addIngredientRow() {
    setForm((current) => ({ ...current, ingredients: [...current.ingredients, { ingredientId: "", quantityGrams: "" }] }));
  }

  function removeIngredientRow(index: number) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function validateForm() {
    const yieldUnits = Number(form.baseYieldUnits);
    if (!versionBase && (!form.varietyId || Number(form.varietyId) <= 0)) return "Seleccioná una variedad.";
    if (!Number.isInteger(yieldUnits) || yieldUnits <= 0) return "El rendimiento debe ser un número entero mayor que cero.";
    if (form.notes.trim().length > 500) return "Las observaciones admiten hasta 500 caracteres.";
    if (form.ingredients.length === 0) return "Agregá al menos un ingrediente.";
    const ids = form.ingredients.map((item) => Number(item.ingredientId));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return "Seleccioná todos los ingredientes.";
    if (new Set(ids).size !== ids.length) return "No podés repetir un ingrediente dentro de la receta.";
    const activeIngredientIds = new Set(ingredients.map((ingredient) => ingredient.id));
    if (ids.some((id) => !activeIngredientIds.has(id))) return "Reemplazá los ingredientes inactivos antes de crear la nueva versión.";
    const invalidQuantity = form.ingredients.some((item) => {
      const quantity = Number(item.quantityGrams);
      return !item.quantityGrams.trim() || !hasAtMostDecimals(item.quantityGrams, 2) || !Number.isFinite(quantity) || quantity < 0.01;
    });
    if (invalidQuantity) return "Cada cantidad debe ser de al menos 0,01 g y admitir hasta 2 decimales.";
    return "";
  }

  async function saveRecipe(event: FormEvent) {
    event.preventDefault();
    const validation = validateForm();
    if (validation) { setDrawerError(validation); return; }
    const commonPayload = {
      baseYieldUnits: Number(form.baseYieldUnits),
      notes: form.notes.trim() || null,
      ingredients: form.ingredients.map((item) => ({
        ingredientId: Number(item.ingredientId),
        quantityGrams: Number(item.quantityGrams),
      })),
    };
    try {
      setSaving(true);
      setDrawerError("");
      const savedRecipe = versionBase
        ? await crearVersionRecetaApi(versionBase.id, commonPayload)
        : await crearRecetaApi({ varietyId: Number(form.varietyId), ...commonPayload });
      gooeyToast.success(versionBase ? "Nueva versión creada" : "Receta creada", {
        description: `${savedRecipe.varietyName} · versión ${savedRecipe.version}`,
        timing: TOAST_RAPIDO_TIMING,
      });
      setFormOpen(false);
      setVersionBase(null);
      setForm(EMPTY_FORM);
      setSelectedRecipeId(savedRecipe.id);
      await loadData();
    } catch (saveError) {
      const message = getErrorMessage(saveError, "No se pudo guardar la receta.");
      setDrawerError(message);
      gooeyToast.error("No se pudo guardar", { description: message, timing: TOAST_RAPIDO_TIMING });
    } finally {
      setSaving(false);
    }
  }

  function openCalculation(recipe: Receta) {
    setCalculationRecipe(recipe);
    setProductionQuantity(String(recipe.baseYieldUnits));
    setCalculation(null);
    setDrawerError("");
  }

  async function calculateProduction(event: FormEvent) {
    event.preventDefault();
    if (!calculationRecipe) return;
    const quantity = Number(productionQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setDrawerError("Ingresá una cantidad entera mayor que cero.");
      return;
    }
    try {
      setCalculating(true);
      setDrawerError("");
      setCalculation(await calcularProduccionRecetaApi(calculationRecipe.id, quantity));
    } catch (calculateError) {
      setDrawerError(getErrorMessage(calculateError, "No se pudo calcular la producción."));
    } finally {
      setCalculating(false);
    }
  }

  async function openHistory(recipe: Receta) {
    setCalculationRecipe(null);
    setHistoryRecipe(recipe);
    setRecipeHistory([]);
    setDrawerError("");
    try {
      setHistoryLoading(true);
      setRecipeHistory(await obtenerHistorialRecetaApi(recipe.varietyId));
    } catch (historyError) {
      setDrawerError(getErrorMessage(historyError, "No se pudo cargar el historial."));
    } finally {
      setHistoryLoading(false);
    }
  }

  const missingIngredients = calculation?.ingredients.filter((item) => !item.enoughStock).length ?? 0;

  return <section className="recipes-page page-transition">
    <header className="recipes-hero">
      <div><p>Producción</p><h2>Recetas</h2><span>Versioná composiciones, controlá costos y prepará la producción.</span></div>
      <button type="button" className="recipes-primary" onClick={openCreate} disabled={loading || availableVarieties.length === 0} title={availableVarieties.length === 0 ? "Todas las variedades ya tienen receta" : "Crear receta"}><Plus size={17} />Nueva receta</button>
    </header>

    <div className="recipe-browser">
      <aside className="recipe-library" aria-label="Listado de recetas">
        <div className="recipe-library__top">
          <div className="recipes-filter" role="group" aria-label="Filtrar recetas"><button type="button" className={filter === "vigentes" ? "is-active" : ""} onClick={() => { setFilter("vigentes"); setPage(0); }}>Vigentes</button><button type="button" className={filter === "historicas" ? "is-active" : ""} onClick={() => { setFilter("historicas"); setPage(0); setSearch(""); }}>Históricas</button></div>
          <button type="button" className="recipes-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Actualizar recetas" title="Actualizar"><RefreshCw size={17} className={loading ? "is-spinning" : ""} /></button>
        </div>
        <div className={`recipes-search ${filter === "historicas" ? "is-disabled" : ""}`}><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={filter === "historicas" ? "Versiones históricas" : "Buscar por nombre..."} aria-label="Buscar receta" disabled={filter === "historicas"} />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <label className="recipes-sort"><SlidersHorizontal size={16} /><span className="sr-only">Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value as OrdenRecetas); setPage(0); }} aria-label="Ordenar recetas"><option value="varietyName,asc">Variedad A–Z</option><option value="varietyName,desc">Variedad Z–A</option><option value="version,desc">Versión más reciente</option><option value="baseYieldUnits,asc">Menor rendimiento</option><option value="baseYieldUnits,desc">Mayor rendimiento</option><option value="updatedAt,desc">Última modificación</option></select></label>
        <div className="recipe-library__summary"><span><strong>{activeRecipes.length}</strong> vigentes</span><span><strong>{availableVarieties.length}</strong> sin receta</span><span><strong>{formatMoney(averageUnitCost)}</strong> costo medio/u.</span></div>

        {error && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar error"><X size={15} /></button></div>}
        {loading && <div className="recipes-state recipe-library__state"><LoaderCircle size={25} className="is-spinning" />Cargando recetas…</div>}
        {!loading && visibleRecipes.length === 0 && <div className="recipes-state recipe-library__state"><span><BookOpen size={26} /></span><strong>{search ? "No encontramos coincidencias" : filter === "historicas" ? "Sin versiones anteriores" : "No hay recetas vigentes"}</strong><p>{search ? "Probá con otro nombre." : "Las recetas disponibles aparecerán acá."}</p></div>}
        {!loading && visibleRecipes.length > 0 && <motion.div className="recipe-library__list" layout>
          <AnimatePresence initial={false}>{visibleRecipes.map((recipe, index) => {
            const isSelected = selectedRecipe?.id === recipe.id;
            return <motion.button type="button" className={`recipe-library-item ${isSelected ? "is-selected" : ""}`} key={recipe.id} onClick={() => setSelectedRecipeId(recipe.id)} aria-pressed={isSelected} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .24, delay: index * .035 }} layout>
              <img src={getVarietyImage(recipe.varietyId)} alt="" />
              <span className="recipe-library-item__copy"><span><strong>{recipe.varietyName}</strong><em>v{recipe.version}</em></span><small>Rinde {recipe.baseYieldUnits} u.</small><b>{formatMoney(recipe.estimatedCostPerUnit)} / u.</b></span>
              <span className={`recipe-table-status ${recipe.active ? "is-active" : "is-history"}`}>{recipe.active ? "Vigente" : "Histórica"}</span>
              <ChevronRight size={17} className="recipe-library-item__arrow" />
            </motion.button>;
          })}</AnimatePresence>
        </motion.div>}
        {!loading && totalPages > 1 && <footer className="recipes-pagination recipe-library__pagination"><span>{visibleRecipes.length} de {totalElements}</span><div><button type="button" disabled={firstPage} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button>{pageNumbers.map((number) => <button type="button" key={number} className={page === number ? "is-active" : ""} onClick={() => setPage(number)}>{number + 1}</button>)}<button type="button" disabled={lastPage} onClick={() => setPage((current) => current + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></footer>}
      </aside>

      <section className="recipe-detail-pane" aria-label="Detalle de receta">
        {!loading && !selectedRecipe && <div className="recipes-state recipe-detail-empty"><span><ChefHat size={30} /></span><strong>Elegí una receta</strong><p>Seleccioná una variedad para ver su composición, costos y versiones.</p></div>}
        <AnimatePresence mode="wait" initial={false}>{selectedRecipe && <motion.div className="recipe-detail-view" key={selectedRecipe.id} initial={{ opacity: 0, y: 12, scale: .992 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .994 }} transition={{ duration: .3, ease: [0.22, 1, 0.36, 1] }}>
          <section className="recipe-detail-hero">
            <div className="recipe-detail-photo">
              <motion.img src={getVarietyImage(selectedRecipe.varietyId)} alt={`Empanadas de ${selectedRecipe.varietyName}`} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .45 }} />
            </div>
            <div className="recipe-detail-hero__content">
              <div className="recipe-detail-hero__heading"><div><span className={`recipe-table-status ${selectedRecipe.active ? "is-active" : "is-history"}`}>{selectedRecipe.active ? "Receta vigente" : "Versión histórica"}</span><h3>{selectedRecipe.varietyName}</h3><p>Versión {selectedRecipe.version} · Actualizada el {formatDate(selectedRecipe.updatedAt)}</p></div><div className="recipe-detail-actions"><button type="button" onClick={() => void openHistory(selectedRecipe)}><History size={16} />Historial</button><button type="button" onClick={() => openCalculation(selectedRecipe)}><Calculator size={16} />Calcular</button><button type="button" className="is-primary" onClick={() => openVersion(selectedRecipe)}><Edit3 size={16} />Nueva versión</button></div></div>
              <div className="recipe-detail-metrics">
                <article><span className="is-yield"><ChefHat size={19} /></span><div><small>Rendimiento</small><strong>{selectedRecipe.baseYieldUnits} u.</strong></div></article>
                <article><span className="is-cost"><CircleDollarSign size={19} /></span><div><small>Costo total</small><strong>{formatMoney(selectedRecipe.estimatedTotalCost)}</strong></div></article>
                <article><span className="is-unit"><Calculator size={19} /></span><div><small>Costo por unidad</small><strong>{formatMoney(selectedRecipe.estimatedCostPerUnit)}</strong></div></article>
                <article><span className="is-ingredients"><Wheat size={19} /></span><div><small>Ingredientes</small><strong>{selectedRecipe.ingredients.length}</strong></div></article>
              </div>
            </div>
          </section>

          <section className="recipe-detail-section recipe-detail-composition">
            <header><div><span><ChefHat size={18} /></span><div><h4>Ingredientes</h4><p>Composición para un rendimiento de {selectedRecipe.baseYieldUnits} unidades.</p></div></div><strong>{selectedRecipe.ingredients.length}</strong></header>
            <div className="recipe-detail-table-wrap"><table><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Costo por gramo</th><th>Subtotal</th></tr></thead><tbody>{selectedRecipe.ingredients.map((item, index) => <motion.tr key={item.ingredientId} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .25, delay: .08 + index * .045 }}><td><span className="recipe-ingredient-avatar"><Wheat size={16} /></span><strong>{item.ingredientName}</strong></td><td>{formatWeight(item.quantityGrams)}</td><td>{formatMoney(item.costPerGram)}</td><td><strong>{formatMoney(item.estimatedCost)}</strong></td></motion.tr>)}</tbody></table></div>
            <div className="recipe-cost-notice"><CircleDollarSign size={16} /><span>Los costos se calculan con los precios actuales de los ingredientes.</span><strong>{formatMoney(selectedRecipe.estimatedTotalCost)}</strong></div>
          </section>

          <div className="recipe-detail-bottom">
            <section className="recipe-detail-section recipe-cost-summary"><header><div><span><Calculator size={18} /></span><div><h4>Resumen de costos</h4><p>Valores estimados de la versión seleccionada.</p></div></div></header><dl><div><dt>Ingredientes</dt><dd>{formatMoney(selectedRecipe.estimatedTotalCost)}</dd></div><div><dt>Rendimiento base</dt><dd>{selectedRecipe.baseYieldUnits} unidades</dd></div><div className="is-total"><dt>Costo por unidad</dt><dd>{formatMoney(selectedRecipe.estimatedCostPerUnit)}</dd></div></dl></section>
            <section className="recipe-detail-section recipe-notes-panel"><header><div><span><BookOpen size={18} /></span><div><h4>Notas de la receta</h4><p>Indicaciones de esta versión.</p></div></div></header><div><strong>Observaciones</strong><p>{selectedRecipe.notes || "Esta versión no tiene observaciones cargadas."}</p><small><Clock3 size={14} />Creada el {formatDate(selectedRecipe.createdAt)}</small></div></section>
          </div>
        </motion.div>}</AnimatePresence>
      </section>
    </div>

    {createPortal(<>{formOpen && <div className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title"><button type="button" className="recipe-drawer__backdrop" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario" /><form className="recipe-drawer__panel recipe-form-panel" onSubmit={saveRecipe}>
      <header><div><p>{versionBase ? "Nueva versión" : "Nueva receta"}</p><h3 id="recipe-form-title">{versionBase?.varietyName ?? "Definir composición"}</h3></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="recipe-drawer__body">
        {versionBase ? <div className="recipe-version-notice"><Layers3 size={18} /><div><strong>Se creará la versión {versionBase.version + 1}</strong><span>La versión {versionBase.version} quedará guardada en el historial.</span></div></div> : <label className="recipe-field"><span>Variedad</span><select autoFocus value={form.varietyId} onChange={(event) => setForm((current) => ({ ...current, varietyId: event.target.value }))} required><option value="">Seleccionar variedad</option>{availableVarieties.map((item) => <option key={item.id_variedad} value={item.id_variedad}>{item.nombre}</option>)}</select></label>}
        <label className="recipe-field"><span>Rendimiento base <small>unidades</small></span><input type="number" min="1" step="1" value={form.baseYieldUnits} onChange={(event) => setForm((current) => ({ ...current, baseYieldUnits: event.target.value }))} required /></label>
        <label className="recipe-field recipe-field--wide"><span>Observaciones <small>{form.notes.length}/500</small></span><textarea maxLength={500} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalles de preparación, textura o rendimiento…" /></label>
        <section className="recipe-composition"><header><div><strong>Composición base</strong><span>Indicá los gramos para el rendimiento definido.</span></div><button type="button" onClick={addIngredientRow} disabled={form.ingredients.length >= ingredients.length}><Plus size={15} />Agregar</button></header>
          <div className="recipe-ingredient-rows">{form.ingredients.map((item, index) => <div className="recipe-ingredient-row" key={`${index}-${item.ingredientId}`}><span className="recipe-ingredient-index">{index + 1}</span><label><span className="sr-only">Ingrediente</span><select value={item.ingredientId} onChange={(event) => updateIngredientRow(index, "ingredientId", event.target.value)} required><option value="">Seleccionar ingrediente</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id} disabled={form.ingredients.some((row, rowIndex) => rowIndex !== index && row.ingredientId === String(ingredient.id))}>{ingredient.name}</option>)}</select></label><label className="recipe-quantity"><span className="sr-only">Cantidad en gramos</span><input type="number" min="0.01" step="0.01" value={item.quantityGrams} onChange={(event) => updateIngredientRow(index, "quantityGrams", event.target.value)} placeholder="Gramos" required /><small>g</small></label><button type="button" onClick={() => removeIngredientRow(index)} disabled={form.ingredients.length === 1} aria-label={`Quitar ingrediente ${index + 1}`}><Trash2 size={15} /></button></div>)}</div>
        </section>
        {drawerError && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}
      </div>
      <footer><button type="button" className="recipe-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="recipes-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}{versionBase ? "Crear nueva versión" : "Crear receta"}</button></footer>
    </form></div>}

    {calculationRecipe && <div className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-calculation-title"><button type="button" className="recipe-drawer__backdrop" onClick={() => setCalculationRecipe(null)} aria-label="Cerrar cálculo" /><form className="recipe-drawer__panel recipe-calculation-panel" onSubmit={calculateProduction}>
      <header><div><p>Planificar producción</p><h3 id="recipe-calculation-title">{calculationRecipe.varietyName} · v{calculationRecipe.version}</h3></div><button type="button" onClick={() => setCalculationRecipe(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="recipe-drawer__body"><div className="recipe-calculation-input"><label className="recipe-field"><span>Empanadas a producir</span><input autoFocus type="number" min="1" step="1" value={productionQuantity} onChange={(event) => { setProductionQuantity(event.target.value); setCalculation(null); }} required /></label><button type="submit" className="recipes-primary" disabled={calculating}>{calculating ? <LoaderCircle size={16} className="is-spinning" /> : <Calculator size={16} />}Calcular</button></div>
        <p className="recipe-calculation-help">Este cálculo consulta existencias y costos actuales. No descuenta stock.</p>
        {drawerError && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}
        {calculation && <><div className={`recipe-calculation-status ${missingIngredients > 0 ? "has-missing" : "is-ready"}`}><span>{missingIngredients > 0 ? <AlertTriangle size={20} /> : <ChefHat size={20} />}</span><div><strong>{missingIngredients > 0 ? `Faltan ${missingIngredients} ${missingIngredients === 1 ? "ingrediente" : "ingredientes"}` : "Stock suficiente para producir"}</strong><small>Factor de escala ×{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(calculation.scaleFactor)}</small></div></div>
          <div className="recipe-calculation-totals"><div><span>Producción</span><strong>{calculation.requestedUnits} u.</strong></div><div><span>Costo total</span><strong>{formatMoney(calculation.estimatedTotalCost)}</strong></div><div><span>Por unidad</span><strong>{formatMoney(calculation.estimatedCostPerUnit)}</strong></div></div>
          <section className="recipe-requirements"><header><strong>Requerimientos</strong><span>Stock disponible al momento del cálculo</span></header>{calculation.ingredients.map((item) => <article className={!item.enoughStock ? "is-missing" : ""} key={item.ingredientId}><span>{item.enoughStock ? <ChefHat size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{item.ingredientName}</strong><small>Necesitás {formatWeight(item.requiredQuantityGrams)} · tenés {formatWeight(item.currentStockGrams)}</small></div><div><strong>{formatMoney(item.estimatedCost)}</strong><small>{item.enoughStock ? "Disponible" : `Faltan ${formatWeight(item.missingGrams)}`}</small></div></article>)}</section>
        </>}
      </div><footer><button type="button" className="recipe-secondary" onClick={() => setCalculationRecipe(null)}>Cerrar</button></footer>
    </form></div>}

    {historyRecipe && <div className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-history-title"><button type="button" className="recipe-drawer__backdrop" onClick={() => setHistoryRecipe(null)} aria-label="Cerrar historial" /><section className="recipe-drawer__panel recipe-history-panel">
      <header><div><p>Historial de versiones</p><h3 id="recipe-history-title">{historyRecipe.varietyName}</h3></div><button type="button" onClick={() => setHistoryRecipe(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="recipe-drawer__body">{historyLoading && <div className="recipes-state"><LoaderCircle size={24} className="is-spinning" />Cargando historial…</div>}{drawerError && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}{!historyLoading && recipeHistory.map((recipe) => <article className={`recipe-history-item ${recipe.active ? "is-active" : ""}`} key={recipe.id}><span className="recipe-history-line" /><div className="recipe-history-version"><Layers3 size={17} /><strong>v{recipe.version}</strong></div><div className="recipe-history-content"><header><div><strong>{recipe.active ? "Versión vigente" : `Versión ${recipe.version}`}</strong><span>{formatDate(recipe.createdAt)}</span></div><button type="button" onClick={() => { setHistoryRecipe(null); setSelectedRecipeId(recipe.id); setFilter(recipe.active ? "vigentes" : "historicas"); setPage(0); }} aria-label={`Ver versión ${recipe.version}`}><Eye size={15} /></button></header><p>{recipe.notes || "Sin observaciones."}</p><footer><span>{recipe.baseYieldUnits} unidades</span><span>{recipe.ingredients.length} ingredientes</span><strong>{formatMoney(recipe.estimatedCostPerUnit)} / u.</strong></footer></div></article>)}</div>
      <footer><button type="button" className="recipe-secondary" onClick={() => setHistoryRecipe(null)}>Cerrar</button><button type="button" className="recipes-primary" onClick={() => openVersion(historyRecipe)}><Plus size={15} />Nueva versión</button></footer>
    </section></div>}</>, document.body)}
  </section>;
}
