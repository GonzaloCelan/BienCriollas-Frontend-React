import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock3, Hand, Hourglass, Save, Users, X } from "lucide-react";
import type { ProcessStep } from "./model";
import type { TipoTiempoProceso } from "../../services/procesosApi";

type Props = { step: ProcessStep | null; order: number; count: number; recipeName: string; onClose: () => void; onSubmit: (step: ProcessStep, order: number) => void };

export default function StepEditor({ step, order, count, recipeName, onClose, onSubmit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<TipoTiempoProceso>(step?.kind ?? "ACTIVE");
  const [people, setPeople] = useState(String(step?.people ?? 1));
  const [minutes, setMinutes] = useState(String(step?.minutes ?? 20));
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    node.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    const main = document.getElementById("app-main");
    const previous = main?.style.overflow;
    if (main) main.style.overflow = "hidden";
    return () => { node.close(); if (main) main.style.overflow = previous ?? ""; };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const description = String(data.get("description")).trim();
    if (!name) {
      const field = event.currentTarget.elements.namedItem("name") as HTMLInputElement;
      field.setCustomValidity("Completá este campo con texto.");
      field.reportValidity();
      field.addEventListener("input", () => field.setCustomValidity(""), { once: true });
      return;
    }
    onSubmit({ id: step?.id ?? crypto.randomUUID(), name, description, minutes: Number(minutes), people: Number(people), kind, notes: String(data.get("notes")).trim() }, Number(data.get("order")));
  }

  return createPortal(<dialog ref={dialog} className="standard-editor" aria-labelledby="standard-editor-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.form className="standard-editor-panel" onSubmit={submit} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 30 }}>
      <header><div><p className="sp-eyebrow">{recipeName} / Proceso estándar</p><h2 id="standard-editor-title">{step ? "Editar paso" : "Un nuevo paso"}</h2></div><button type="button" className="sp-icon" onClick={onClose} aria-label="Cerrar editor"><X size={20} /></button></header>
      <div className="standard-editor-body">
        <div className="sp-editor-intro"><span>{String(order).padStart(2, "0")}</span><div><strong>Cada detalle hace la diferencia.</strong><p>Definí qué se hace, cuánto lleva y quiénes participan.</p></div></div>
        <label>Nombre del paso<input name="name" defaultValue={step?.name ?? ""} placeholder="Ej. Preparar verduras" maxLength={120} required autoFocus /></label>
        <label>Descripción <small>OPCIONAL</small><textarea name="description" defaultValue={step?.description ?? ""} placeholder="Describí cómo realizar este paso…" maxLength={1000} rows={4} /></label>
        <fieldset><legend>Tipo de tiempo</legend><div className="sp-kind-options">{(["ACTIVE", "WAITING"] as const).map(value => <label key={value} className={kind === value ? "selected" : ""}><input type="radio" name="kind" value={value} checked={kind === value} onChange={() => { setKind(value); setPeople(value === "WAITING" ? "0" : String(Math.max(1, Number(people)))); }} />{value === "ACTIVE" ? <Hand size={20} /> : <Hourglass size={20} />}<strong>{value === "ACTIVE" ? "Trabajo activo" : "Tiempo de espera"}</strong><span>{value === "ACTIVE" ? "Requiere intervención" : "Reposo, enfriado u otra espera"}</span></label>)}</div></fieldset>
        <div className="sp-editor-grid"><label><span><Clock3 size={14} />Tiempo estimado</span><div className="sp-input-unit"><input type="number" name="minutes" min="1" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} required /><span>min</span></div></label><label><span><Users size={14} />Personas estimadas</span><input type="number" name="people" min={kind === "ACTIVE" ? 1 : 0} step="1" value={people} onChange={event => setPeople(event.target.value)} required /></label></div>
        <p className="sp-field-hint">{kind === "WAITING" ? "Usá 0 personas si el paso no requiere dedicación. Si asignás personas, se sumará su tiempo a las horas-persona." : "El tiempo de cada persona estimada se suma a la carga de trabajo."}</p>
        <label>Posición en el proceso<select name="order" defaultValue={order}>{Array.from({ length: count }, (_, index) => <option key={index} value={index + 1}>{String(index + 1).padStart(2, "0")} · {index === 0 ? "Primer paso" : index === count - 1 ? "Último paso" : "Paso intermedio"}</option>)}</select></label>
        <label>Observaciones <small>OPCIONAL</small><textarea name="notes" defaultValue={step?.notes ?? ""} placeholder="Consejos, cuidados o detalles a tener en cuenta…" maxLength={500} rows={3} /></label>
        <div className="sp-editor-estimate"><Users size={18} /><span>Carga estimada de este paso</span><strong>{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(minutes || 0) * Number(people || 0) / 60)} h-p</strong></div>
      </div>
      <footer><button type="button" className="sp-button" onClick={onClose}>Cancelar</button><button className="sp-button sp-button-primary" type="submit">{step ? <Save size={16} /> : <ArrowRight size={16} />}{step ? "Aplicar cambios" : "Agregar paso"}</button></footer>
    </motion.form>
  </dialog>, document.body);
}
