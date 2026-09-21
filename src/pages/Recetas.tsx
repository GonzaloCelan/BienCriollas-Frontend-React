import {
  AlertTriangle, BookOpen, Calculator, ChefHat, ChevronLeft, ChevronRight,
  CircleCheckBig, CircleDollarSign, Clock3, Edit3, Eye, History, Layers3, LoaderCircle,
  Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Wheat, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import AppConfirmDialog from "../components/AppConfirmDialog";
import { getVarietyImage } from "../features/procesos/recipes";
import { obtenerCatalogoApi, type CatalogoItem } from "../services/catalogoApi";
import { ApiError } from "../services/httpClient";
import { listarIngredientesApi, type Ingrediente } from "../services/ingredientesApi";
import {
  calcularProduccionRecetaApi, crearRecetaApi, crearVersionRecetaApi,
  listarRecetasApi, obtenerHistorialRecetaApi,
  type CalculoReceta, type CostoAdicionalReceta, type OrdenRecetas, type PaginaRecetas, type Receta,
} from "../services/recetasApi";
import { formatMeasurement, measurementUnitName, measurementUnitSymbol } from "../utils/measurementUnits";
import {
  additionalCostModeLabel, additionalCostModeOptions, additionalCostTypeLabel,
  additionalCostTypeOptions, forcedModeForCostType,
  type AdditionalCostCalculationMode, type AdditionalCostType,
} from "../utils/recipeAdditionalCosts";
import "../styles/recetas.css";

const PAGE_SIZE = 9;
type RecipeFilter = "vigentes" | "historicas";
type RecipeEditorStep = 1 | 2 | 3;
type RecipeIngredientForm = { ingredientId: string; quantity: string };
type RecipeAdditionalCostForm = {
  costType: AdditionalCostType;
  name: string;
  calculationMode: AdditionalCostCalculationMode;
  value: string;
  unitValue: string;
  sortOrder: string;
  notes: string;
};
type RecipeForm = {
  varietyId: string;
  baseYieldUnits: string;
  notes: string;
  ingredients: RecipeIngredientForm[];
  additionalCosts: RecipeAdditionalCostForm[];
};

const EMPTY_FORM: RecipeForm = {
  varietyId: "",
  baseYieldUnits: "12",
  notes: "",
  ingredients: [{ ingredientId: "", quantity: "" }],
  additionalCosts: [],
};

const COST_DEFAULT_NAMES: Record<AdditionalCostType, string> = {
  LABOR: "Mano de obra",
  PACKAGING: "Packaging",
  ENERGY: "Energía",
  OTHER: "Otro costo",
};

function formatMoney(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits,
  }).format(value || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function displayIngredientName(value: string) {
  const normalized = value.trim();
  if (!normalized) return value;
  return normalized.charAt(0).toLocaleUpperCase("es-AR") + normalized.slice(1);
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
      quantity: String(item.quantity),
    })),
    additionalCosts: recipe.additionalCosts.map((item) => ({
      costType: item.costType,
      name: item.name,
      calculationMode: item.calculationMode,
      value: String(item.value),
      unitValue: item.calculationMode === "FIXED_TOTAL"
        ? String(Number((item.value / recipe.baseYieldUnits).toFixed(6)))
        : item.calculationMode === "PER_UNIT" ? String(item.value) : "",
      sortOrder: String(item.sortOrder),
      notes: item.notes ?? "",
    })),
  };
}

function calculatedValueFromUnit(unitValue: string, yieldValue: string, mode: AdditionalCostCalculationMode) {
  const unit = Number(unitValue);
  const yieldUnits = Number(yieldValue);
  if (!Number.isFinite(unit) || !Number.isFinite(yieldUnits) || unit <= 0 || yieldUnits <= 0) return "";
  const result = mode === "FIXED_TOTAL" ? unit * yieldUnits : unit;
  return String(Number(result.toFixed(6)));
}

