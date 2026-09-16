import { API_URL } from "../config/api";
import { apiFetch, crearApiError } from "./httpClient";

const BASE_URL = `${API_URL}/api/v1/processes`;
export type TipoTiempoProceso = "ACTIVE" | "WAITING";
export type PasoProceso = { id: number; stepOrder: number; name: string; description: string | null; estimatedMinutes: number; requiredPeople: number; timeType: TipoTiempoProceso; notes: string | null; estimatedPersonMinutes: number };
export type Proceso = { id: number; varietyId: number; varietyName: string; version: number; referenceYieldUnits: number; notes: string | null; stepCount: number; totalEstimatedMinutes: number; activeMinutes: number; waitingMinutes: number; estimatedPersonMinutes: number; estimatedPersonHours: number; active: boolean; steps: PasoProceso[]; createdAt: string; updatedAt: string };
export type PaginaProcesos = { content: Proceso[]; totalElements: number; totalPages: number; size: number; number: number; numberOfElements: number; first: boolean; last: boolean; empty: boolean };
export type PasoProcesoPayload = { name: string; description: string | null; estimatedMinutes: number; requiredPeople: number; timeType: TipoTiempoProceso; notes: string | null };
export type CrearProcesoPayload = { varietyId: number; referenceYieldUnits: number; notes: string | null; steps: PasoProcesoPayload[] };
export type CrearVersionProcesoPayload = Omit<CrearProcesoPayload, "varietyId">;

async function procesar<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

export async function listarProcesosApi(): Promise<PaginaProcesos> {
  const params = new URLSearchParams({ page: "0", size: "20", sort: "varietyName,asc" });
  return procesar<PaginaProcesos>(await apiFetch(`${BASE_URL}?${params}`), "No se pudieron cargar los procesos.");
}
export async function listarProcesosPorEstadoApi(active: boolean, page = 0, size = 20, sort = "createdAt,desc"): Promise<PaginaProcesos> {
  const params = new URLSearchParams({ active: String(active), page: String(page), size: String(size), sort });
  return procesar<PaginaProcesos>(await apiFetch(`${BASE_URL}/status?${params}`), "No se pudieron cargar los procesos por estado.");
}
export async function obtenerProcesoApi(id: number): Promise<Proceso> {
  return procesar<Proceso>(await apiFetch(`${BASE_URL}/${id}`), "No se pudo cargar el proceso.");
}
export async function obtenerProcesoVigenteApi(varietyId: number): Promise<Proceso> {
  return procesar<Proceso>(await apiFetch(`${BASE_URL}/variety/${varietyId}`), "No se pudo cargar el proceso vigente.");
}
export async function obtenerHistorialProcesoApi(varietyId: number): Promise<Proceso[]> {
  return procesar<Proceso[]>(await apiFetch(`${BASE_URL}/variety/${varietyId}/history`), "No se pudo cargar el historial del proceso.");
}
export async function crearProcesoApi(payload: CrearProcesoPayload): Promise<Proceso> {
  return procesar<Proceso>(await apiFetch(BASE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), "No se pudo crear el proceso.");
}
export async function crearVersionProcesoApi(id: number, payload: CrearVersionProcesoPayload): Promise<Proceso> {
  return procesar<Proceso>(await apiFetch(`${BASE_URL}/${id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), "No se pudo crear la nueva versión del proceso.");
}
