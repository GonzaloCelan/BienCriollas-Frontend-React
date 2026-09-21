import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock3, Factory, Gauge, History, LoaderCircle, PackageCheck,
  Plus, RefreshCw, Save, SlidersHorizontal, Trash2, Wheat, X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import AppConfirmDialog from "../components/AppConfirmDialog";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import { getVarietyImage } from "../features/procesos/recipes";
import { ApiError } from "../services/httpClient";
import { listarIngredientesApi, type Ingrediente } from "../services/ingredientesApi";
import {
  actualizarConsumoProduccionApi, actualizarProduccionApi, agregarIngredienteProduccionApi,
  cancelarProduccionApi, crearProduccionApi, finalizarProduccionApi, listarProduccionesApi,
  obtenerProduccionApi, type EstadoProduccion, type IngredienteProduccion,
  type OrdenProducciones, type PaginaProducciones, type Produccion,
} from "../services/produccionesApi";
import { listarRecetasApi, type Receta } from "../services/recetasApi";
import { formatMeasurement, measurementUnitSymbol } from "../utils/measurementUnits";
import { additionalCostModeLabel, additionalCostTypeLabel } from "../utils/recipeAdditionalCosts";
import "../styles/nuevaProduccion.css";

const PAGE_SIZE = 12;
type FiltroEstado = "ALL" | EstadoProduccion;
type ConfirmAction = "FINALIZE" | "CANCEL" | null;
type CreateForm = { varietyId: string; productionDate: string; plannedUnits: string; notes: string };
type RealForm = { finalUnits: string; totalMinutes: string; peopleCount: string; wasteUnits: string; wasteReason: string; notes: string };

function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const EMPTY_CREATE: CreateForm = { varietyId: "", productionDate: localDate(), plannedUnits: "100", notes: "" };
const EMPTY_REAL: RealForm = { finalUnits: "", totalMinutes: "", peopleCount: "", wasteUnits: "0", wasteReason: "", notes: "" };

