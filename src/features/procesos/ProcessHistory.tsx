import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Check, Clock3, History, Layers3, Users, X } from "lucide-react";
import { formatMinutes } from "./model";
import type { Proceso } from "../../services/procesosApi";

type Props = { varietyName: string; versions: Proceso[]; loading: boolean; error: string; onClose: () => void };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function ProcessHistory({ varietyName, versions, loading, error, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = previous; };
  }, []);

  return createPortal(<dialog ref={dialog} className="standard-editor standard-history" aria-labelledby="process-history-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className="standard-editor-panel" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 30 }}>
      <header><div><p className="sp-eyebrow">PROCESO ESTÁNDAR / HISTORIAL</p><h2 id="process-history-title">{varietyName}</h2></div><button type="button" className="sp-icon" onClick={onClose} aria-label="Cerrar historial"><X size={20} /></button></header>
      <div className="standard-editor-body sp-history-body">
        {loading && <div className="sp-loading"><span /><p>Cargando versiones…</p></div>}
        {error && <div className="sp-api-error" role="alert">{error}</div>}
        {!loading && !error && versions.length === 0 && <div className="sp-empty"><History size={28} /><h3>No hay versiones para mostrar.</h3></div>}
        {versions.map(version => <article className={`sp-history-card ${version.active ? "is-active" : ""}`} key={version.id}>
          <button className="sp-history-summary" onClick={() => setExpanded(current => current === version.id ? null : version.id)} aria-expanded={expanded === version.id}>
            <span className="sp-history-version"><Layers3 size={15} />v{version.version}</span><div><strong>{version.active ? "Versión vigente" : `Versión ${version.version}`}</strong><small>{formatDate(version.createdAt)}</small></div><span className="sp-history-state">{version.active && <Check size={12} />}{version.active ? "Vigente" : "Histórica"}</span>
          </button>
          {expanded === version.id && <motion.div className="sp-history-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}><div className="sp-history-metrics"><span><Clock3 size={13} />{formatMinutes(version.totalEstimatedMinutes)}</span><span><Users size={13} />{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(version.estimatedPersonHours)} h-p</span><span>{version.referenceYieldUnits} empanadas</span></div>{version.notes && <p>{version.notes}</p>}<ol>{[...version.steps].sort((a, b) => a.stepOrder - b.stepOrder).map(step => <li key={step.id}><span>{String(step.stepOrder).padStart(2, "0")}</span><div><strong>{step.name}</strong><small>{step.estimatedMinutes} min · {step.requiredPeople} {step.requiredPeople === 1 ? "persona" : "personas"} · {step.timeType === "ACTIVE" ? "Activo" : "Espera"}</small></div></li>)}</ol></motion.div>}
        </article>)}
      </div>
      <footer><button type="button" className="sp-button" onClick={onClose}>Cerrar</button></footer>
    </motion.section>
  </dialog>, document.body);
}
