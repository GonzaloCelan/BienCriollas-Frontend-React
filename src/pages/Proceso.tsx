import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig, Reorder, useDragControls } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpRight, CheckCheck, ChevronDown, Clock3, GripVertical, Hand, History, Hourglass, Layers3, Lightbulb, LoaderCircle, Pencil, Plus, RefreshCw, RotateCcw, Save, Scale, Trash2, Users, Wheat } from "lucide-react";
import { useCatalogo } from "../context/useCatalogo";
import RecipeCarousel from "../features/procesos/RecipeCarousel";
import ProcessHistory from "../features/procesos/ProcessHistory";
import StepEditor from "../features/procesos/StepEditor";
import { draftFromProcess, emptyProcess, formatMinutes, processPayload, summarizeProcess, validateProcess } from "../features/procesos/model";
import type { ProcessDraft, ProcessStep } from "../features/procesos/model";
import { getVarietyImage } from "../features/procesos/recipes";
import { ApiError } from "../services/httpClient";
import { crearProcesoApi, crearVersionProcesoApi, listarProcesosApi, obtenerHistorialProcesoApi } from "../services/procesosApi";
import type { Proceso } from "../services/procesosApi";
import "../styles/proceso.css";

const ease = [0.22, 1, 0.36, 1] as const;
const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const sameDraft = (left: ProcessDraft, right: ProcessDraft) => JSON.stringify(processPayload(left)) === JSON.stringify(processPayload(right));
const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;

function StepCard({ step, index, count, start, onEdit, onDelete, onMove }: { step: ProcessStep; index: number; count: number; start: number; onEdit: () => void; onDelete: () => void; onMove: (direction: number) => void }) {
  const controls = useDragControls();
  const [expanded, setExpanded] = useState(true);
  const waiting = step.kind === "WAITING";
  const stepDelay = Math.min(index * .11, 1.1);
  return <Reorder.Item value={step} dragListener={false} dragControls={controls} className={`sp-step-item ${waiting ? "is-waiting" : ""}`} layout="position" initial={{ opacity: 0, x: -22, y: 28, scale: .975 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, x: 28, scale: .97, height: 0, marginBottom: 0 }} transition={{ type: "spring", stiffness: 235, damping: 25, mass: .78, delay: stepDelay, layout: { type: "spring", stiffness: 320, damping: 30 } }} whileDrag={{ scale: 1.025, zIndex: 20, boxShadow: "0 24px 55px #25324425" }}>
    <div className="sp-timeline-rail"><motion.span className="sp-step-number" initial={{ opacity: 0, scale: .25, rotate: -35 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 330, damping: 20, delay: stepDelay + .08 }}>{String(index + 1).padStart(2, "0")}</motion.span><span className="sp-step-connector"><motion.i initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: stepDelay + .24, duration: .7, ease }} /></span></div>
    <motion.article className="sp-step-card" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .42, delay: stepDelay + .07, ease }}>
      <header><span className={`sp-kind ${waiting ? "wait" : "active"}`}>{waiting ? <Hourglass size={11} /> : <Hand size={11} />}{waiting ? "ESPERA" : "ACTIVO"}</span><span className="sp-step-range">{formatMinutes(start)} <span>—</span> {formatMinutes(start + step.minutes)}</span><div className="sp-step-tools"><button className="sp-icon" onClick={onEdit} aria-label={`Editar ${step.name}`} title="Editar paso"><Pencil size={14} /></button><button className="sp-icon sp-delete" onClick={onDelete} aria-label={`Eliminar ${step.name}`} title="Quitar de la nueva versión"><Trash2 size={14} /></button><button className="sp-icon sp-drag" onPointerDown={event => controls.start(event)} aria-label={`Arrastrar ${step.name}; usá las flechas para reordenar`} title="Arrastrar para reordenar"><GripVertical size={17} /></button></div></header>
      <button className="sp-step-title" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><h3>{step.name}</h3><motion.span animate={{ rotate: expanded ? 180 : 0 }}><ChevronDown size={17} /></motion.span></button>
      <AnimatePresence initial={false}>{expanded && <motion.div className="sp-step-description" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{step.description && <p>{step.description}</p>}{step.notes && <div className="sp-step-note"><Lightbulb size={14} /><span>{step.notes}</span></div>}</motion.div>}</AnimatePresence>
      <footer><div><span><Clock3 size={14} /><strong>{step.minutes}</strong> min</span><span><Users size={14} /><strong>{step.people}</strong> {step.people === 1 ? "persona" : "personas"}</span><span className="sp-step-work">{number.format(step.minutes * step.people / 60)} h-p</span></div><div className="sp-step-move"><button className="sp-icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir ${step.name}`} title="Mover arriba"><ArrowUp size={13} /></button><button className="sp-icon" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Bajar ${step.name}`} title="Mover abajo"><ArrowDown size={13} /></button></div></footer>
    </motion.article>
  </Reorder.Item>;
}

