import { API_URL } from "../config/api";
import type { MeasurementUnit } from "../utils/measurementUnits";
import { apiFetch, crearApiError } from "./httpClient";

const BASE_URL = `${API_URL}/api/v1/ingredients`;

export type Ingrediente = {
  id: number;
  name: string;
  measurementUnit: MeasurementUnit;
  purchasePresentation: string | null;
  purchaseQuantity: number | null;
  purchasePrice: number | null;
  purchaseDataComplete: boolean;
  costPerBaseUnit: number;
  referencePrice: number | null;
  referencePriceUnit: "KG" | "LITER" | "UNIT" | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginaIngredientes = {
  content: Ingrediente[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

export type ResumenIngredientes = {
  totalIngredients: number;
  activeIngredients: number;
  inactiveIngredients: number;
};

export type IngredienteEditable = {
  name: string;
  measurementUnit: MeasurementUnit;
  purchasePresentation: string;
  purchaseQuantity: number;
  purchasePrice: number;
};

export type CompraIngredienteEditable = Pick<
  IngredienteEditable,
  "purchasePresentation" | "purchaseQuantity" | "purchasePrice"
>;

export type FiltroIngredientes = "todos" | "activos" | "inactivos";
export type OrdenIngredientes = "name,asc" | "name,desc";

async function procesar<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

export async function listarIngredientesApi(options: {
  filtro: FiltroIngredientes;
  query?: string;
  page?: number;
  size?: number;
  sort?: OrdenIngredientes;
}): Promise<PaginaIngredientes> {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  const sort = options.sort ?? "name,asc";
  const params = new URLSearchParams({ page: String(page), size: String(size), sort });

  let url: string;
  if (options.query?.trim()) {
    params.set("query", options.query.trim());
    url = `${BASE_URL}/search?${params}`;
  } else if (options.filtro === "inactivos") {
    params.set("active", "false");
    url = `${BASE_URL}/status?${params}`;
  } else if (options.filtro === "activos") {
    params.set("active", "true");
    url = `${BASE_URL}/status?${params}`;
  } else {
    url = `${BASE_URL}?${params}`;
  }

  const response = await apiFetch(url);
  return procesar<PaginaIngredientes>(response, "No se pudieron cargar los ingredientes.");
}

export async function obtenerResumenIngredientesApi(): Promise<ResumenIngredientes> {
  const response = await apiFetch(`${BASE_URL}/summary`);
  return procesar<ResumenIngredientes>(response, "No se pudo cargar el resumen de ingredientes.");
}

export async function crearIngredienteApi(payload: IngredienteEditable): Promise<Ingrediente> {
  const response = await apiFetch(BASE_URL, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return procesar<Ingrediente>(response, "No se pudo crear el ingrediente.");
}

export async function actualizarIngredienteApi(id: number, payload: IngredienteEditable): Promise<Ingrediente> {
  const response = await apiFetch(`${BASE_URL}/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return procesar<Ingrediente>(response, "No se pudo actualizar el ingrediente.");
}

export async function actualizarCostoIngredienteApi(id: number, payload: CompraIngredienteEditable): Promise<Ingrediente> {
  return patch(id, "cost", payload, "No se pudieron actualizar los datos de compra.");
}

export async function cambiarEstadoIngredienteApi(id: number, active: boolean): Promise<Ingrediente> {
  return patch(id, active ? "activate" : "deactivate", undefined, `No se pudo ${active ? "activar" : "desactivar"} el ingrediente.`);
}

async function patch(id: number, route: string, body: object | undefined, fallback: string): Promise<Ingrediente> {
  const response = await apiFetch(`${BASE_URL}/${id}/${route}`, {
    method: "PATCH",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return procesar<Ingrediente>(response, fallback);
}
