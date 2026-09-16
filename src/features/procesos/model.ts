import type { CrearProcesoPayload, Proceso, TipoTiempoProceso } from "../../services/procesosApi";

export type ProcessStep = { id: number | string; name: string; description: string; minutes: number; people: number; kind: TipoTiempoProceso; notes: string };
export type ProcessDraft = { processId: number | null; varietyId: number; varietyName: string; version: number | null; referenceYieldUnits: number; notes: string; steps: ProcessStep[] };

export function emptyProcess(varietyId: number, varietyName: string): ProcessDraft {
  return { processId: null, varietyId, varietyName, version: null, referenceYieldUnits: 0, notes: "", steps: [] };
}

export function draftFromProcess(process: Proceso): ProcessDraft {
  return { processId: process.id, varietyId: process.varietyId, varietyName: process.varietyName, version: process.version, referenceYieldUnits: process.referenceYieldUnits, notes: process.notes ?? "", steps: [...process.steps].sort((a, b) => a.stepOrder - b.stepOrder).map(item => ({ id: item.id, name: item.name, description: item.description ?? "", minutes: item.estimatedMinutes, people: item.requiredPeople, kind: item.timeType, notes: item.notes ?? "" })) };
}

export function processPayload(process: ProcessDraft): CrearProcesoPayload {
  return { varietyId: process.varietyId, referenceYieldUnits: process.referenceYieldUnits, notes: process.notes.trim() || null, steps: process.steps.map(item => ({ name: item.name.trim(), description: item.description.trim() || null, estimatedMinutes: item.minutes, requiredPeople: item.people, timeType: item.kind, notes: item.notes.trim() || null })) };
}

export function summarizeProcess(process: ProcessDraft) {
  const active = process.steps.reduce((sum, item) => sum + (item.kind === "ACTIVE" ? item.minutes : 0), 0);
  const waiting = process.steps.reduce((sum, item) => sum + (item.kind === "WAITING" ? item.minutes : 0), 0);
  const personMinutes = process.steps.reduce((sum, item) => sum + item.minutes * item.people, 0);
  return { active, waiting, total: active + waiting, personMinutes, personHours: personMinutes / 60 };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

export function validateProcess(process: ProcessDraft) {
  if (!Number.isInteger(process.referenceYieldUnits) || process.referenceYieldUnits <= 0) return "Ingresá un rendimiento de referencia entero mayor que cero.";
  if (process.notes.trim().length > 1000) return "Las observaciones generales admiten hasta 1000 caracteres.";
  if (process.steps.length === 0) return "Agregá al menos un paso antes de guardar el proceso.";
  for (const item of process.steps) {
    if (!item.name.trim()) return "Todos los pasos necesitan un nombre.";
    if (item.name.trim().length > 120) return `El nombre “${item.name}” supera los 120 caracteres.`;
    if (item.description.trim().length > 1000) return `La descripción de “${item.name}” supera los 1000 caracteres.`;
    if (!Number.isInteger(item.minutes) || item.minutes <= 0) return `El tiempo de “${item.name}” debe ser un entero mayor que cero.`;
    if (!Number.isInteger(item.people) || item.people < 0) return `La cantidad de personas de “${item.name}” no es válida.`;
    if (item.kind === "ACTIVE" && item.people < 1) return `El paso activo “${item.name}” requiere al menos una persona.`;
    if (item.notes.trim().length > 500) return `Las observaciones de “${item.name}” superan los 500 caracteres.`;
  }
  return "";
}