export default function ProcesoPage() {
  const { catalogo, catalogoLoading, catalogoError, recargarCatalogo } = useCatalogo();
  const [processes, setProcesses] = useState<Proceso[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ProcessDraft>>({});
  const [varietyId, setVarietyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ step: ProcessStep | null; order: number } | null>(null);
  const [undo, setUndo] = useState<{ varietyId: number; step: ProcessStep; index: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Proceso[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const page = await listarProcesosApi();
      setProcesses(page.content);
      setDrafts(Object.fromEntries(page.content.map(item => [item.varietyId, draftFromProcess(item)])));
    } catch (loadError) { setError(errorMessage(loadError, "No se pudieron cargar los procesos.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timer); }, [notice]);

  const recipeItems = useMemo(() => catalogo.map(item => {
    const backend = processes.find(process => process.varietyId === item.id_variedad);
    return { id: item.id_variedad, name: item.nombre, image: getVarietyImage(item.id_variedad), detail: backend ? `Proceso v${backend.version} · ${backend.stepCount} ${backend.stepCount === 1 ? "paso" : "pasos"}` : "Sin proceso definido" };
  }), [catalogo, processes]);
  const selectedVarietyId = varietyId ?? catalogo[0]?.id_variedad ?? null;
  const backendProcess = processes.find(item => item.varietyId === selectedVarietyId) ?? null;
  const selectedCatalog = catalogo.find(item => item.id_variedad === selectedVarietyId) ?? null;
  const baseDraft = selectedCatalog ? backendProcess ? draftFromProcess(backendProcess) : emptyProcess(selectedCatalog.id_variedad, selectedCatalog.nombre) : null;
  const process = selectedVarietyId !== null ? drafts[selectedVarietyId] ?? baseDraft : null;
  const dirty = Boolean(process && baseDraft && !sameDraft(process, baseDraft));
  const dirtyIds = Object.entries(drafts).filter(([id, draft]) => {
    const catalogItem = catalogo.find(item => item.id_variedad === Number(id));
    const backend = processes.find(item => item.varietyId === Number(id));
    return catalogItem && !sameDraft(draft, backend ? draftFromProcess(backend) : emptyProcess(Number(id), catalogItem.nombre));
  }).map(([id]) => Number(id));

  function changeProcess(next: ProcessDraft) { setDrafts(current => ({ ...current, [next.varietyId]: next })); }
  function selectRecipe(id: number) { setVarietyId(id); setUndo(null); setError(""); }
  function submitStep(step: ProcessStep, order: number) {
    if (!process) return;
    const steps = process.steps.filter(item => item.id !== step.id); steps.splice(order - 1, 0, step);
    changeProcess({ ...process, steps }); setEditor(null); setNotice(editor?.step ? "Paso actualizado. Al guardar se creará una nueva versión." : "Paso agregado. Guardá el proceso para enviarlo al backend.");
  }
  function moveStep(index: number, direction: number) {
    if (!process) return;
    const steps = [...process.steps]; const [item] = steps.splice(index, 1); steps.splice(index + direction, 0, item);
    changeProcess({ ...process, steps }); setNotice(`${item.name}: paso ${index + direction + 1}. Al guardar se versionará el proceso.`);
  }
  function deleteStep(step: ProcessStep, index: number) {
    if (!process || selectedVarietyId === null) return;
    setUndo({ varietyId: selectedVarietyId, step, index }); changeProcess({ ...process, steps: process.steps.filter(item => item.id !== step.id) }); setNotice(`Se quitó “${step.name}” de la próxima versión.`);
  }
  function undoDelete() {
    if (!undo) return;
    setDrafts(current => { const target = current[undo.varietyId] ?? (undo.varietyId === selectedVarietyId ? process : null); if (!target || target.steps.some(item => item.id === undo.step.id)) return current; const steps = [...target.steps]; steps.splice(undo.index, 0, undo.step); return { ...current, [undo.varietyId]: { ...target, steps } }; });
    setUndo(null); setNotice("Paso restaurado.");
  }
  async function saveProcess() {
    if (!process) return;
    const validation = validateProcess(process);
    if (validation) { setError(validation); return; }
    try {
      setSaving(true); setError("");
      const payload = processPayload(process);
      const savedProcess = backendProcess
        ? await crearVersionProcesoApi(backendProcess.id, { referenceYieldUnits: payload.referenceYieldUnits, notes: payload.notes, steps: payload.steps })
        : await crearProcesoApi(payload);
      setProcesses(current => [...current.filter(item => item.varietyId !== savedProcess.varietyId), savedProcess]);
      setDrafts(current => ({ ...current, [savedProcess.varietyId]: draftFromProcess(savedProcess) }));
      setUndo(null); setNotice(backendProcess ? `Versión ${savedProcess.version} creada y marcada como vigente.` : `Proceso versión 1 creado para ${savedProcess.varietyName}.`);
    } catch (saveError) { setError(errorMessage(saveError, "No se pudo guardar el proceso.")); }
    finally { setSaving(false); }
  }
  async function openHistory() {
    if (!selectedCatalog || !backendProcess) return;
    setHistoryOpen(true); setHistoryLoading(true); setHistoryError(""); setHistory([]);
    try { setHistory(await obtenerHistorialProcesoApi(selectedCatalog.id_variedad)); }
    catch (historyLoadError) { setHistoryError(errorMessage(historyLoadError, "No se pudo cargar el historial.")); }
    finally { setHistoryLoading(false); }
  }

  if ((loading || catalogoLoading) && !process) return <section className="standard-process-page"><div className="sp-page-state"><LoaderCircle className="sp-spin" size={28} /><h2>Cargando procesos…</h2><p>Estamos consultando las variedades y sus versiones vigentes.</p></div></section>;
  if (!selectedCatalog || !process || !baseDraft) return <section className="standard-process-page"><div className="sp-page-state"><AlertTriangle size={28} /><h2>No pudimos mostrar los procesos</h2><p>{error || catalogoError || "No hay variedades activas disponibles."}</p><button className="sp-button sp-button-primary" onClick={() => void Promise.all([loadData(), recargarCatalogo()])}><RefreshCw size={15} />Reintentar</button></div></section>;

  const previewSummary = summarizeProcess(process);
  const summary = !dirty && backendProcess ? { total: backendProcess.totalEstimatedMinutes, active: backendProcess.activeMinutes, waiting: backendProcess.waitingMinutes, personMinutes: backendProcess.estimatedPersonMinutes, personHours: backendProcess.estimatedPersonHours } : previewSummary;
  const metrics = [{ label: "Rendimiento base", value: process.referenceYieldUnits ? String(process.referenceYieldUnits) : "—", unit: "empanadas", icon: Scale }, { label: "Pasos definidos", value: String(process.steps.length), unit: "en secuencia", icon: Layers3 }, { label: "Tiempo total", value: formatMinutes(summary.total), unit: "duración estimada", icon: Clock3 }, { label: "Tiempo activo", value: formatMinutes(summary.active), unit: "de elaboración", icon: Hand }, { label: "Tiempo de espera", value: formatMinutes(summary.waiting), unit: "sin avance activo", icon: Hourglass }, { label: "Horas-persona", value: number.format(summary.personHours), unit: "horas de trabajo", icon: Users }];

  return <MotionConfig reducedMotion="never"><section className="standard-process-page">
    <motion.header className="sp-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, ease }}><div><p className="sp-eyebrow">PRODUCCIÓN / EL MÉTODO DE LA CASA</p><h2>Procesos<span>.</span></h2><p>Definí cómo se elabora cada receta, paso a paso.</p></div><div className="sp-hero-actions">{backendProcess && <button className="sp-button" onClick={() => void openHistory()}><History size={15} />Historial</button>}<button className="sp-icon sp-refresh" onClick={() => void loadData()} disabled={loading} aria-label="Actualizar procesos" title="Actualizar procesos"><RefreshCw className={loading ? "sp-spin" : ""} size={16} /></button></div></motion.header>
    <RecipeCarousel recipes={recipeItems} selectedId={selectedVarietyId} dirtyIds={dirtyIds} onSelect={selectRecipe} />
    {(error || catalogoError) && <div className="sp-api-error" role="alert"><AlertTriangle size={16} /><span>{error || catalogoError}</span><button className="sp-icon" onClick={() => setError("")} aria-label="Cerrar mensaje"><ChevronDown size={15} /></button></div>}

    <AnimatePresence mode="wait"><motion.div key={selectedVarietyId} initial={{ opacity: 0, y: 12, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(3px)" }} transition={{ duration: .23, ease }}>
      <section className="sp-process-config"><div><span className={`sp-version-chip ${backendProcess ? "active" : "new"}`}>{backendProcess ? `VIGENTE · VERSIÓN ${backendProcess.version}` : "NUEVO PROCESO"}</span><strong>{selectedCatalog.nombre}</strong><small>{backendProcess ? `Actualizado ${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(backendProcess.updatedAt))}` : "Esta variedad todavía no tiene un proceso vigente."}</small></div><label><span>Rendimiento de referencia</span><div className="sp-config-yield"><input type="number" min="1" step="1" value={process.referenceYieldUnits || ""} onChange={event => changeProcess({ ...process, referenceYieldUnits: Number(event.target.value) })} placeholder="Ej. 100" /><small>empanadas</small></div></label><label><span>Observaciones generales <small>{process.notes.length}/1000</small></span><textarea value={process.notes} maxLength={1000} rows={2} onChange={event => changeProcess({ ...process, notes: event.target.value })} placeholder="Contexto general de esta versión del proceso…" /></label></section>
      <div className="sp-metrics">{metrics.map((metric, index) => <motion.article key={metric.label} className={`sp-metric sp-metric-${index}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .045, ease }}><div><metric.icon size={16} /><span>{metric.label}</span></div><AnimatePresence mode="popLayout"><motion.strong key={metric.value} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>{metric.value}</motion.strong></AnimatePresence><small>{metric.unit}</small></motion.article>)}</div>
      <div className="sp-main-grid"><div className="sp-flow">
        <header className="sp-flow-heading"><div><p className="sp-eyebrow">02 / ELABORACIÓN DE {selectedCatalog.nombre.toUpperCase()}</p><h3>El paso a paso<span>{process.steps.length.toString().padStart(2, "0")}</span></h3><p>Un método claro para un resultado que se repite.</p></div><button className="sp-button sp-button-primary" onClick={() => setEditor({ step: null, order: process.steps.length + 1 })}><Plus size={16} />Agregar paso</button></header>
        <div className="sp-flow-hint"><GripVertical size={14} /><span>Reordenar crea una nueva versión al guardar</span><span className="sp-flow-legend"><i />Activo <i />Espera</span></div>
        <Reorder.Group axis="y" values={process.steps} onReorder={steps => changeProcess({ ...process, steps })} className="sp-timeline" aria-label={`Pasos del proceso de ${selectedCatalog.nombre}`}><AnimatePresence>{process.steps.map((step, index) => <StepCard key={step.id} step={step} index={index} count={process.steps.length} start={process.steps.slice(0, index).reduce((sum, item) => sum + item.minutes, 0)} onEdit={() => setEditor({ step, order: index + 1 })} onDelete={() => deleteStep(step, index)} onMove={direction => moveStep(index, direction)} />)}</AnimatePresence></Reorder.Group>
        {process.steps.length === 0 && <div className="sp-empty"><Wheat size={30} /><h3>Todo empieza con un primer paso.</h3><p>Definí cómo se elabora esta receta y completá el rendimiento de referencia.</p></div>}
        <motion.button className="sp-add-step" onClick={() => setEditor({ step: null, order: process.steps.length + 1 })} whileHover={{ y: -3 }} whileTap={{ scale: .99 }}><span><Plus size={19} /></span><div><strong>{process.steps.length ? "Sumar un paso al recorrido" : "Crear el primer paso"}</strong><small>Los detalles también son parte de la receta.</small></div><ArrowUpRight size={17} /></motion.button>
        <div className="sp-flow-end"><CheckCheck size={17} /><span>{backendProcess ? `Versión vigente ${backendProcess.version}` : "Primer proceso"} para <strong>{process.referenceYieldUnits || "—"} empanadas</strong></span></div>
      </div>
      <aside className="sp-insights"><section className="sp-time-map"><header><span>LA RECETA, EN TIEMPO</span><Clock3 size={17} /></header><h3>{formatMinutes(summary.total)}</h3><p>de principio a fin</p><div className="sp-time-ribbon" aria-label={`${summary.active} minutos activos y ${summary.waiting} minutos de espera`}>{process.steps.map(step => <motion.span key={step.id} layout className={step.kind === "WAITING" ? "wait" : ""} style={{ flex: step.minutes }} title={`${step.name}: ${step.minutes} min`} />)}</div><div className="sp-time-key"><span><i />Activo <strong>{formatMinutes(summary.active)}</strong></span><span><i />Espera <strong>{formatMinutes(summary.waiting)}</strong></span></div><div className="sp-duration-list">{process.steps.map((step, index) => <motion.div layout key={step.id}><span>{String(index + 1).padStart(2, "0")}</span><div><p>{step.name}<strong>{step.minutes} min</strong></p><div className="sp-duration-track"><motion.i className={step.kind === "WAITING" ? "wait" : ""} initial={{ width: 0 }} animate={{ width: `${summary.total ? step.minutes / summary.total * 100 : 0}%` }} transition={{ duration: .7, ease }} /></div></div></motion.div>)}</div><footer><Layers3 size={14} /><span>Pasos consecutivos, sin superposición.<br />Tiempos para el rendimiento de referencia.</span></footer></section>
        <section className="sp-labor"><span className="sp-insight-label"><Users size={16} />EL ESFUERZO DETRÁS</span><h3>{number.format(summary.personHours)}<small>horas-persona</small></h3><p>El tiempo estimado de cada paso multiplicado por las personas requeridas.</p><div><span>{summary.personMinutes} min-persona</span><span>{process.referenceYieldUnits ? number.format(summary.personMinutes / process.referenceYieldUnits) : 0} min / empanada</span></div><small>Los valores definitivos los calcula el backend al guardar.</small></section>
      </aside></div>
    </motion.div></AnimatePresence>
    <div className={`sp-savebar ${dirty ? "is-dirty" : ""}`}><div><span className="sp-save-indicator">{dirty ? <Pencil size={15} /> : <CheckCheck size={17} />}</span><div><strong>{dirty ? "Cambios sin guardar" : backendProcess ? `Versión ${backendProcess.version} vigente` : "Proceso todavía sin crear"}</strong><small>{backendProcess ? "Guardar cambios crea una versión nueva" : "Completá el rendimiento y al menos un paso"}</small></div></div><div>{undo && <button className="sp-button sp-undo" onClick={undoDelete}><RotateCcw size={14} />Deshacer eliminación</button>}<button className="sp-button" disabled={!dirty || saving} onClick={() => { changeProcess(baseDraft); setUndo(null); setError(""); setNotice("Se descartaron los cambios locales."); }}><RotateCcw size={14} />Cancelar cambios</button><button className="sp-button sp-button-primary" disabled={!dirty || saving} onClick={() => void saveProcess()}>{saving ? <LoaderCircle className="sp-spin" size={15} /> : <Save size={15} />}{backendProcess ? `Crear versión ${backendProcess.version + 1}` : "Crear proceso"}</button></div></div>
    <AnimatePresence>{editor && <StepEditor key={editor.step?.id ?? "new"} step={editor.step} order={editor.order} count={process.steps.length + (editor.step ? 0 : 1)} recipeName={selectedCatalog.nombre} onClose={() => setEditor(null)} onSubmit={submitStep} />}{historyOpen && <ProcessHistory varietyName={selectedCatalog.nombre} versions={history} loading={historyLoading} error={historyError} onClose={() => setHistoryOpen(false)} />}</AnimatePresence>
    <div className="sp-toast" role="status" aria-live="polite"><AnimatePresence>{notice && <motion.div key={notice} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>{notice}</motion.div>}</AnimatePresence></div>
  </section></MotionConfig>;
}