function formatAdditionalCostValue(cost: Pick<CostoAdicionalReceta, "calculationMode" | "value">) {
  if (cost.calculationMode === "PERCENTAGE") return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 }).format(cost.value)}%`;
  if (cost.calculationMode === "PER_UNIT") return `${formatMoney(cost.value, 6)} / u.`;
  return formatMoney(cost.value, 6);
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
  const [editorStep, setEditorStep] = useState<RecipeEditorStep>(1);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [recipeSuccess, setRecipeSuccess] = useState<{ title: string; detail: string } | null>(null);
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
  const drawerOpen = Boolean(calculationRecipe) || Boolean(historyRecipe);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen]);

  useEffect(() => {
    if (!recipeSuccess) return;
    const timer = window.setTimeout(() => setRecipeSuccess(null), 1600);
    return () => window.clearTimeout(timer);
  }, [recipeSuccess]);

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
    setEditorStep(1);
    setConfirmSaveOpen(false);
    setFormOpen(true);
    requestAnimationFrame(() => { const content = document.getElementById("app-main"); if (content) content.scrollTop = 0; });
  }

  function openVersion(recipe: Receta) {
    setHistoryRecipe(null);
    setCalculationRecipe(null);
    setVersionBase(recipe);
    setForm(formFromRecipe(recipe));
    setDrawerError("");
    setEditorStep(1);
    setConfirmSaveOpen(false);
    setFormOpen(true);
    requestAnimationFrame(() => { const content = document.getElementById("app-main"); if (content) content.scrollTop = 0; });
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setConfirmSaveOpen(false);
    setDrawerError("");
    setEditorStep(1);
    requestAnimationFrame(() => { const content = document.getElementById("app-main"); if (content) content.scrollTop = 0; });
  }

  function moveToEditorStep(step: RecipeEditorStep) {
    setEditorStep(step);
    setDrawerError("");
    requestAnimationFrame(() => {
      const content = document.getElementById("app-main");
      content?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function validateEditorStep(step: RecipeEditorStep) {
    if (step === 1) {
      const yieldUnits = Number(form.baseYieldUnits);
      if (!versionBase && !form.varietyId) return "Seleccioná una variedad.";
      if (!Number.isInteger(yieldUnits) || yieldUnits <= 0) return "El rendimiento base debe ser un entero mayor que cero.";
    }
    if (step === 2) {
      if (form.ingredients.length === 0) return "Agregá al menos un ingrediente.";
      if (form.ingredients.some((item) => !item.ingredientId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
        return "Completá el ingrediente y una cantidad mayor que cero en cada fila.";
      }
      if (new Set(form.ingredients.map((item) => item.ingredientId)).size !== form.ingredients.length) return "No repitas ingredientes en la composición.";
    }
    return "";
  }

  function continueEditor() {
    const validation = validateEditorStep(editorStep);
    if (validation) { setDrawerError(validation); return; }
    if (editorStep < 3) moveToEditorStep((editorStep + 1) as RecipeEditorStep);
  }

  function submitEditor(event: FormEvent) {
    event.preventDefault();
    if (editorStep < 3) {
      continueEditor();
      return;
    }
    const validation = validateForm();
    if (validation) { setDrawerError(validation); return; }
    setDrawerError("");
    setConfirmSaveOpen(true);
  }

  function updateIngredientRow(index: number, field: keyof RecipeIngredientForm, value: string) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addIngredientRow() {
    setForm((current) => ({ ...current, ingredients: [...current.ingredients, { ingredientId: "", quantity: "" }] }));
  }

  function removeIngredientRow(index: number) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function addAdditionalCost() {
    setForm((current) => ({
      ...current,
      additionalCosts: [...current.additionalCosts, {
        costType: "OTHER",
        name: "Otro costo",
        calculationMode: "FIXED_TOTAL",
        value: "",
        unitValue: "",
        sortOrder: String(current.additionalCosts.length + 1),
        notes: "",
      }],
    }));
  }

  function updateAdditionalCost(index: number, field: keyof RecipeAdditionalCostForm, value: string) {
    setForm((current) => ({
      ...current,
      additionalCosts: current.additionalCosts.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "costType") {
          const costType = value as AdditionalCostType;
          const forcedMode = forcedModeForCostType(costType);
          const calculationMode = forcedMode ?? item.calculationMode;
          return {
            ...item,
            costType,
            name: !item.name.trim() || item.name === COST_DEFAULT_NAMES[item.costType] ? COST_DEFAULT_NAMES[costType] : item.name,
            calculationMode,
            value: calculationMode === "PERCENTAGE" ? "" : calculatedValueFromUnit(item.unitValue, current.baseYieldUnits, calculationMode),
          };
        }
        if (field === "calculationMode") {
          const calculationMode = value as AdditionalCostCalculationMode;
          return {
            ...item,
            calculationMode,
            value: calculationMode === "PERCENTAGE" ? "" : calculatedValueFromUnit(item.unitValue || item.value, current.baseYieldUnits, calculationMode),
            unitValue: calculationMode === "PERCENTAGE" ? "" : item.unitValue || item.value,
          };
        }
        if (field === "unitValue") return {
          ...item,
          unitValue: value,
          value: calculatedValueFromUnit(value, current.baseYieldUnits, item.calculationMode),
        };
        return { ...item, [field]: value };
      }),
    }));
  }

  function updateBaseYieldUnits(value: string) {
    setForm((current) => ({
      ...current,
      baseYieldUnits: value,
      additionalCosts: current.additionalCosts.map((item) => item.calculationMode === "PERCENTAGE" ? item : {
        ...item,
        value: calculatedValueFromUnit(item.unitValue, value, item.calculationMode),
      }),
    }));
  }

  function removeAdditionalCost(index: number) {
    setForm((current) => ({
      ...current,
      additionalCosts: current.additionalCosts
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sortOrder: String(itemIndex + 1) })),
    }));
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
      const quantity = Number(item.quantity);
      return !item.quantity.trim() || !hasAtMostDecimals(item.quantity, 4) || !Number.isFinite(quantity) || quantity <= 0;
    });
    if (invalidQuantity) return "Cada cantidad debe ser mayor que cero y admitir hasta 4 decimales.";
    const exclusiveTypes = form.additionalCosts.filter((item) => item.costType !== "OTHER").map((item) => item.costType);
    if (new Set(exclusiveTypes).size !== exclusiveTypes.length) return "Mano de obra, packaging y energía solo pueden cargarse una vez por receta.";
    for (const cost of form.additionalCosts) {
      const value = Number(cost.value);
      const order = Number(cost.sortOrder);
      const expectedMode = forcedModeForCostType(cost.costType);
      if (!cost.name.trim()) return "Completá el nombre de todos los costos adicionales.";
      if (cost.name.trim().length > 100) return "El nombre de cada costo adicional admite hasta 100 caracteres.";
      if (cost.notes.trim().length > 500) return "Las notas de cada costo adicional admiten hasta 500 caracteres.";
      if (expectedMode && cost.calculationMode !== expectedMode) return `El modo de cálculo de ${additionalCostTypeLabel(cost.costType).toLowerCase()} no es válido.`;
      if (cost.calculationMode !== "PERCENTAGE") {
        const unitValue = Number(cost.unitValue);
        if (!cost.unitValue.trim() || !hasAtMostDecimals(cost.unitValue, 6) || !Number.isFinite(unitValue) || unitValue <= 0) return "El costo por unidad debe ser mayor que cero y admitir hasta 6 decimales.";
      }
      if (!cost.value.trim() || !hasAtMostDecimals(cost.value, 6) || !Number.isFinite(value) || value <= 0) return "Cada costo adicional debe ser mayor que cero y admitir hasta 6 decimales.";
      const integerDigits = cost.value.trim().replace(",", ".").split(".")[0].replace(/^[-+]/, "").length;
      if (integerDigits > 13) return "Los costos adicionales admiten hasta 13 dígitos enteros.";
      if (cost.calculationMode === "PERCENTAGE" && value > 100) return "Los costos porcentuales no pueden superar el 100%.";
      if (!Number.isInteger(order) || order <= 0) return "El orden de los costos adicionales debe ser un entero mayor que cero.";
    }
    return "";
  }

  async function saveRecipe() {
    const validation = validateForm();
    if (validation) { setDrawerError(validation); return; }
    const commonPayload = {
      baseYieldUnits: Number(form.baseYieldUnits),
      notes: form.notes.trim() || null,
      ingredients: form.ingredients.map((item) => ({
        ingredientId: Number(item.ingredientId),
        quantity: Number(item.quantity),
      })),
      additionalCosts: form.additionalCosts.map((item) => ({
        costType: item.costType,
        name: item.name.trim(),
        calculationMode: item.calculationMode,
        value: Number(item.value),
        sortOrder: Number(item.sortOrder),
        notes: item.notes.trim() || null,
      })),
    };
    try {
      setSaving(true);
      setDrawerError("");
      const savedRecipe = versionBase
        ? await crearVersionRecetaApi(versionBase.id, commonPayload)
        : await crearRecetaApi({ varietyId: Number(form.varietyId), ...commonPayload });
      setRecipeSuccess({
        title: versionBase ? "Nueva versión creada" : "Receta creada",
        detail: `${savedRecipe.varietyName} · versión ${savedRecipe.version}`,
      });
      setConfirmSaveOpen(false);
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
  const formVarietyName = versionBase?.varietyName
    ?? catalog.find((item) => item.id_variedad === Number(form.varietyId))?.nombre
    ?? "Variedad sin seleccionar";
  const completedIngredientCount = form.ingredients.filter((item) => item.ingredientId && Number(item.quantity) > 0).length;

  return <section className="recipes-page page-transition">
    <AnimatePresence mode="wait" initial={false}>
    {formOpen ? <motion.form key="recipe-editor" className="recipe-editor recipe-editor--guided" onSubmit={submitEditor}
      initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .24, ease: [0.22, 1, 0.36, 1] }}>
      <header className="recipe-editor__header">
        <button type="button" className="recipe-editor__back" onClick={closeForm}><ChevronLeft size={17} />Volver</button>
        <div className="recipe-editor__heading"><p>{versionBase ? "Nueva versión" : "Nueva receta"}</p><h2 id="recipe-form-title">{formVarietyName}</h2><span>{versionBase ? `Creá la versión ${versionBase.version + 1} sin perder el historial.` : "Completá la receta en tres pasos simples."}</span></div>
        <nav className="recipe-editor__steps" aria-label="Pasos del formulario">
          {([{ step: 1, label: "Datos" }, { step: 2, label: "Ingredientes" }, { step: 3, label: "Costos" }] as const).map((item) => <button type="button" key={item.step} className={`${editorStep === item.step ? "is-active" : ""} ${editorStep > item.step ? "is-complete" : ""}`} onClick={() => moveToEditorStep(item.step)} aria-current={editorStep === item.step ? "step" : undefined}><b>{editorStep > item.step ? "✓" : item.step}</b><span>{item.label}</span></button>)}
        </nav>
      </header>

      <div className="recipe-editor__progress" aria-hidden="true"><span style={{ width: `${(editorStep / 3) * 100}%` }} /></div>

      <AnimatePresence mode="wait" initial={false}>
        {editorStep === 1 && <motion.section className="recipe-editor__stage" key="recipe-step-base" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}>
          <header className="recipe-editor__stage-header"><span>01</span><div><h3>Datos de la receta</h3><p>Variedad, rendimiento e indicaciones generales.</p></div></header>
          <div className="recipe-editor__stage-body recipe-editor__base-grid">
            {versionBase ? <div className="recipe-version-notice"><Layers3 size={18} /><div><strong>Se creará la versión {versionBase.version + 1}</strong><span>La versión {versionBase.version} quedará guardada en el historial.</span></div></div> : <label className="recipe-field"><span>Variedad</span><select autoFocus value={form.varietyId} onChange={(event) => setForm((current) => ({ ...current, varietyId: event.target.value }))} required><option value="">Seleccionar variedad</option>{availableVarieties.map((item) => <option key={item.id_variedad} value={item.id_variedad}>{item.nombre}</option>)}</select></label>}
            <label className="recipe-field"><span>Rendimiento base <small>unidades</small></span><input type="number" min="1" step="1" value={form.baseYieldUnits} onChange={(event) => updateBaseYieldUnits(event.target.value)} required /></label>
            <label className="recipe-field recipe-field--wide"><span>Observaciones <small>{form.notes.length}/500</small></span><textarea maxLength={500} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalles de preparación, textura o rendimiento…" /></label>
          </div>
        </motion.section>}

        {editorStep === 2 && <motion.section className="recipe-editor__stage" key="recipe-step-ingredients" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}>
          <header className="recipe-editor__stage-header"><span>02</span><div><h3>Composición base</h3><p>Indicá cada cantidad en la unidad definida para el ingrediente.</p></div><button type="button" className="recipe-editor__stage-action" onClick={addIngredientRow} disabled={form.ingredients.length >= ingredients.length}><Plus size={15} />Agregar ingrediente</button></header>
          <div className="recipe-editor__stage-body recipe-editor__ingredients-body">
            <div className="recipe-ingredient-rows">{form.ingredients.map((item, index) => { const selectedIngredient = ingredients.find((ingredient) => ingredient.id === Number(item.ingredientId)); const unit = selectedIngredient?.measurementUnit ?? "GRAM"; return <div className="recipe-ingredient-row" key={`${index}-${item.ingredientId}`}><span className="recipe-ingredient-index">{index + 1}</span><label><span className="sr-only">Ingrediente</span><select value={item.ingredientId} onChange={(event) => updateIngredientRow(index, "ingredientId", event.target.value)} required><option value="">Seleccionar ingrediente</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id} disabled={form.ingredients.some((row, rowIndex) => rowIndex !== index && row.ingredientId === String(ingredient.id))}>{displayIngredientName(ingredient.name)} · {measurementUnitSymbol(ingredient.measurementUnit)}</option>)}</select></label><label className="recipe-quantity"><span className="sr-only">Cantidad en {measurementUnitName(unit)}</span><input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={(event) => updateIngredientRow(index, "quantity", event.target.value)} placeholder="Cantidad" required /><small>{measurementUnitSymbol(unit)}</small></label><button type="button" onClick={() => removeIngredientRow(index)} disabled={form.ingredients.length === 1} aria-label={`Quitar ingrediente ${index + 1}`}><Trash2 size={15} /></button></div>; })}</div>
          </div>
        </motion.section>}

        {editorStep === 3 && <motion.section className="recipe-editor__stage" key="recipe-step-costs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}>
          <header className="recipe-editor__stage-header"><span>03</span><div><h3>Costos adicionales</h3><p>Mano de obra, packaging, energía u otros costos de esta versión.</p></div><button type="button" className="recipe-editor__stage-action" onClick={addAdditionalCost}><Plus size={15} />Agregar costo</button></header>
          <div className="recipe-editor__stage-body recipe-editor__costs-body">
            {form.additionalCosts.length === 0 ? <div className="recipe-additional-cost-form__empty"><CircleDollarSign size={18} /><span>No hay costos adicionales. Podés guardar la receta así o agregar uno.</span></div> : <div className="recipe-additional-cost-form__rows">{form.additionalCosts.map((item, index) => { const forcedMode = forcedModeForCostType(item.costType); const yieldUnits = Number(form.baseYieldUnits); const unitValue = Number(item.unitValue); const automaticTotal = Number.isFinite(unitValue) && Number.isFinite(yieldUnits) && unitValue > 0 && yieldUnits > 0 ? unitValue * yieldUnits : null; return <article className="recipe-additional-cost-form__row" key={`${index}-${item.costType}`}>
              <div className="recipe-additional-cost-form__heading"><span>{index + 1}</span><strong>{item.name.trim() || "Costo adicional"}</strong><button type="button" onClick={() => removeAdditionalCost(index)} aria-label={`Quitar costo adicional ${index + 1}`}><Trash2 size={15} /></button></div>
              <div className="recipe-additional-cost-form__grid">
                <label className="recipe-field"><span>Tipo</span><select value={item.costType} onChange={(event) => updateAdditionalCost(index, "costType", event.target.value)}>{additionalCostTypeOptions.map((option) => <option key={option.value} value={option.value} disabled={option.value !== "OTHER" && form.additionalCosts.some((cost, costIndex) => costIndex !== index && cost.costType === option.value)}>{option.label}</option>)}</select></label>
                <label className="recipe-field"><span>Nombre <small>{item.name.length}/100</small></span><input maxLength={100} value={item.name} onChange={(event) => updateAdditionalCost(index, "name", event.target.value)} required /></label>
                <label className="recipe-field"><span>Modo de cálculo</span><select value={item.calculationMode} disabled={Boolean(forcedMode)} onChange={(event) => updateAdditionalCost(index, "calculationMode", event.target.value)}>{additionalCostModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                {item.calculationMode === "PERCENTAGE" ? <label className="recipe-field"><span>Porcentaje <small>%</small></span><input type="number" min="0.000001" max="100" step="0.000001" value={item.value} onChange={(event) => updateAdditionalCost(index, "value", event.target.value)} required /></label> : <>
                  <label className="recipe-field"><span>Costo por unidad <small>$ / unidad</small></span><input type="number" min="0.000001" step="0.000001" value={item.unitValue} onChange={(event) => updateAdditionalCost(index, "unitValue", event.target.value)} placeholder="Ej. 250" required /></label>
                  <div className="recipe-auto-cost"><span>Total automático <small>{Number.isInteger(yieldUnits) && yieldUnits > 0 ? `${yieldUnits} unidades` : "Definí el rendimiento"}</small></span><strong>{automaticTotal === null ? "—" : formatMoney(automaticTotal)}</strong><p>{item.calculationMode === "FIXED_TOTAL" ? "Este total se enviará como valor fijo." : `${formatMoney(unitValue || 0)} por unidad; el total es informativo.`}</p></div>
                </>}
                <label className="recipe-field"><span>Orden</span><input type="number" min="1" step="1" value={item.sortOrder} onChange={(event) => updateAdditionalCost(index, "sortOrder", event.target.value)} required /></label>
                <label className="recipe-field recipe-field--wide"><span>Notas <small>{item.notes.length}/500</small></span><textarea maxLength={500} value={item.notes} onChange={(event) => updateAdditionalCost(index, "notes", event.target.value)} placeholder="Detalle opcional de este costo…" /></label>
              </div>
            </article>; })}</div>}
          </div>
        </motion.section>}
      </AnimatePresence>

      {drawerError && <div className="recipes-error recipe-editor__error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}

      <footer className="recipe-editor__actions"><div><strong>{formVarietyName}</strong><span>Paso {editorStep} de 3 · {editorStep === 1 ? `${form.baseYieldUnits || 0} unidades` : editorStep === 2 ? `${completedIngredientCount} de ${form.ingredients.length} ingredientes` : `${form.additionalCosts.length} costos adicionales`}</span></div><button type="button" className="recipe-secondary" onClick={closeForm}>Cancelar</button>{editorStep > 1 && <button type="button" className="recipe-secondary" onClick={() => moveToEditorStep((editorStep - 1) as RecipeEditorStep)}><ChevronLeft size={15} />Anterior</button>}{editorStep < 3 ? <button key={`continue-step-${editorStep}`} type="button" className="recipes-primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); continueEditor(); }}>Continuar<ChevronRight size={15} /></button> : <button key="save-recipe" type="submit" className="recipes-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="is-spinning" />}{versionBase ? "Crear nueva versión" : "Crear receta"}</button>}</footer>
    </motion.form> : <motion.div key="recipe-overview" className="recipes-overview" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}>
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
            <div className="recipe-detail-hero__content">
              <div className="recipe-detail-hero__heading"><div><span className={`recipe-table-status ${selectedRecipe.active ? "is-active" : "is-history"}`}>{selectedRecipe.active ? "Receta vigente" : "Versión histórica"}</span><h3>{selectedRecipe.varietyName}</h3><p>Versión {selectedRecipe.version} · Actualizada el {formatDate(selectedRecipe.updatedAt)}</p></div><div className="recipe-detail-actions"><button type="button" onClick={() => void openHistory(selectedRecipe)}><History size={16} />Historial</button><button type="button" onClick={() => openCalculation(selectedRecipe)}><Calculator size={16} />Calcular</button><button type="button" className="is-primary" onClick={() => openVersion(selectedRecipe)}><Edit3 size={16} />Nueva versión</button></div></div>
              <div className="recipe-detail-metrics">
                <article><span className="is-yield"><ChefHat size={19} /></span><div><small>Rendimiento</small><strong>{selectedRecipe.baseYieldUnits} u.</strong></div></article>
                <article><span className="is-cost"><CircleDollarSign size={19} /></span><div><small>Costo total</small><strong>{formatMoney(selectedRecipe.costSummary.estimatedRecipeTotalCost)}</strong></div></article>
                <article><span className="is-unit"><Calculator size={19} /></span><div><small>Costo por unidad</small><strong>{formatMoney(selectedRecipe.costSummary.estimatedCostPerUnit)}</strong></div></article>
                <article><span className="is-ingredients"><Wheat size={19} /></span><div><small>Ingredientes</small><strong>{selectedRecipe.ingredients.length}</strong></div></article>
              </div>
            </div>
          </section>

          <section className="recipe-detail-section recipe-detail-composition">
            <header><div><span><ChefHat size={18} /></span><div><h4>Ingredientes</h4><p>Composición para un rendimiento de {selectedRecipe.baseYieldUnits} unidades.</p></div></div><strong>{selectedRecipe.ingredients.length}</strong></header>
            <div className="recipe-detail-table-wrap"><table><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Costo base</th><th>Subtotal</th></tr></thead><tbody>{selectedRecipe.ingredients.map((item, index) => <motion.tr key={item.ingredientId} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .25, delay: .08 + index * .045 }}><td><strong>{displayIngredientName(item.ingredientName)}</strong></td><td>{formatMeasurement(item.quantity, item.measurementUnit)}</td><td>{formatMoney(item.currentCostPerBaseUnit, 6)} / {measurementUnitSymbol(item.measurementUnit)}</td><td><strong>{formatMoney(item.estimatedCost)}</strong></td></motion.tr>)}</tbody></table></div>
            <div className="recipe-cost-notice"><CircleDollarSign size={16} /><span>Subtotal calculado con los precios actuales de los ingredientes.</span><strong>{formatMoney(selectedRecipe.costSummary.ingredientCost)}</strong></div>
          </section>

          <section className="recipe-detail-section recipe-additional-costs">
            <header><div><span><CircleDollarSign size={18} /></span><div><h4>Costos adicionales</h4><p>Valores guardados en esta versión de la receta.</p></div></div><strong>{selectedRecipe.additionalCosts.length}</strong></header>
            {selectedRecipe.additionalCosts.length ? <div className="recipe-additional-cost-list">{[...selectedRecipe.additionalCosts].sort((a, b) => a.sortOrder - b.sortOrder).map((cost, index) => <motion.article key={cost.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, delay: index * .045 }}><div><strong>{cost.name}</strong><small>{additionalCostTypeLabel(cost.costType)} · {additionalCostModeLabel(cost.calculationMode)} · {formatAdditionalCostValue(cost)}</small>{cost.notes && <p>{cost.notes}</p>}</div><b>{formatMoney(cost.calculatedCost)}</b></motion.article>)}</div> : <div className="recipe-additional-cost-empty">Esta versión no tiene costos adicionales.</div>}
          </section>

          <div className="recipe-detail-bottom">
            <section className="recipe-detail-section recipe-cost-summary"><header><div><span><Calculator size={18} /></span><div><h4>Resumen de costos</h4><p>Desglose calculado por el sistema.</p></div></div></header><dl><div><dt>Ingredientes</dt><dd>{formatMoney(selectedRecipe.costSummary.ingredientCost)}</dd></div><div><dt>Adicionales fijos</dt><dd>{formatMoney(selectedRecipe.costSummary.fixedAdditionalCost)}</dd></div><div><dt>Adicionales por unidad</dt><dd>{formatMoney(selectedRecipe.costSummary.perUnitAdditionalCost)}</dd></div><div><dt>Subtotal antes de porcentajes</dt><dd>{formatMoney(selectedRecipe.costSummary.subtotalBeforePercentage)}</dd></div><div><dt>Adicionales porcentuales</dt><dd>{formatMoney(selectedRecipe.costSummary.percentageAdditionalCost)}</dd></div><div><dt>Total de costos adicionales</dt><dd>{formatMoney(selectedRecipe.costSummary.totalAdditionalCost)}</dd></div><div className="is-recipe-total"><dt>Costo total de la receta</dt><dd>{formatMoney(selectedRecipe.costSummary.estimatedRecipeTotalCost)}</dd></div><div className="is-total"><dt>Costo por unidad</dt><dd>{formatMoney(selectedRecipe.costSummary.estimatedCostPerUnit)}</dd></div></dl></section>
            <section className="recipe-detail-section recipe-notes-panel"><header><div><span><BookOpen size={18} /></span><div><h4>Notas de la receta</h4><p>Indicaciones de esta versión.</p></div></div></header><div><strong>Observaciones</strong><p>{selectedRecipe.notes || "Esta versión no tiene observaciones cargadas."}</p><small><Clock3 size={14} />Creada el {formatDate(selectedRecipe.createdAt)}</small></div></section>
          </div>
        </motion.div>}</AnimatePresence>
      </section>
    </div>

    </motion.div>}
    </AnimatePresence>

    <AppConfirmDialog
      open={confirmSaveOpen}
      title={versionBase ? `¿Crear una nueva versión de ${formVarietyName}?` : `¿Crear la receta de ${formVarietyName}?`}
      description={`Se guardará con un rendimiento de ${form.baseYieldUnits || 0} unidades, ${completedIngredientCount} ingredientes y ${form.additionalCosts.length} costos adicionales.`}
      confirmText={versionBase ? "Crear versión" : "Crear receta"}
      loading={saving}
      onConfirm={() => { setConfirmSaveOpen(false); void saveRecipe(); }}
      onCancel={() => setConfirmSaveOpen(false)}
    />

    {createPortal(<AnimatePresence>{recipeSuccess && <motion.div className="recipe-success" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}><motion.div className="recipe-success__card" initial={{ opacity: 0, y: 22, scale: .9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: .96 }} transition={{ duration: .38, ease: [0.16, 1, 0.3, 1] }}><motion.span className="recipe-success__icon" initial={{ scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 360, damping: 19, delay: .08 }}><CircleCheckBig size={42} /></motion.span><strong>{recipeSuccess.title}</strong><p>{recipeSuccess.detail}</p></motion.div></motion.div>}</AnimatePresence>, document.body)}

    {createPortal(<>    {calculationRecipe && <div className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-calculation-title"><button type="button" className="recipe-drawer__backdrop" onClick={() => setCalculationRecipe(null)} aria-label="Cerrar cálculo" /><form className="recipe-drawer__panel recipe-calculation-panel" onSubmit={calculateProduction}>
      <header><div><p>Planificar producción</p><h3 id="recipe-calculation-title">{calculationRecipe.varietyName} · v{calculationRecipe.version}</h3></div><button type="button" onClick={() => setCalculationRecipe(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="recipe-drawer__body"><div className="recipe-calculation-input"><label className="recipe-field"><span>Empanadas a producir</span><input autoFocus type="number" min="1" step="1" value={productionQuantity} onChange={(event) => { setProductionQuantity(event.target.value); setCalculation(null); }} required /></label><button type="submit" className="recipes-primary" disabled={calculating}>{calculating ? <LoaderCircle size={16} className="is-spinning" /> : <Calculator size={16} />}Calcular</button></div>
        <p className="recipe-calculation-help">Este cálculo consulta existencias y costos actuales. No descuenta stock.</p>
        {drawerError && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}
        {calculation && <><div className={`recipe-calculation-status ${missingIngredients > 0 ? "has-missing" : "is-ready"}`}><span>{missingIngredients > 0 ? <AlertTriangle size={20} /> : <ChefHat size={20} />}</span><div><strong>{missingIngredients > 0 ? `Faltan ${missingIngredients} ${missingIngredients === 1 ? "ingrediente" : "ingredientes"}` : "Stock suficiente para producir"}</strong><small>Factor de escala ×{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(calculation.scaleFactor)}</small></div></div>
          <div className="recipe-calculation-totals"><div><span>Producción</span><strong>{calculation.requestedUnits} u.</strong></div><div><span>Costo total</span><strong>{formatMoney(calculation.costSummary.estimatedRecipeTotalCost)}</strong></div><div><span>Por unidad</span><strong>{formatMoney(calculation.costSummary.estimatedCostPerUnit)}</strong></div></div>
          <section className="recipe-requirements"><header><strong>Requerimientos</strong><span>Stock disponible al momento del cálculo</span></header>{calculation.ingredients.map((item) => <article className={!item.enoughStock ? "is-missing" : ""} key={item.ingredientId}><span>{item.enoughStock ? <ChefHat size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{item.ingredientName}</strong><small>Necesitás {formatMeasurement(item.requiredQuantity, item.measurementUnit)} · tenés {formatMeasurement(item.currentStock, item.measurementUnit)}</small></div><div><strong>{formatMoney(item.estimatedCost)}</strong><small>{item.enoughStock ? "Disponible" : `Faltan ${formatMeasurement(item.missingQuantity, item.measurementUnit)}`}</small></div></article>)}</section>
          {calculation.additionalCosts.length > 0 && <section className="recipe-requirements recipe-calculated-additional"><header><strong>Costos adicionales</strong><span>Importes escalados por el sistema para esta producción</span></header>{[...calculation.additionalCosts].sort((a, b) => a.sortOrder - b.sortOrder).map((cost) => <article key={cost.id}><span><CircleDollarSign size={16} /></span><div><strong>{cost.name}</strong><small>{additionalCostTypeLabel(cost.costType)} · {additionalCostModeLabel(cost.calculationMode)} · {formatAdditionalCostValue(cost)}</small></div><div><strong>{formatMoney(cost.calculatedCost)}</strong><small>Calculado</small></div></article>)}</section>}
          <section className="recipe-calculation-breakdown"><strong>Resumen del cálculo</strong><dl><div><dt>Ingredientes</dt><dd>{formatMoney(calculation.costSummary.ingredientCost)}</dd></div><div><dt>Costos adicionales</dt><dd>{formatMoney(calculation.costSummary.totalAdditionalCost)}</dd></div><div><dt>Total</dt><dd>{formatMoney(calculation.costSummary.estimatedRecipeTotalCost)}</dd></div></dl></section>
        </>}
      </div><footer><button type="button" className="recipe-secondary" onClick={() => setCalculationRecipe(null)}>Cerrar</button></footer>
    </form></div>}

    {historyRecipe && <div className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-history-title"><button type="button" className="recipe-drawer__backdrop" onClick={() => setHistoryRecipe(null)} aria-label="Cerrar historial" /><section className="recipe-drawer__panel recipe-history-panel">
      <header><div><p>Historial de versiones</p><h3 id="recipe-history-title">{historyRecipe.varietyName}</h3></div><button type="button" onClick={() => setHistoryRecipe(null)} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="recipe-drawer__body">{historyLoading && <div className="recipes-state"><LoaderCircle size={24} className="is-spinning" />Cargando historial…</div>}{drawerError && <div className="recipes-error" role="alert"><AlertTriangle size={17} /><span>{drawerError}</span></div>}{!historyLoading && recipeHistory.map((recipe) => <article className={`recipe-history-item ${recipe.active ? "is-active" : ""}`} key={recipe.id}><span className="recipe-history-line" /><div className="recipe-history-version"><Layers3 size={17} /><strong>v{recipe.version}</strong></div><div className="recipe-history-content"><header><div><strong>{recipe.active ? "Versión vigente" : `Versión ${recipe.version}`}</strong><span>{formatDate(recipe.createdAt)}</span></div><button type="button" onClick={() => { setHistoryRecipe(null); setSelectedRecipeId(recipe.id); setFilter(recipe.active ? "vigentes" : "historicas"); setPage(0); }} aria-label={`Ver versión ${recipe.version}`}><Eye size={15} /></button></header><p>{recipe.notes || "Sin observaciones."}</p><footer><span>{recipe.baseYieldUnits} unidades</span><span>{recipe.ingredients.length} ingredientes</span><span>{recipe.additionalCosts.length} costos adicionales</span><strong>{formatMoney(recipe.costSummary.estimatedCostPerUnit)} / u.</strong></footer></div></article>)}</div>
      <footer><button type="button" className="recipe-secondary" onClick={() => setHistoryRecipe(null)}>Cerrar</button><button type="button" className="recipes-primary" onClick={() => openVersion(historyRecipe)}><Plus size={15} />Nueva versión</button></footer>
    </section></div>}</>, document.body)}
  </section>;
}
