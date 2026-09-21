import {
  AlertTriangle, CalendarDays, Info,
  ChevronRight, CircleDollarSign, Clock3, Factory, Gauge, Leaf, LoaderCircle,
  PackageCheck, RefreshCw, Save, Settings2, Sparkles, TrendingDown, TrendingUp,
  UsersRound, Wheat, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { gooeyToast } from "goey-toast";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { TOAST_RAPIDO_TIMING } from "../config/toast";
import { getVarietyImage } from "../features/procesos/recipes";
import { ApiError } from "../services/httpClient";
import {
  getAnalyticsSettingsApi, getIngredientDeviationsApi, getLaborSummaryApi,
  getProductionPerformanceApi, getProductionRankingApi, getProductionSummaryApi,
  getVarietiesPerformanceApi, getVarietyPerformanceApi, getWasteAnalysisApi,
  updateAnalyticsSettingsApi, type AnalyticsSettings, type IngredientDeviation,
  type LaborSummary, type ProductionPerformance, type ProductionRanking,
  type ProductionSummary, type VarietyPerformance, type WasteAnalysis,
} from "../services/productionAnalyticsApi";
import { formatMeasurement } from "../utils/measurementUnits";
import "../styles/costosRendimiento.css";

type Range = { from: string; to: string };
type Drawer = "settings" | "production" | "variety" | null;
type LaborStatus = "positive" | "negative" | "neutral";

const performanceCopy = {
  EXCELLENT: { label: "Excelente", tone: "excellent" },
  GOOD: { label: "Bueno", tone: "good" },
  NORMAL: { label: "Normal", tone: "normal" },
  WARNING: { label: "Atención", tone: "warning" },
  CRITICAL: { label: "Crítico", tone: "critical" },
} as const;

function isoDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialRange(): Range {
  const now = new Date();
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
}

function number(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits }).format(value);
}

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;
}

function variationClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function variationLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${number(value)}%`;
}

function hasAtMostTwoDecimals(raw: string) {
  const decimals = raw.trim().split(/[.,]/)[1];
  return !decimals || decimals.length <= 2;
}

export default function CostosRendimiento() {
  const [draftRange, setDraftRange] = useState<Range>(initialRange);
  const [range, setRange] = useState<Range>(initialRange);
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [labor, setLabor] = useState<LaborSummary | null>(null);
  const [settings, setSettings] = useState<AnalyticsSettings | null>(null);
  const [varieties, setVarieties] = useState<VarietyPerformance[]>([]);
  const [deviations, setDeviations] = useState<IngredientDeviation[]>([]);
  const [waste, setWaste] = useState<WasteAnalysis[]>([]);
  const [best, setBest] = useState<ProductionRanking[]>([]);
  const [worst, setWorst] = useState<ProductionRanking[]>([]);
  const [rankingDetails, setRankingDetails] = useState<Record<number, ProductionPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [productionDetail, setProductionDetail] = useState<ProductionPerformance | null>(null);
  const [varietyDetail, setVarietyDetail] = useState<VarietyPerformance | null>(null);
  const [settingsForm, setSettingsForm] = useState({ labor: "", energy: "" });
  const [saving, setSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const settingsRequest = getAnalyticsSettingsApi().catch(() => null);
      const [nextSummary, nextLabor, nextVarieties, nextDeviations, nextWaste, nextBest, nextWorst] = await Promise.all([
        getProductionSummaryApi(range), getLaborSummaryApi(range),
        getVarietiesPerformanceApi(range), getIngredientDeviationsApi(range), getWasteAnalysisApi(range),
        getProductionRankingApi("best", range), getProductionRankingApi("worst", range),
      ]);
      const nextSettings = await settingsRequest;
      setSettings(nextSettings);
      setSettingsForm(nextSettings ? { labor: String(nextSettings.averageHourlyLaborCost), energy: String(nextSettings.energyPercentage) } : { labor: "", energy: "" });
      setSummary(nextSummary); setLabor(nextLabor); setVarieties(nextVarieties);
      setDeviations(nextDeviations); setWaste(nextWaste); setBest(nextBest); setWorst(nextWorst);
      const rankingIds = [...new Set([...nextBest, ...nextWorst].map((item) => item.productionId))];
      const detailEntries = await Promise.all(rankingIds.map(async (id) => {
        try { return [id, await getProductionPerformanceApi(id)] as const; }
        catch { return null; }
      }));
      setRankingDetails(Object.fromEntries(detailEntries.filter((entry): entry is readonly [number, ProductionPerformance] => entry !== null)));
    } catch (loadError) {
      setError(errorMessage(loadError, "No se pudo cargar el análisis de producción."));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawer]);

  const costParts = useMemo(() => {
    const total = summary?.totalProductionCost || 0;
    return [
      { label: "Ingredientes", value: summary?.totalIngredientCost ?? 0, color: "#f34343", configured: true },
      { label: "Mano de obra", value: summary?.totalLaborCost ?? 0, color: "#f59e0b", configured: Boolean(settings) },
      { label: "Energía", value: summary?.totalEnergyCost ?? 0, color: "#4f75d8", configured: Boolean(settings) },
      { label: "Packaging", value: summary?.totalPackagingCost ?? 0, color: "#7c63d8", configured: true },
      { label: "Otros adicionales", value: summary?.totalOtherAdditionalCost ?? 0, color: "#2f9d83", configured: true },
    ].map((item) => ({ ...item, percentage: total > 0 ? item.value / total * 100 : 0 }));
  }, [settings, summary]);

  const wasteMaximum = Math.max(1, ...waste.map((item) => item.totalUnits));
  const deviationMaximum = Math.max(1, ...deviations.map((item) => Math.abs(item.additionalCost)));
  const laborDifference = labor ? labor.totalPersonHours - labor.expectedPersonHours : null;
  const laborStatus = laborDifference === null || Math.abs(laborDifference) < .1 ? "neutral" : laborDifference < 0 ? "positive" : "negative";
  const laborHoursLabel = laborDifference === null ? "Sin datos" : laborStatus === "positive" ? `${number(Math.abs(laborDifference))} h ahorradas` : laborStatus === "negative" ? `${number(Math.abs(laborDifference))} h excedidas` : "Dentro del estándar";
  const laborImpactLabel = laborStatus === "positive" ? "Ahorro estimado" : laborStatus === "negative" ? "Costo adicional" : "Sin desvío relevante";
  const laborImpactValue = labor && settings ? money(Math.abs(labor.laborInefficiencyCost)) : "Sin configurar";

  function applyRange(event: FormEvent) {
    event.preventDefault();
    if (!draftRange.from || !draftRange.to) { setError("Completá ambas fechas para analizar el período."); return; }
    if (draftRange.from > draftRange.to) { setError("La fecha desde no puede ser posterior a la fecha hasta."); return; }
    setRange(draftRange); setError("");
  }

  function setPreset(days: number | "month") {
    const now = new Date();
    const from = days === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
    const next = { from: isoDate(from), to: isoDate(now) };
    setDraftRange(next); setRange(next); setError("");
  }

  async function openProduction(id: number) {
    setDrawer("production"); setDrawerLoading(true); setProductionDetail(null); setError("");
    try { setProductionDetail(await getProductionPerformanceApi(id)); }
    catch (detailError) { setError(errorMessage(detailError, "No se pudo cargar el detalle de rendimiento.")); setDrawer(null); }
    finally { setDrawerLoading(false); }
  }

  async function openVariety(id: number) {
    setDrawer("variety"); setDrawerLoading(true); setVarietyDetail(null); setError("");
    try { setVarietyDetail(await getVarietyPerformanceApi(id, range)); }
    catch (detailError) { setError(errorMessage(detailError, "No se pudo cargar el detalle de la variedad.")); setDrawer(null); }
    finally { setDrawerLoading(false); }
  }

  function openSettings() {
    if (settings) setSettingsForm({ labor: String(settings.averageHourlyLaborCost), energy: String(settings.energyPercentage) });
    setDrawer("settings"); setError("");
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const laborCost = Number(settingsForm.labor.replace(",", "."));
    const energy = Number(settingsForm.energy.replace(",", "."));
    if (!settingsForm.labor.trim() || !Number.isFinite(laborCost) || laborCost <= 0 || !hasAtMostTwoDecimals(settingsForm.labor)) { setError("El costo por hora debe ser mayor que cero y admitir hasta 2 decimales."); return; }
    if (!settingsForm.energy.trim() || !Number.isFinite(energy) || energy < 0 || energy > 100 || !hasAtMostTwoDecimals(settingsForm.energy)) { setError("El porcentaje de energía debe estar entre 0 y 100 y admitir hasta 2 decimales."); return; }
    try {
      setSaving(true); setError("");
      const updated = await updateAnalyticsSettingsApi({ averageHourlyLaborCost: laborCost, energyPercentage: energy });
      setSettings(updated); setDrawer(null);
      gooeyToast.success("Configuración actualizada", { description: "Se aplicará a las próximas producciones finalizadas.", timing: TOAST_RAPIDO_TIMING });
    } catch (saveError) { setError(errorMessage(saveError, "No se pudo guardar la configuración.")); }
    finally { setSaving(false); }
  }

  const performance = productionDetail?.performanceStatus ? performanceCopy[productionDetail.performanceStatus] : null;

  return <section className="analytics-page page-transition">
    <header className="analytics-hero">
      <div><p>Producción</p><h2>Costos y rendimiento</h2><span>Entendé cuánto cuesta producir, dónde se pierde eficiencia y qué tandas conviene revisar.</span></div>
      <div className="analytics-hero__actions"><button type="button" onClick={() => void loadDashboard()} disabled={loading} aria-label="Actualizar análisis"><RefreshCw size={16} className={loading ? "analytics-spin" : ""} />Actualizar</button><button type="button" className="is-primary" onClick={openSettings}><Settings2 size={16} />Configurar costos</button></div>
    </header>

    <section className="analytics-filter-card">
      <div><span><CalendarDays size={17} /></span><div><strong>Período analizado</strong><small>Solo incluye producciones finalizadas</small></div></div>
      <form onSubmit={applyRange}><label><small>Desde</small><input type="date" value={draftRange.from} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} /></label><span>—</span><label><small>Hasta</small><input type="date" value={draftRange.to} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} /></label><button type="submit">Aplicar</button></form>
      <div className="analytics-presets"><button type="button" onClick={() => setPreset(30)}>30 días</button><button type="button" onClick={() => setPreset(90)}>90 días</button><button type="button" onClick={() => setPreset("month")}>Este mes</button></div>
    </section>

    {error && <div className="analytics-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Cerrar"><X size={15} /></button></div>}

    {loading && <div className="analytics-loading"><LoaderCircle className="analytics-spin" size={28} /><strong>Calculando costos y rendimiento…</strong><span>Consolidando las producciones finalizadas del período.</span></div>}

    {!loading && summary && <motion.div key={`${range.from}-${range.to}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <PeriodDiagnosis summary={summary} labor={labor} status={laborStatus} hoursLabel={laborHoursLabel} impactLabel={laborImpactLabel} impactValue={laborImpactValue} />

      {!settings && summary.totalProductions > 0 && <section className="analytics-cost-warning"><AlertTriangle size={19} /><div><strong>Costos incompletos</strong><span>Todavía no se configuró el costo de mano de obra y/o energía.</span></div><button type="button" onClick={openSettings}>Configurar costos</button></section>}

      <div className="analytics-kpis">
        <article><span className="red"><CircleDollarSign size={20} /></span><div><small>Costo total de producción</small><strong>{settings ? money(summary.totalProductionCost) : "Costos incompletos"}</strong><p>{summary.totalProductions} producciones finalizadas</p></div></article>
        <article><span className="blue"><PackageCheck size={20} /></span><div><small>Costo promedio por empanada</small><strong>{settings ? money(summary.averageCostPerUnit) : "—"}</strong><p>{number(summary.totalUnitsProduced, 0)} unidades terminadas</p></div></article>
        <article><span className={variationClass(labor?.productivityVariationPercentage)}><Gauge size={20} /></span><div><small>Productividad laboral</small><strong className={variationClass(labor?.productivityVariationPercentage)}>{labor?.productivityVariationPercentage !== null && labor?.productivityVariationPercentage !== undefined ? `${labor.productivityVariationPercentage >= 0 ? "↑" : "↓"} ${number(Math.abs(labor.productivityVariationPercentage))}%` : "—"}</strong><p>{labor?.productivityVariationPercentage === null || labor?.productivityVariationPercentage === undefined ? "Sin información suficiente" : labor.productivityVariationPercentage >= 0 ? "Sobre el estándar" : "Debajo del estándar"}</p></div></article>
        <article><span className={laborStatus}><TrendingDown size={20} /></span><div><small>Impacto de eficiencia</small><strong className={laborStatus}>{laborImpactValue}</strong><p>{laborImpactLabel}</p></div></article>
      </div>

      <LaborImpactCard labor={labor} status={laborStatus} hoursLabel={laborHoursLabel} impactLabel={laborImpactLabel} impactValue={laborImpactValue} />

      <div className="analytics-feature-grid">
        <section className="analytics-card analytics-cost-card"><header><div><span><CircleDollarSign size={18} /></span><div><h3>Composición del costo real</h3><p>Todos los componentes de costo del período.</p></div></div><strong>{settings ? money(summary.totalProductionCost) : "Costos incompletos"}</strong></header><div className="analytics-cost-body"><div className="analytics-donut" style={{ background: `conic-gradient(${costParts.map((part, index) => `${part.color} ${costParts.slice(0, index).reduce((sum, current) => sum + current.percentage, 0)}% ${costParts.slice(0, index + 1).reduce((sum, current) => sum + current.percentage, 0)}%`).join(",")})` }}><div><strong>{summary.totalProductions}</strong><span>tandas</span></div></div><div className="analytics-cost-legend">{costParts.map((part) => <div key={part.label} className={!part.configured ? "is-unconfigured" : ""}><i style={{ background: part.color }} /><span><strong>{part.label}</strong><small>{part.configured ? `${number(part.percentage)}% del costo` : "Sin configurar"}</small></span><b>{part.configured ? money(part.value) : "—"}</b></div>)}</div></div><footer><span>Merma estimada <strong>{money(summary.totalEstimatedWasteCost)}</strong></span><small>Informativa: ya está contenida en el costo de producción.</small></footer></section>

        <LaborCard labor={labor} status={laborStatus} hoursLabel={laborHoursLabel} impactLabel={laborImpactLabel} impactValue={laborImpactValue} />
      </div>

      <section className="analytics-card analytics-varieties"><header><div><span><Factory size={18} /></span><div><h3>Rendimiento por variedad</h3><p>Compará volumen, costo unitario y productividad laboral para decidir dónde actuar.</p></div></div><strong>{varieties.length} variedades</strong></header>{varieties.length ? <div className="analytics-table"><table><thead><tr><th>Variedad</th><th>Producciones</th><th>Unidades</th><th>Costo por unidad</th><th>Productividad laboral</th><th>Impacto económico</th><th /></tr></thead><tbody>{varieties.map((item, index) => <motion.tr key={item.varietyId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .035 }} onClick={() => void openVariety(item.varietyId)}><td data-label="Variedad"><img src={getVarietyImage(item.varietyId)} alt="" /><strong>{item.varietyName}</strong></td><td data-label="Producciones">{item.productionCount}</td><td data-label="Unidades">{number(item.totalUnitsProduced, 0)}</td><td data-label="Costo por unidad"><strong>{settings ? money(item.averageCostPerUnit) : "—"}</strong></td><td data-label="Productividad laboral"><span className={`analytics-variation ${variationClass(item.averageLaborProductivityVariation)}`}>{variationLabel(item.averageLaborProductivityVariation)}</span></td><td data-label="Impacto económico" className={item.laborInefficiencyCost > 0 ? "negative" : "positive"}>{settings ? money(item.laborInefficiencyCost) : "Sin configurar"}</td><td><ChevronRight size={16} /></td></motion.tr>)}</tbody></table></div> : <EmptyState text="No hay producciones finalizadas suficientes para analizar este período." />}</section>

      <div className="analytics-ranking-grid"><RankingCard title="Producciones a revisar" subtitle="¿Dónde deberíamos investigar primero?" icon={<AlertTriangle size={18} />} items={worst} details={rankingDetails} kind="worst" costsConfigured={Boolean(settings)} onOpen={openProduction} /><RankingCard title="Mejores producciones" subtitle="Tandas con mejor productividad laboral" icon={<TrendingUp size={18} />} items={best} details={rankingDetails} kind="best" costsConfigured={Boolean(settings)} onOpen={openProduction} /></div>

      <div className="analytics-bottom-grid">
        <section className="analytics-card analytics-deviations"><header><div><span><Wheat size={18} /></span><div><h3>Desvíos de ingredientes</h3><p>Consumo real comparado con la receta congelada.</p></div></div><strong>{deviations.length}</strong></header>{deviations.length ? <div className="analytics-deviation-list">{deviations.map((item, index) => <motion.article key={item.ingredientId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}><div><span><Wheat size={15} /></span><div><strong>{item.ingredientName}</strong><small>{formatMeasurement(item.totalExpectedQuantity, item.measurementUnit)} esperados · {formatMeasurement(item.totalActualQuantity, item.measurementUnit)} reales</small></div></div><div className="analytics-deviation-track"><i className={item.additionalCost > 0 ? "negative" : "positive"} style={{ width: `${Math.max(4, Math.abs(item.additionalCost) / deviationMaximum * 100)}%` }} /></div><span className={item.additionalCost > 0 ? "negative" : "positive"}>{item.differenceQuantity > 0 ? "+" : ""}{formatMeasurement(item.differenceQuantity, item.measurementUnit)}<br /><strong>{item.additionalCost > 0 ? "+" : ""}{money(item.additionalCost)}</strong></span></motion.article>)}</div> : <EmptyState text="No hubo desvíos de ingredientes en el período." />}</section>

        <section className="analytics-card analytics-waste"><header><div><span><Leaf size={18} /></span><div><h3>Motivos de merma</h3><p>Participación y costo estimado de las unidades perdidas.</p></div></div><strong>{summary.totalWasteUnits} u.</strong></header>{waste.length ? <div className="analytics-waste-list">{waste.map((item, index) => <motion.article key={`${item.reason}-${index}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .04 }}><div><strong>{item.reason}</strong><small>{item.totalUnits} unidades · {number(item.percentage)}%</small></div><div><i style={{ width: `${Math.max(4, item.totalUnits / wasteMaximum * 100)}%` }} /></div><b>{money(item.estimatedCost)}</b></motion.article>)}</div> : <EmptyState text="No se registraron unidades de merma en el período." />}</section>
      </div>
    </motion.div>}

    {createPortal(<AnimatePresence>{drawer && <motion.div className="analytics-drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button type="button" className="analytics-drawer__backdrop" aria-label="Cerrar panel" onClick={() => setDrawer(null)} /><motion.aside className="analytics-drawer__panel" initial={{ x: 70 }} animate={{ x: 0 }} exit={{ x: 70 }} transition={{ type: "spring", stiffness: 330, damping: 31 }} aria-label={drawer === "settings" ? "Configuración de costos" : "Detalle de rendimiento"}><header><div><p>{drawer === "settings" ? "Configuración" : drawer === "variety" ? "Análisis por variedad" : "Producción finalizada"}</p><h3>{drawer === "settings" ? "Costos de producción" : drawer === "variety" ? varietyDetail?.varietyName ?? "Cargando…" : productionDetail ? `${productionDetail.varietyName} · #${productionDetail.productionId}` : "Cargando…"}</h3></div><button type="button" onClick={() => setDrawer(null)} aria-label="Cerrar"><X size={20} /></button></header><div className="analytics-drawer__body">{drawerLoading && <div className="analytics-drawer-loading"><LoaderCircle className="analytics-spin" size={27} />Cargando análisis…</div>}{drawer === "settings" && !drawerLoading && <SettingsPanel form={settingsForm} setForm={setSettingsForm} settings={settings} saving={saving} onSubmit={saveSettings} error={error} />}{drawer === "production" && productionDetail && <ProductionDetail detail={productionDetail} performance={performance} />}{drawer === "variety" && varietyDetail && <VarietyDetail detail={varietyDetail} />}</div></motion.aside></motion.div>}</AnimatePresence>, document.body)}
  </section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="analytics-empty"><span><Factory size={24} /></span><strong>Sin datos para mostrar</strong><p>{text}</p></div>;
}

function PeriodDiagnosis({ summary, labor, status, hoursLabel, impactLabel, impactValue }: { summary: ProductionSummary; labor: LaborSummary | null; status: LaborStatus; hoursLabel: string; impactLabel: string; impactValue: string }) {
  if (!summary.totalProductions) return <section className="analytics-diagnosis neutral"><span><Factory size={24} /></span><div><small>Diagnóstico del período</small><h3>Sin producciones para analizar</h3><p>No hay producciones finalizadas suficientes para analizar este período.</p></div></section>;
  if (!labor || labor.productivityVariationPercentage === null) return <section className="analytics-diagnosis neutral"><span><Info size={24} /></span><div><small>Diagnóstico del período</small><h3>Información insuficiente</h3><p>No se puede comparar la productividad porque faltan tiempos, personas o procesos estándar.</p></div></section>;
  const title = status === "positive" ? "Producción eficiente" : status === "negative" ? "Baja eficiencia productiva" : "Producción dentro del estándar";
  const description = status === "positive" ? `Para el volumen producido se utilizaron ${number(Math.abs(labor.totalPersonHours - labor.expectedPersonHours))} horas-persona menos de las esperadas.` : status === "negative" ? `Se utilizaron ${number(Math.abs(labor.totalPersonHours - labor.expectedPersonHours))} horas-persona más de las esperadas para el volumen producido.` : "El rendimiento del período se mantuvo dentro de los valores esperados.";
  return <section className={`analytics-diagnosis ${status}`}><span>{status === "positive" ? <TrendingUp size={24} /> : status === "negative" ? <TrendingDown size={24} /> : <Gauge size={24} />}</span><div><small>Diagnóstico del período</small><h3>{title}</h3><p>{description}</p></div><div className="analytics-diagnosis__impact"><small>{impactLabel}</small><strong>{impactValue}</strong><span>{hoursLabel}</span></div></section>;
}

function LaborImpactCard({ labor, status, hoursLabel, impactLabel, impactValue }: { labor: LaborSummary | null; status: LaborStatus; hoursLabel: string; impactLabel: string; impactValue: string }) {
  return <section className={`analytics-labor-impact ${status}`}><header><span><UsersRound size={20} /></span><div><small>Hipótesis del negocio</small><h3>Impacto de eficiencia laboral</h3><p>¿Se están pagando más horas que las necesarias para el volumen producido?</p></div></header>{labor ? <div className="analytics-labor-impact__body"><article><small>Horas esperadas</small><strong>{number(labor.expectedPersonHours)} h</strong></article><article><small>Horas reales</small><strong>{number(labor.totalPersonHours)} h</strong></article><article className="result"><small>Resultado</small><strong>{hoursLabel}</strong></article><article className="money"><small>{impactLabel}</small><strong>{impactValue}</strong></article></div> : <p className="analytics-inline-empty">No hay información suficiente para calcular el impacto laboral.</p>}</section>;
}

function PersonHourTooltip() {
  return <span className="analytics-tooltip"><button type="button" aria-label="¿Qué significa empanadas por hora-persona?"><Info size={13} /></button><span role="tooltip"><strong>Empanadas por hora-persona</strong>Cantidad producida por cada hora de trabajo de una persona.<em>Ejemplo: 2 personas durante 3 horas suman 6 horas-persona. Si producen 300 empanadas, el resultado es 50 emp/h-persona.</em></span></span>;
}

function LaborCard({ labor, status, hoursLabel, impactLabel, impactValue }: { labor: LaborSummary | null; status: LaborStatus; hoursLabel: string; impactLabel: string; impactValue: string }) {
  return <section className="analytics-card analytics-labor-card"><header><div><span><UsersRound size={18} /></span><div><h3>Mano de obra</h3><p>Horas y producción real frente a lo esperado.</p></div></div>{labor?.productivityVariationPercentage !== null && labor?.productivityVariationPercentage !== undefined && <b className={variationClass(labor.productivityVariationPercentage)}>{variationLabel(labor.productivityVariationPercentage)}</b>}</header>{labor ? <div className="analytics-labor-body analytics-labor-body--semantic"><div className="analytics-labor-pair"><article><span>Horas-persona esperadas</span><strong>{number(labor.expectedPersonHours)} h</strong></article><article><span>Horas-persona reales</span><strong>{number(labor.totalPersonHours)} h</strong></article></div><div className={`analytics-labor-result ${status}`}><small>Resultado de horas</small><strong>{hoursLabel}</strong></div><div className="analytics-labor-pair"><article><span>Productividad estándar <PersonHourTooltip /></span><strong>{number(labor.standardUnitsPerPersonHour)} emp/h-persona</strong></article><article><span>Productividad real <PersonHourTooltip /></span><strong>{number(labor.averageUnitsPerPersonHour)} emp/h-persona</strong></article></div>{labor.productivityVariationPercentage !== null ? <div className={`analytics-labor-result ${variationClass(labor.productivityVariationPercentage)}`}><small>Productividad laboral global vs estándar</small><strong>{labor.productivityVariationPercentage >= 0 ? "↑" : "↓"} {number(Math.abs(labor.productivityVariationPercentage))}% {labor.productivityVariationPercentage >= 0 ? "más eficientes" : "menos eficientes"}</strong></div> : <div className="analytics-inline-empty">No se puede comparar productividad porque no existe información suficiente o un proceso estándar.</div>}<div className="analytics-labor-costs"><article><small>Costo laboral esperado</small><strong>{money(labor.expectedLaborCost)}</strong></article><article><small>Costo laboral real</small><strong>{money(labor.actualLaborCost)}</strong></article></div><div className={`analytics-labor-money ${status}`}><small>{impactLabel}</small><strong>{impactValue}</strong></div></div> : <EmptyState text="No hay información suficiente para analizar la mano de obra." />}</section>;
}

function RankingCard({ title, subtitle, icon, items, details, kind, costsConfigured, onOpen }: { title: string; subtitle: string; icon: React.ReactNode; items: ProductionRanking[]; details: Record<number, ProductionPerformance>; kind: "best" | "worst"; costsConfigured: boolean; onOpen: (id: number) => Promise<void> }) {
  return <section className={`analytics-card analytics-ranking analytics-ranking--${kind}`}><header><div><span>{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div><small>Top {items.length}</small></header>{items.length ? <div>{items.map((item, index) => {
    const detail = details[item.productionId];
    const hoursDifference = detail?.actualPersonHours !== null && detail?.actualPersonHours !== undefined && detail?.expectedPersonHoursForActualOutput !== null && detail?.expectedPersonHoursForActualOutput !== undefined ? detail.actualPersonHours - detail.expectedPersonHoursForActualOutput : null;
    const hoursText = hoursDifference === null ? "Horas sin información" : Math.abs(hoursDifference) < .1 ? "Horas dentro del estándar" : hoursDifference < 0 ? `${number(Math.abs(hoursDifference))} h ahorradas` : `${number(Math.abs(hoursDifference))} h excedidas`;
    const impactText = !costsConfigured ? "Impacto sin configurar" : item.laborInefficiencyCost < 0 ? `Ahorro: ${money(Math.abs(item.laborInefficiencyCost))}` : `Costo adicional: ${money(item.laborInefficiencyCost)}`;
    return <motion.button type="button" key={item.productionId} onClick={() => void onOpen(item.productionId)} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}><i>{index + 1}</i><span><strong>{item.varietyName} <em>#{item.productionId}</em></strong><small>{dateLabel(item.productionDate)} · {item.finalUnits} unidades</small></span><div className="analytics-ranking__facts"><b className={variationClass(item.productivityVariationPercentage)}>{item.productivityVariationPercentage !== null ? `${item.productivityVariationPercentage >= 0 ? "↑" : "↓"} ${number(Math.abs(item.productivityVariationPercentage))}% productividad` : "Productividad sin datos"}</b><small className={hoursDifference !== null ? variationClass(-hoursDifference) : "neutral"}>{hoursText}</small><strong className={item.laborInefficiencyCost <= 0 ? "positive" : "negative"}>{impactText}</strong></div><ChevronRight size={15} /></motion.button>;
  })}</div> : <EmptyState text="No hay producciones para construir este ranking." />}</section>;
}

function SettingsPanel({ form, setForm, settings, saving, onSubmit, error }: { form: { labor: string; energy: string }; setForm: React.Dispatch<React.SetStateAction<{ labor: string; energy: string }>>; settings: AnalyticsSettings | null; saving: boolean; onSubmit: (event: FormEvent) => Promise<void>; error: string }) {
  return <form className="analytics-settings" onSubmit={onSubmit}><div className="analytics-info"><Sparkles size={20} /><div><strong>Snapshots históricos</strong><span>Estos valores se guardan al finalizar cada producción. Los cambios solo afectan a las próximas tandas.</span></div></div><label><span>Costo promedio por hora-persona</span><div><strong>$</strong><input inputMode="decimal" value={form.labor} onChange={(event) => setForm((current) => ({ ...current, labor: event.target.value }))} /></div><small>Incluí sueldo, cargas y costos laborales promedio.</small></label><label><span>Energía sobre ingredientes y mano de obra</span><div><input inputMode="decimal" value={form.energy} onChange={(event) => setForm((current) => ({ ...current, energy: event.target.value }))} /><strong>%</strong></div><small>Estimación proporcional de gas y electricidad.</small></label>{settings?.updatedAt && <p><Clock3 size={14} />Última actualización: {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updatedAt))}</p>}{error && <div className="analytics-error"><AlertTriangle size={16} /><span>{error}</span></div>}<footer><button type="submit" disabled={saving}>{saving ? <LoaderCircle className="analytics-spin" size={16} /> : <Save size={16} />}Guardar configuración</button></footer></form>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <article className={tone ?? ""}><small>{label}</small><strong>{value}</strong></article>;
}

function ProductionDetail({ detail, performance }: { detail: ProductionPerformance; performance: { label: string; tone: string } | null }) {
  const missingProcess = detail.standardUnitsPerPersonHour === null;
  const missingLabor = detail.actualPersonHours === null || detail.actualUnitsPerPersonHour === null;
  const missingCosts = detail.actualLaborCost === null || detail.energyCost === null || detail.actualTotalCost === null;
  const hoursDifference = detail.actualPersonHours !== null && detail.expectedPersonHoursForActualOutput !== null ? detail.actualPersonHours - detail.expectedPersonHoursForActualOutput : null;
  const hoursText = hoursDifference === null ? "—" : Math.abs(hoursDifference) < .1 ? "Dentro del estándar" : hoursDifference < 0 ? `${number(Math.abs(hoursDifference))} h ahorradas` : `${number(Math.abs(hoursDifference))} h excedidas`;
  return <div className="analytics-detail">
    <div className="analytics-detail-hero"><img src={getVarietyImage(detail.varietyId)} alt={`Empanadas de ${detail.varietyName}`} /><div><span className={`analytics-performance ${performance?.tone ?? "neutral"}`}>{performance?.label ?? "Sin referencia"}</span><h4>{detail.varietyName}</h4><p>Producción #{detail.productionId} · {dateLabel(detail.productionDate)}</p></div></div>
    <div className="analytics-detail-kpis"><Metric label="Costo real" value={money(detail.actualTotalCost)} /><Metric label="Costo por empanada" value={money(detail.actualCostPerUnit)} /><Metric label="Unidades finales" value={`${detail.finalUnits} u.`} /><Metric label="Merma" value={`${detail.wasteUnits} u. · ${number(detail.wastePercentage)}%`} /></div>
    {missingCosts && <div className="analytics-detail-alert"><AlertTriangle size={16} /><span><strong>Costos incompletos</strong>Configurá los costos para convertir los desvíos de productividad en impacto económico.</span></div>}
    <section><header><CircleDollarSign size={17} /><div><h5>Construcción del costo</h5><p>Comparación entre estándar y resultado real.</p></div></header><div className="analytics-detail-rows"><div><span>Ingredientes</span><small>{money(detail.expectedIngredientCost)}</small><strong>{money(detail.actualIngredientCost)}</strong><b className={variationClass(-detail.ingredientCostDeviation)}>{detail.ingredientCostDeviation > 0 ? "+" : ""}{money(detail.ingredientCostDeviation)}</b></div><div><span>Mano de obra</span><small>{money(detail.expectedLaborCostForActualOutput)}</small><strong>{money(detail.actualLaborCost)}</strong><b className={variationClass(-(detail.laborInefficiencyCost ?? 0))}>{money(detail.laborInefficiencyCost)}</b></div><div><span>Packaging</span><small>{money(detail.expectedPackagingCost)}</small><strong>{money(detail.actualPackagingCost)}</strong><b className={variationClass(-(detail.packagingCostDeviation ?? 0))}>{money(detail.packagingCostDeviation)}</b></div><div><span>Otros adicionales</span><small>{money(detail.expectedOtherAdditionalCost)}</small><strong>{money(detail.actualOtherAdditionalCost)}</strong><b className={variationClass(-(detail.otherAdditionalCostDeviation ?? 0))}>{money(detail.otherAdditionalCostDeviation)}</b></div><div><span>Energía</span><small>{money(detail.expectedEnergyCost)}</small><strong>{money(detail.energyCost)}</strong><b className={variationClass(-(detail.energyCostDeviation ?? 0))}>{money(detail.energyCostDeviation)}</b></div><div className="total"><span>Total</span><small>{money(detail.standardTotalCost)}</small><strong>{money(detail.actualTotalCost)}</strong><b className={variationClass(-(detail.totalCostDeviation ?? 0))}>{money(detail.totalCostDeviation)}</b></div></div><footer><span /><small>Estándar</small><strong>Real</strong><b>Desvío</b></footer></section>
    <section><header><Gauge size={17} /><div><h5>Productividad laboral</h5><p>Resultado por cada hora de trabajo de una persona.</p></div></header>{missingProcess ? <div className="analytics-inline-empty">No se puede comparar productividad porque esta variedad no posee un proceso estándar.</div> : missingLabor ? <div className="analytics-inline-empty">Esta producción no posee información suficiente para calcular productividad laboral.</div> : <div className="analytics-detail-grid"><Metric label="Horas-persona esperadas" value={`${number(detail.expectedPersonHoursForActualOutput)} h`} /><Metric label="Horas-persona reales" value={`${number(detail.actualPersonHours)} h`} /><Metric label="Resultado de horas" value={hoursText} tone={hoursDifference !== null ? variationClass(-hoursDifference) : "neutral"} /><Metric label="Estándar emp/h-persona" value={number(detail.standardUnitsPerPersonHour)} /><Metric label="Real emp/h-persona" value={number(detail.actualUnitsPerPersonHour)} /><Metric label="Productividad laboral vs estándar" value={variationLabel(detail.laborProductivityVariationPercentage)} tone={variationClass(detail.laborProductivityVariationPercentage)} /></div>}</section>
    {detail.productivityVariationPercentage !== null && <div className="analytics-detail-explanation"><Info size={15} /><span><strong>Ritmo total de la tanda: {variationLabel(detail.productivityVariationPercentage)}</strong>Este indicador compara empanadas por hora de reloj. La métrica principal del dashboard es la productividad laboral por hora-persona.</span></div>}
    <div className="analytics-detail-note"><Leaf size={17} /><span><strong>Merma estimada: {money(detail.estimatedWasteCost)}</strong>Este valor es informativo y ya está contenido en el costo total.</span></div>
  </div>;
}

function VarietyDetail({ detail }: { detail: VarietyPerformance }) {
  return <div className="analytics-detail"><div className="analytics-detail-hero"><img src={getVarietyImage(detail.varietyId)} alt={`Empanadas de ${detail.varietyName}`} /><div><span className="analytics-performance normal">Período seleccionado</span><h4>{detail.varietyName}</h4><p>{detail.productionCount} producciones · {number(detail.totalUnitsProduced, 0)} unidades</p></div></div><div className="analytics-detail-kpis"><Metric label="Costo total" value={money(detail.totalProductionCost)} /><Metric label="Costo por empanada" value={money(detail.averageCostPerUnit)} /><Metric label="Merma promedio" value={`${number(detail.averageWastePercentage)}%`} /><Metric label="Productividad laboral vs estándar" value={variationLabel(detail.averageLaborProductivityVariation)} tone={variationClass(detail.averageLaborProductivityVariation)} /></div><section><header><Factory size={17} /><div><h5>Resultado consolidado</h5><p>Costos y productividad de todas las tandas finalizadas.</p></div></header><div className="analytics-detail-grid"><Metric label="Ingredientes" value={money(detail.totalIngredientCost)} /><Metric label="Mano de obra" value={money(detail.totalLaborCost)} /><Metric label="Packaging" value={money(detail.totalPackagingCost)} /><Metric label="Otros adicionales" value={money(detail.totalOtherAdditionalCost)} /><Metric label="Energía" value={money(detail.totalEnergyCost)} /><Metric label="Impacto de eficiencia laboral" value={money(detail.laborInefficiencyCost)} tone={detail.laborInefficiencyCost > 0 ? "negative" : "positive"} /><Metric label="Desvío total de costos" value={money(detail.totalCostDeviation)} tone={detail.totalCostDeviation > 0 ? "negative" : "positive"} /><Metric label="Ritmo de producción por hora" value={number(detail.averageUnitsPerHour)} /><Metric label="Empanadas por hora-persona" value={number(detail.averageUnitsPerPersonHour)} /></div></section></div>;
}