const statusCopy: Record<EstadoProduccion, { label: string; description: string }> = {
  DRAFT: { label: "Borrador", description: "Editable, sin movimientos de stock" },
  FINALIZED: { label: "Finalizada", description: "Stock actualizado" },
  CANCELED: { label: "Cancelada", description: "Sin movimientos de stock" },
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function effectiveActual(item: IngredienteProduccion) {
  return item.actualQuantity ?? item.expectedQuantity;
}

function hasAtMostFourDecimals(value: string) {
  const decimals = value.trim().split(/[.,]/)[1];
  return !decimals || decimals.length <= 4;
}

function realFormFrom(production: Produccion): RealForm {
  return {
    finalUnits: production.finalUnits === null ? "" : String(production.finalUnits),
    totalMinutes: production.totalMinutes === null ? "" : String(production.totalMinutes),
    peopleCount: production.peopleCount === null ? "" : String(production.peopleCount),
    wasteUnits: String(production.wasteUnits ?? 0),
    wasteReason: production.wasteReason ?? "",
    notes: production.notes ?? "",
  };
}

export default function NuevaProduccion() {
  const [pageData, setPageData] = useState<PaginaProducciones | null>(null);
  const [recipes, setRecipes] = useState<Receta[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [statusFilter, setStatusFilter] = useState<FiltroEstado>("ALL");
  const [sort, setSort] = useState<OrdenProducciones>("productionDate,desc");
  const [page, setPage] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
  const [counters, setCounters] = useState({ all: 0, draft: 0, finalized: 0, canceled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Produccion | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [realForm, setRealForm] = useState<RealForm>(EMPTY_REAL);
  const [consumptions, setConsumptions] = useState<Record<number, string>>({});
  const [extraIngredientId, setExtraIngredientId] = useState("");
  const [extraQuantity, setExtraQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const productions = pageData?.content ?? [];
  const currentSelectedId = productions.some((item) => item.id === selectedId) ? selectedId : productions[0]?.id ?? null;

  const loadCounters = useCallback(async () => {
    const [all, draft, finalized, canceled] = await Promise.all([
      listarProduccionesApi({ page: 0, size: 1 }),
      listarProduccionesApi({ page: 0, size: 1, status: "DRAFT" }),
      listarProduccionesApi({ page: 0, size: 1, status: "FINALIZED" }),
      listarProduccionesApi({ page: 0, size: 1, status: "CANCELED" }),
    ]);
    setCounters({ all: all.totalElements, draft: draft.totalElements, finalized: finalized.totalElements, canceled: canceled.totalElements });
  }, []);

  const loadProductions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listarProduccionesApi({
        page, size: PAGE_SIZE, sort,
        status: appliedRange ? null : statusFilter === "ALL" ? null : statusFilter,
        from: appliedRange?.from, to: appliedRange?.to,
      });
      setPageData(data);
    } catch (loadError) {
      setError(errorMessage(loadError, "No se pudieron cargar las producciones."));
    } finally {
      setLoading(false);
    }
  }, [appliedRange, page, sort, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        listarRecetasApi({ active: true, page: 0, size: 100 }).then((data) => setRecipes(data.content)),
        listarIngredientesApi({ filtro: "activos", page: 0, size: 100, sort: "name,asc" }).then((data) => setIngredients(data.content)),
        loadCounters(),
      ]).catch((loadError) => setError(errorMessage(loadError, "No se pudieron cargar los datos de producción.")));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCounters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProductions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProductions]);

  useEffect(() => {
    if (currentSelectedId === null) {
      const timer = window.setTimeout(() => {
        setDetail(null);
        setRealForm(EMPTY_REAL);
        setConsumptions({});
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(async () => {
      try {
        setDetailLoading(true);
        const production = await obtenerProduccionApi(currentSelectedId);
        setDetail(production);
        setRealForm(realFormFrom(production));
        setConsumptions(Object.fromEntries(production.ingredients.map((item) => [item.ingredientId, String(effectiveActual(item))])));
        setExtraIngredientId("");
        setExtraQuantity("");
      } catch (loadError) {
        setError(errorMessage(loadError, "No se pudo cargar el detalle de la producción."));
      } finally {
        setDetailLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentSelectedId]);

  useEffect(() => {
    if (!createOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [createOpen]);

  const extraIngredients = useMemo(() => {
    const assigned = new Set(detail?.ingredients.map((item) => item.ingredientId) ?? []);
    return ingredients.filter((item) => !assigned.has(item.id));
  }, [detail, ingredients]);
  const selectedExtraIngredient = extraIngredients.find((item) => item.id === Number(extraIngredientId));

  const hasConsumptionChanges = Boolean(detail?.ingredients.some((item) => Number(consumptions[item.ingredientId]) !== effectiveActual(item)));
  const hasRealChanges = Boolean(detail && JSON.stringify(realForm) !== JSON.stringify(realFormFrom(detail)));
  const hasPendingChanges = hasConsumptionChanges || hasRealChanges;
  const totalPages = pageData?.totalPages ?? 0;
  const pageNumbers = useMemo(() => {
    const start = Math.max(0, Math.min(page - 1, totalPages - 3));
    return Array.from({ length: Math.min(3, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);

  function openCreate() {
    setCreateForm({ ...EMPTY_CREATE, varietyId: recipes[0] ? String(recipes[0].varietyId) : "", productionDate: localDate() });
    setError("");
    setCreateOpen(true);
  }

  async function createProduction(event: FormEvent) {
    event.preventDefault();
    const varietyId = Number(createForm.varietyId);
    const plannedUnits = Number(createForm.plannedUnits);
    if (!Number.isInteger(varietyId) || varietyId <= 0) { setError("Seleccioná una variedad con receta vigente."); return; }
    if (!createForm.productionDate) { setError("Seleccioná la fecha de producción."); return; }
    if (!Number.isInteger(plannedUnits) || plannedUnits < 1) { setError("Las unidades planificadas deben ser un entero mayor que cero."); return; }
    if (createForm.notes.length > 1000) { setError("Las notas admiten hasta 1000 caracteres."); return; }
    try {
      setSaving(true); setError("");
      const created = await crearProduccionApi({ varietyId, productionDate: createForm.productionDate, plannedUnits, notes: createForm.notes.trim() || null });
      setCreateOpen(false); setSelectedId(created.id); setStatusFilter("ALL"); setAppliedRange(null); setPage(0);
      gooeyToast.success("Producción creada", { description: `${created.varietyName} · ${created.plannedUnits} unidades`, timing: TOAST_RAPIDO_TIMING });
      await Promise.all([loadProductions(), loadCounters()]);
    } catch (createError) {
      setError(errorMessage(createError, "No se pudo crear la producción."));
    } finally { setSaving(false); }
  }

  function validateDraft() {
    const optionalIntegerFields: Array<[keyof RealForm, string, number]> = [
      ["finalUnits", "La cantidad final", 0], ["totalMinutes", "El tiempo total", 1],
      ["peopleCount", "La cantidad de personas", 1], ["wasteUnits", "La merma", 0],
    ];
    for (const [field, label, minimum] of optionalIntegerFields) {
      const raw = realForm[field].trim();
      if (raw && (!Number.isInteger(Number(raw)) || Number(raw) < minimum)) return `${label} debe ser un entero de al menos ${minimum}.`;
    }
    if (realForm.wasteReason.length > 250) return "El motivo de merma admite hasta 250 caracteres.";
    if (realForm.notes.length > 1000) return "Las notas admiten hasta 1000 caracteres.";
    for (const value of Object.values(consumptions)) {
      if (!value.trim() || !hasAtMostFourDecimals(value) || !Number.isFinite(Number(value)) || Number(value) < 0) return "Los consumos deben ser cantidades positivas con hasta 4 decimales.";
    }
    return "";
  }

  async function persistDraft(showToast = false) {
    if (!detail || detail.status !== "DRAFT") return detail;
    const validation = validateDraft();
    if (validation) throw new Error(validation);
    let updated = await actualizarProduccionApi(detail.id, {
      finalUnits: realForm.finalUnits.trim() ? Number(realForm.finalUnits) : null,
      totalMinutes: realForm.totalMinutes.trim() ? Number(realForm.totalMinutes) : null,
      peopleCount: realForm.peopleCount.trim() ? Number(realForm.peopleCount) : null,
      wasteUnits: realForm.wasteUnits.trim() ? Number(realForm.wasteUnits) : null,
      wasteReason: realForm.wasteReason,
      notes: realForm.notes,
    });
    for (const ingredient of detail.ingredients) {
      const next = Number(consumptions[ingredient.ingredientId]);
      if (next !== effectiveActual(ingredient)) updated = await actualizarConsumoProduccionApi(detail.id, ingredient.ingredientId, next);
    }
    syncProduction(updated);
    if (showToast) gooeyToast.success("Datos reales guardados", { description: `${updated.varietyName} · producción #${updated.id}`, timing: TOAST_RAPIDO_TIMING });
    return updated;
  }

  function syncProduction(production: Produccion) {
    setDetail(production);
    setRealForm(realFormFrom(production));
    setConsumptions(Object.fromEntries(production.ingredients.map((item) => [item.ingredientId, String(effectiveActual(item))])));
    setPageData((current) => current ? { ...current, content: current.content.map((item) => item.id === production.id ? production : item) } : current);
  }

  async function saveDraft() {
    try { setSaving(true); setError(""); await persistDraft(true); }
    catch (saveError) { setError(errorMessage(saveError, "No se pudieron guardar los datos reales.")); }
    finally { setSaving(false); }
  }

  async function addExtraIngredient(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const ingredientId = Number(extraIngredientId);
    const quantity = Number(extraQuantity);
    if (!Number.isInteger(ingredientId) || ingredientId <= 0) { setError("Seleccioná un ingrediente extra."); return; }
    if (!extraQuantity.trim() || !hasAtMostFourDecimals(extraQuantity) || !Number.isFinite(quantity) || quantity < 0) { setError("Ingresá una cantidad válida con hasta 4 decimales."); return; }
    try {
      setSaving(true); setError("");
      const updated = await agregarIngredienteProduccionApi(detail.id, ingredientId, quantity);
      syncProduction(updated); setExtraIngredientId(""); setExtraQuantity("");
      gooeyToast.success("Ingrediente extra agregado", { timing: TOAST_RAPIDO_TIMING });
    } catch (addError) { setError(errorMessage(addError, "No se pudo agregar el ingrediente extra.")); }
    finally { setSaving(false); }
  }

  async function confirmProductionAction() {
    if (!detail || !confirmAction) return;
    try {
      setSaving(true); setError("");
      const updated = confirmAction === "FINALIZE"
        ? await finalizarProduccionApi((await persistDraft(false))!.id)
        : await cancelarProduccionApi(detail.id);
      syncProduction(updated); setConfirmAction(null);
      gooeyToast.success(confirmAction === "FINALIZE" ? "Producción finalizada" : "Producción cancelada", {
        description: confirmAction === "FINALIZE" ? "Ingredientes descontados y empanadas ingresadas al stock." : "No se realizaron movimientos de stock.",
        timing: TOAST_RAPIDO_TIMING,
      });
      await Promise.all([loadProductions(), loadCounters()]);
    } catch (actionError) { setError(errorMessage(actionError, "No se pudo completar la operación.")); }
    finally { setSaving(false); }
  }

  function applyDateRange() {
    if (!fromDate || !toDate) { setError("Completá ambas fechas para aplicar el rango."); return; }
    if (fromDate > toDate) { setError("La fecha desde no puede ser posterior a la fecha hasta."); return; }
    setError(""); setAppliedRange({ from: fromDate, to: toDate }); setPage(0);
  }

  const selectedStatus = detail ? statusCopy[detail.status] : null;
  const efficiencyTone = (detail?.productivityVariationPercentage ?? 0) >= 0 ? "positive" : "negative";

  return <section className="real-production-page page-transition">
    <header className="rp-hero"><div><p>Producción</p><h2>Nueva producción</h2><span>Registrá cada tanda real, sus consumos, costos, tiempos y rendimiento.</span></div><button className="rp-primary" type="button" onClick={openCreate} disabled={!recipes.length}><Plus size={17} />Nueva producción</button></header>

    <div className="rp-summary">
      <article><span className="draft"><Factory size={19} /></span><div><small>Borradores</small><strong>{counters.draft}</strong><p>pendientes de finalizar</p></div></article>
      <article><span className="done"><CheckCircle2 size={19} /></span><div><small>Finalizadas</small><strong>{counters.finalized}</strong><p>con stock actualizado</p></div></article>
      <article><span className="canceled"><Trash2 size={19} /></span><div><small>Canceladas</small><strong>{counters.canceled}</strong><p>sin movimiento de stock</p></div></article>
      <article><span className="all"><History size={19} /></span><div><small>Total</small><strong>{counters.all}</strong><p>producciones registradas</p></div></article>
    </div>

    <section className="rp-toolbar">
      <div className="rp-status-filter">{(["ALL", "DRAFT", "FINALIZED", "CANCELED"] as FiltroEstado[]).map((status) => <button type="button" key={status} className={!appliedRange && statusFilter === status ? "is-active" : ""} onClick={() => { setStatusFilter(status); setAppliedRange(null); setPage(0); }}>{status === "ALL" ? "Todas" : statusCopy[status].label}</button>)}</div>
      <div className="rp-date-range"><CalendarDays size={15} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Fecha desde" /><span>hasta</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Fecha hasta" /><button type="button" onClick={applyDateRange}>Aplicar</button>{appliedRange && <button type="button" className="is-clear" onClick={() => { setAppliedRange(null); setFromDate(""); setToDate(""); }}>Limpiar</button>}</div>
      <label className="rp-sort"><SlidersHorizontal size={15} /><select value={sort} onChange={(event) => { setSort(event.target.value as OrdenProducciones); setPage(0); }} aria-label="Ordenar producciones"><option value="productionDate,desc">Más recientes</option><option value="productionDate,asc">Más antiguas</option><option value="varietyName,asc">Variedad A–Z</option><option value="plannedUnits,desc">Mayor planificación</option><option value="finalUnits,desc">Mayor producción real</option><option value="status,asc">Estado</option></select></label>
      <button className="rp-icon-button" type="button" onClick={() => void loadProductions()} disabled={loading} aria-label="Actualizar producciones"><RefreshCw size={16} className={loading ? "rp-spin" : ""} /></button>
    </section>

    {error && <div className="rp-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar"><X size={15} /></button></div>}

    <div className="rp-workspace">
      <aside className="rp-list" aria-label="Producciones registradas">
        <header><div><strong>{appliedRange ? "Rango de fechas" : statusFilter === "ALL" ? "Todas las producciones" : statusCopy[statusFilter].label}</strong><span>{pageData?.totalElements ?? 0} registros</span></div>{appliedRange && <small>{formatDate(appliedRange.from)} — {formatDate(appliedRange.to)}</small>}</header>
        {loading && <div className="rp-state"><LoaderCircle className="rp-spin" size={25} />Cargando producciones…</div>}
        {!loading && !productions.length && <div className="rp-state"><span><Factory size={28} /></span><strong>No hay producciones</strong><p>Creá una tanda nueva o modificá los filtros.</p></div>}
        {!loading && <motion.div className="rp-production-list" layout>{productions.map((production, index) => {
          const active = production.id === currentSelectedId;
          return <motion.button type="button" key={production.id} className={`rp-production-item ${active ? "is-selected" : ""}`} onClick={() => setSelectedId(production.id)} aria-pressed={active} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .035 }} layout>
            <img src={getVarietyImage(production.varietyId)} alt="" /><span><span><strong>{production.varietyName}</strong><em>#{production.id}</em></span><small>{formatDate(production.productionDate)} · Receta v{production.recipeVersion}</small><b>{production.finalUnits ?? production.plannedUnits} / {production.plannedUnits} unidades</b></span><i className={`rp-status rp-status--${production.status.toLowerCase()}`}>{statusCopy[production.status].label}</i><ChevronRight size={16} />
          </motion.button>;
        })}</motion.div>}
        {(pageData?.totalPages ?? 0) > 1 && <footer className="rp-pagination"><span>{pageData?.numberOfElements} de {pageData?.totalElements}</span><div><button disabled={pageData?.first} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button>{pageNumbers.map((number) => <button key={number} className={number === page ? "is-active" : ""} onClick={() => setPage(number)}>{number + 1}</button>)}<button disabled={pageData?.last} onClick={() => setPage((value) => value + 1)}><ChevronRight size={15} /></button></div></footer>}
      </aside>

      <section className="rp-detail" aria-label="Detalle de producción">
        {detailLoading && <div className="rp-state rp-detail-state"><LoaderCircle className="rp-spin" size={27} />Cargando detalle…</div>}
        {!detailLoading && !detail && <div className="rp-state rp-detail-state"><span><Factory size={30} /></span><strong>Seleccioná una producción</strong><p>Acá vas a ver consumos, costos y productividad.</p></div>}
        <AnimatePresence mode="wait" initial={false}>{!detailLoading && detail && <motion.div className="rp-detail-content" key={detail.id} initial={{ opacity: 0, y: 12, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .28 }}>
          <header className="rp-detail-hero"><div className="rp-detail-photo"><img src={getVarietyImage(detail.varietyId)} alt={`Empanadas de ${detail.varietyName}`} /></div><div className="rp-detail-heading"><span className={`rp-status rp-status--${detail.status.toLowerCase()}`}>{selectedStatus?.label}</span><h3>{detail.varietyName}</h3><p>Producción #{detail.id} · {formatDate(detail.productionDate)}</p><div><span>Receta v{detail.recipeVersion}</span><span>{detail.processVersion ? `Proceso v${detail.processVersion}` : "Sin proceso asociado"}</span></div></div>{detail.status === "DRAFT" && <div className="rp-detail-actions"><button type="button" onClick={() => setConfirmAction("CANCEL")}><Trash2 size={15} />Cancelar</button><button className="is-primary" type="button" onClick={() => { if (!realForm.finalUnits.trim()) { setError("Informá las unidades finales antes de finalizar."); return; } setConfirmAction("FINALIZE"); }}><CheckCircle2 size={15} />Finalizar</button></div>}</header>

          <div className="rp-detail-metrics"><article><span><Factory size={18} /></span><div><small>Planificadas</small><strong>{detail.plannedUnits} u.</strong></div></article><article><span className="done"><PackageCheck size={18} /></span><div><small>Terminadas</small><strong>{detail.finalUnits ?? "—"}{detail.finalUnits !== null ? " u." : ""}</strong></div></article><article><span className="money"><CircleDollarSign size={18} /></span><div><small>Costo de ingredientes</small><strong>{formatMoney(detail.actualIngredientCost)}</strong></div></article><article><span className={efficiencyTone}><Gauge size={18} /></span><div><small>Productividad</small><strong>{detail.actualUnitsPerHour === null ? "—" : `${formatNumber(detail.actualUnitsPerHour)} u./h`}</strong></div></article></div>

          <section className="rp-panel"><header><div><span><Factory size={17} /></span><div><h4>Resultado real</h4><p>{detail.status === "DRAFT" ? "Completá los datos medidos durante la tanda." : statusCopy[detail.status].description}</p></div></div>{detail.status === "DRAFT" && <button className="rp-save" type="button" onClick={() => void saveDraft()} disabled={saving || !hasPendingChanges}>{saving ? <LoaderCircle className="rp-spin" size={15} /> : <Save size={15} />}Guardar cambios</button>}</header><div className="rp-real-grid">
            <label><span>Unidades finales</span><input type="number" min="0" step="1" disabled={detail.status !== "DRAFT"} value={realForm.finalUnits} onChange={(event) => setRealForm((current) => ({ ...current, finalUnits: event.target.value }))} placeholder="Pendiente" /></label>
            <label><span>Tiempo total <small>minutos</small></span><input type="number" min="1" step="1" disabled={detail.status !== "DRAFT"} value={realForm.totalMinutes} onChange={(event) => setRealForm((current) => ({ ...current, totalMinutes: event.target.value }))} placeholder="Pendiente" /></label>
            <label><span>Personas</span><input type="number" min="1" step="1" disabled={detail.status !== "DRAFT"} value={realForm.peopleCount} onChange={(event) => setRealForm((current) => ({ ...current, peopleCount: event.target.value }))} placeholder="Pendiente" /></label>
            <label><span>Merma <small>unidades</small></span><input type="number" min="0" step="1" disabled={detail.status !== "DRAFT"} value={realForm.wasteUnits} onChange={(event) => setRealForm((current) => ({ ...current, wasteUnits: event.target.value }))} /></label>
            <label className="wide"><span>Motivo de merma <small>{realForm.wasteReason.length}/250</small></span><input maxLength={250} disabled={detail.status !== "DRAFT"} value={realForm.wasteReason} onChange={(event) => setRealForm((current) => ({ ...current, wasteReason: event.target.value }))} placeholder="Ej. Tapas rotas" /></label>
            <label className="wide"><span>Notas <small>{realForm.notes.length}/1000</small></span><textarea rows={2} maxLength={1000} disabled={detail.status !== "DRAFT"} value={realForm.notes} onChange={(event) => setRealForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Observaciones de la tanda…" /></label>
          </div></section>

          <section className="rp-panel rp-consumption"><header><div><span><Wheat size={17} /></span><div><h4>Consumo de ingredientes</h4><p>Esperado contra consumo real, stock y costos congelados.</p></div></div><strong>{detail.ingredients.length}</strong></header><div className="rp-table-wrap"><table><thead><tr><th>Ingrediente</th><th>Esperado</th><th>Real</th><th>Diferencia</th><th>Stock proyectado</th><th>Costo real</th></tr></thead><tbody>{detail.ingredients.map((item, index) => { const actual = Number(consumptions[item.ingredientId] ?? effectiveActual(item)); const difference = actual - item.expectedQuantity; return <motion.tr key={item.ingredientId} className={!item.enoughStock ? "is-missing" : ""} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .035 }}><td><span><Wheat size={15} /></span><strong>{item.ingredientName}</strong>{item.expectedQuantity === 0 && <em>Extra</em>}</td><td>{formatMeasurement(item.expectedQuantity, item.measurementUnit)}</td><td>{detail.status === "DRAFT" ? <div className="rp-quantity"><input type="number" min="0" step="0.0001" value={consumptions[item.ingredientId] ?? ""} onChange={(event) => setConsumptions((current) => ({ ...current, [item.ingredientId]: event.target.value }))} /><small>{measurementUnitSymbol(item.measurementUnit)}</small></div> : formatMeasurement(effectiveActual(item), item.measurementUnit)}</td><td className={difference > 0 ? "is-negative" : difference < 0 ? "is-positive" : ""}>{difference > 0 ? "+" : ""}{formatMeasurement(difference, item.measurementUnit)}</td><td><strong className={item.enoughStock ? "is-positive" : "is-negative"}>{formatMeasurement(item.currentStock - actual, item.measurementUnit)}</strong></td><td><strong>{formatMoney(actual * item.costPerBaseUnitSnapshot)}</strong></td></motion.tr>; })}</tbody></table></div>
            {detail.status === "DRAFT" && <form className="rp-extra" onSubmit={addExtraIngredient}><Plus size={16} /><strong>Ingrediente extra</strong><select value={extraIngredientId} onChange={(event) => setExtraIngredientId(event.target.value)}><option value="">Seleccionar ingrediente</option>{extraIngredients.map((item) => <option key={item.id} value={item.id}>{item.name} · {measurementUnitSymbol(item.measurementUnit)}</option>)}</select><div className="rp-quantity"><input type="number" min="0" step="0.0001" value={extraQuantity} onChange={(event) => setExtraQuantity(event.target.value)} placeholder="Cantidad" /><small>{selectedExtraIngredient ? measurementUnitSymbol(selectedExtraIngredient.measurementUnit) : "—"}</small></div><button type="submit" disabled={saving || !extraIngredientId}>Agregar</button></form>}
          </section>

          {detail.additionalCosts.length > 0 && <section className="rp-panel rp-additional-costs"><header><div><span><CircleDollarSign size={17} /></span><div><h4>Costos adicionales congelados</h4><p>Snapshot de la versión de receta usada en esta producción.</p></div></div><strong>{detail.additionalCosts.length}</strong></header><div>{[...detail.additionalCosts].sort((a, b) => a.sortOrder - b.sortOrder).map((cost, index) => <motion.article key={cost.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .035 }}><span><CircleDollarSign size={15} /></span><div><strong>{cost.name}</strong><small>{additionalCostTypeLabel(cost.costType)} · {additionalCostModeLabel(cost.calculationMode)}</small></div><b>{formatMoney(cost.expectedCost)}</b></motion.article>)}</div></section>}

          <div className="rp-bottom-grid"><section className="rp-panel rp-costs"><header><div><span><CircleDollarSign size={17} /></span><div><h4>Costos de ingredientes</h4><p>Snapshot de precios de esta producción.</p></div></div></header><dl><div><dt>Costo esperado</dt><dd>{formatMoney(detail.expectedIngredientCost)}</dd></div><div><dt>Costo real</dt><dd>{formatMoney(detail.actualIngredientCost)}</dd></div><div className="total"><dt>Costo real por unidad</dt><dd>{detail.actualIngredientCostPerUnit === null ? "—" : formatMoney(detail.actualIngredientCostPerUnit)}</dd></div></dl></section><section className="rp-panel rp-productivity"><header><div><span><Gauge size={17} /></span><div><h4>Productividad</h4><p>Comparación entre el proceso estándar y el resultado real.</p></div></div></header><div><article><span>Estándar</span><strong>{detail.standardUnitsPerHour === null ? "—" : `${formatNumber(detail.standardUnitsPerHour)} u./h`}</strong></article><article><span>Real</span><strong>{detail.actualUnitsPerHour === null ? "—" : `${formatNumber(detail.actualUnitsPerHour)} u./h`}</strong></article><article className={efficiencyTone}><span>Variación</span><strong>{detail.productivityVariationPercentage === null ? "—" : `${detail.productivityVariationPercentage > 0 ? "+" : ""}${formatNumber(detail.productivityVariationPercentage)}%`}</strong></article></div>{detail.finalizedAt && <small><Clock3 size={13} />Finalizada el {formatDate(detail.finalizedAt)}</small>}</section></div>
        </motion.div>}</AnimatePresence>
      </section>
    </div>

    {createPortal(<>{createOpen && <div className="rp-drawer" role="dialog" aria-modal="true" aria-labelledby="rp-create-title"><button className="rp-drawer__backdrop" type="button" onClick={() => setCreateOpen(false)} aria-label="Cerrar" /><form className="rp-drawer__panel" onSubmit={createProduction}><header><div><p>Nueva producción</p><h3 id="rp-create-title">Planificar una tanda</h3></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Cerrar"><X size={20} /></button></header><div className="rp-drawer__body"><div className="rp-create-intro"><Factory size={22} /><div><strong>El backend congelará la receta y los costos</strong><span>La producción comienza como borrador y todavía no modifica el stock.</span></div></div><fieldset><legend>Elegí una receta vigente</legend><div className="rp-varieties">{recipes.map((recipe) => <button type="button" key={recipe.id} className={createForm.varietyId === String(recipe.varietyId) ? "is-selected" : ""} onClick={() => setCreateForm((current) => ({ ...current, varietyId: String(recipe.varietyId) }))}><img src={getVarietyImage(recipe.varietyId)} alt="" /><span><strong>{recipe.varietyName}</strong><small>Receta v{recipe.version} · rinde {recipe.baseYieldUnits} u.</small></span><CheckCircle2 size={16} /></button>)}</div></fieldset><div className="rp-create-grid"><label><span>Fecha</span><input type="date" value={createForm.productionDate} onChange={(event) => setCreateForm((current) => ({ ...current, productionDate: event.target.value }))} required /></label><label><span>Unidades planificadas</span><input type="number" min="1" step="1" value={createForm.plannedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, plannedUnits: event.target.value }))} required /></label><label className="wide"><span>Notas <small>{createForm.notes.length}/1000</small></span><textarea rows={4} maxLength={1000} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej. Tanda de la tarde" /></label></div>{error && <div className="rp-error"><AlertTriangle size={16} /><span>{error}</span></div>}</div><footer><button type="button" className="rp-secondary" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="rp-primary" type="submit" disabled={saving || !createForm.varietyId}>{saving ? <LoaderCircle className="rp-spin" size={16} /> : <Plus size={16} />}Crear borrador</button></footer></form></div>}</>, document.body)}

    <AppConfirmDialog open={Boolean(confirmAction)} title={confirmAction === "FINALIZE" ? "Finalizar producción" : "Cancelar producción"} description={confirmAction === "FINALIZE" ? "Se descontarán los consumos reales de ingredientes y se sumarán las unidades terminadas al stock. Esta operación no se puede editar después." : `La producción #${detail?.id ?? ""} se cancelará sin modificar ningún stock.`} confirmText={confirmAction === "FINALIZE" ? "Finalizar y actualizar stock" : "Cancelar producción"} variant={confirmAction === "FINALIZE" ? "primary" : "danger"} loading={saving} onConfirm={() => void confirmProductionAction()} onCancel={() => setConfirmAction(null)} />
  </section>;
}
