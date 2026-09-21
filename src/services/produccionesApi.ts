import { API_URL } from "../config/api";
import type { MeasurementUnit } from "../utils/measurementUnits";
import type { AdditionalCostCalculationMode, AdditionalCostType } from "../utils/recipeAdditionalCosts";
import { apiFetch, crearApiError } from "./httpClient";

const BASE_URL = `${API_URL}/api/v1/productions`;

export type EstadoProduccion = "DRAFT" | "FINALIZED" | "CANCELED";

export type IngredienteProduccion = {
  ingredientId: number;
  ingredientName: string;
  expectedQuantity: number;
  actualQuantity: number | null;
  differenceQuantity: number;
  differencePercentage: number | null;
  measurementUnit: MeasurementUnit;
  costPerBaseUnitSnapshot: number;
  expectedCost: number;
  actualCost: number;
  currentStock: number;
  projectedStock: number;
  enoughStock: boolean;
};

export type CostoAdicionalProduccion = {
  id: number;
  recipeAdditionalCostId: number;
  costType: AdditionalCostType;
  name: string;
  calculationMode: AdditionalCostCalculationMode;
  value: number;
  expectedCost: number;
  sortOrder: number;
};

export type Produccion = {
  id: number;
  productionDate: string;
  varietyId: number;
  varietyName: string;
  recipeId: number;
  recipeVersion: number;
  processId: number | null;
  processVersion: number | null;
  plannedUnits: number;
  finalUnits: number | null;
  wasteUnits: number | null;
  wasteReason: string | null;
  totalMinutes: number | null;
  peopleCount: number | null;
  status: EstadoProduccion;
  notes: string | null;
  ingredients: IngredienteProduccion[];
  additionalCosts: CostoAdicionalProduccion[];
  expectedIngredientCost: number;
  actualIngredientCost: number;
  actualIngredientCostPerUnit: number | null;
  standardUnitsPerHour: number | null;
  actualUnitsPerHour: number | null;
  productivityVariationPercentage: number | null;
  createdAt: string;
  updatedAt?: string;
  finalizedAt: string | null;
};

export type PaginaProducciones = {
  content: Produccion[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
};

export type OrdenProducciones =
  | "productionDate,desc"
  | "productionDate,asc"
  | "createdAt,desc"
  | "varietyName,asc"
  | "plannedUnits,desc"
  | "finalUnits,desc"
  | "status,asc";

export type CrearProduccionPayload = {
  varietyId: number;
  productionDate: string;
  plannedUnits: number;
  notes: string | null;
};

export type ActualizarProduccionPayload = {
  finalUnits: number | null;
  totalMinutes: number | null;
  peopleCount: number | null;
  wasteUnits: number | null;
  wasteReason: string;
  notes: string;
};

async function procesar<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

function pagination(page: number, size: number, sort: OrdenProducciones) {
  return new URLSearchParams({ page: String(page), size: String(size), sort });
}

export async function listarProduccionesApi(options: {
  page?: number;
  size?: number;
  sort?: OrdenProducciones;
  status?: EstadoProduccion | null;
  from?: string;
  to?: string;
} = {}): Promise<PaginaProducciones> {
  const page = options.page ?? 0;
  const size = options.size ?? 12;
  const sort = options.sort ?? "productionDate,desc";
  const params = pagination(page, size, sort);
  let url = BASE_URL;

  if (options.from && options.to) {
    params.set("from", options.from);
    params.set("to", options.to);
    url = `${BASE_URL}/date-range`;
  } else if (options.status) {
    params.set("status", options.status);
    url = `${BASE_URL}/status`;
  }

  return procesar<PaginaProducciones>(await apiFetch(`${url}?${params}`), "No se pudieron cargar las producciones.");
}

export async function obtenerProduccionApi(id: number): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}`), "No se pudo cargar la producción.");
}

export async function crearProduccionApi(payload: CrearProduccionPayload): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }), "No se pudo crear la producción.");
}

export async function actualizarProduccionApi(id: number, payload: ActualizarProduccionPayload): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }), "No se pudieron guardar los datos reales.");
}

export async function actualizarConsumoProduccionApi(id: number, ingredientId: number, actualQuantity: number): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}/ingredients`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredientId, actualQuantity }),
  }), "No se pudo actualizar el consumo del ingrediente.");
}

export async function agregarIngredienteProduccionApi(id: number, ingredientId: number, actualQuantity: number): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}/ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredientId, actualQuantity }),
  }), "No se pudo agregar el ingrediente extra.");
}

export async function finalizarProduccionApi(id: number): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}/finalize`, { method: "POST" }), "No se pudo finalizar la producción.");
}

export async function cancelarProduccionApi(id: number): Promise<Produccion> {
  return procesar<Produccion>(await apiFetch(`${BASE_URL}/${id}/cancel`, { method: "POST" }), "No se pudo cancelar la producción.");
}
