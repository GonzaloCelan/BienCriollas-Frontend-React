import { API_URL } from "../config/api";
import type { MeasurementUnit } from "../utils/measurementUnits";
import type { AdditionalCostCalculationMode, AdditionalCostType } from "../utils/recipeAdditionalCosts";
import { apiFetch, crearApiError } from "./httpClient";

const BASE_URL = `${API_URL}/api/v1/recipes`;

export type IngredienteReceta = {
  ingredientId: number;
  ingredientName: string;
  quantity: number;
  measurementUnit: MeasurementUnit;
  currentCostPerBaseUnit: number;
  estimatedCost: number;
};

export type CostoAdicionalRecetaPayload = {
  costType: AdditionalCostType;
  name: string;
  calculationMode: AdditionalCostCalculationMode;
  value: number;
  sortOrder: number;
  notes: string | null;
};

export type CostoAdicionalReceta = CostoAdicionalRecetaPayload & {
  id: number;
  calculatedCost: number;
};

export type ResumenCostosReceta = {
  ingredientCost: number;
  fixedAdditionalCost: number;
  perUnitAdditionalCost: number;
  subtotalBeforePercentage: number;
  percentageAdditionalCost: number;
  totalAdditionalCost: number;
  estimatedRecipeTotalCost: number;
  estimatedCostPerUnit: number;
};

export type Receta = {
  id: number;
  varietyId: number;
  varietyName: string;
  version: number;
  baseYieldUnits: number;
  notes: string | null;
  ingredients: IngredienteReceta[];
  additionalCosts: CostoAdicionalReceta[];
  costSummary: ResumenCostosReceta;
  estimatedTotalCost: number;
  estimatedCostPerUnit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginaRecetas = {
  content: Receta[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

export type IngredienteRecetaPayload = {
  ingredientId: number;
  quantity: number;
};

export type CrearRecetaPayload = {
  varietyId: number;
  baseYieldUnits: number;
  notes: string | null;
  ingredients: IngredienteRecetaPayload[];
  additionalCosts: CostoAdicionalRecetaPayload[];
};

export type CrearVersionRecetaPayload = Omit<CrearRecetaPayload, "varietyId">;

export type IngredienteCalculoReceta = {
  ingredientId: number;
  ingredientName: string;
  measurementUnit: MeasurementUnit;
  baseQuantity: number;
  requiredQuantity: number;
  currentStock: number;
  enoughStock: boolean;
  missingQuantity: number;
  estimatedCost: number;
};

export type CalculoReceta = {
  recipeId: number;
  varietyId: number;
  varietyName: string;
  recipeVersion: number;
  baseYieldUnits: number;
  requestedUnits: number;
  scaleFactor: number;
  ingredients: IngredienteCalculoReceta[];
  additionalCosts: CostoAdicionalReceta[];
  costSummary: ResumenCostosReceta;
  estimatedTotalCost: number;
  estimatedCostPerUnit: number;
};

export type OrdenRecetas =
  | "varietyName,asc"
  | "varietyName,desc"
  | "version,desc"
  | "baseYieldUnits,asc"
  | "baseYieldUnits,desc"
  | "updatedAt,desc";

async function procesar<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

export async function listarRecetasApi(options: {
  active?: boolean;
  page?: number;
  size?: number;
  sort?: OrdenRecetas;
} = {}): Promise<PaginaRecetas> {
  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? 20),
    sort: options.sort ?? "varietyName,asc",
  });
  const url = options.active === false
    ? `${BASE_URL}/status?active=false&${params}`
    : `${BASE_URL}?${params}`;
  const response = await apiFetch(url);
  return procesar<PaginaRecetas>(response, "No se pudieron cargar las recetas.");
}

export async function obtenerRecetaApi(id: number): Promise<Receta> {
  const response = await apiFetch(`${BASE_URL}/${id}`);
  return procesar<Receta>(response, "No se pudo cargar la receta.");
}

export async function obtenerRecetaActivaPorVariedadApi(varietyId: number): Promise<Receta> {
  const response = await apiFetch(`${BASE_URL}/variety/${varietyId}`);
  return procesar<Receta>(response, "No se pudo cargar la receta de la variedad.");
}

export async function obtenerHistorialRecetaApi(varietyId: number): Promise<Receta[]> {
  const response = await apiFetch(`${BASE_URL}/variety/${varietyId}/history`);
  return procesar<Receta[]>(response, "No se pudo cargar el historial de la receta.");
}

export async function crearRecetaApi(payload: CrearRecetaPayload): Promise<Receta> {
  const response = await apiFetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return procesar<Receta>(response, "No se pudo crear la receta.");
}

export async function crearVersionRecetaApi(
  id: number,
  payload: CrearVersionRecetaPayload,
): Promise<Receta> {
  const response = await apiFetch(`${BASE_URL}/${id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return procesar<Receta>(response, "No se pudo crear la nueva versión.");
}

export async function calcularProduccionRecetaApi(
  id: number,
  quantity: number,
): Promise<CalculoReceta> {
  const params = new URLSearchParams({ quantity: String(quantity) });
  const response = await apiFetch(`${BASE_URL}/${id}/calculate?${params}`);
  return procesar<CalculoReceta>(response, "No se pudo calcular la producción.");
}
