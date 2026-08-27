import { API_URL } from "../config/api";
import { apiFetch } from "./httpClient";

export type CatalogoItem = {
  id_variedad: number;
  nombre: string;
  precioUnitario: number;
  precioMediaDocena: number;
  precioDocena: number;
  activo: number;
};

export type ActualizarPreciosCatalogoPayload = Pick<
  CatalogoItem,
  "precioUnitario" | "precioMediaDocena" | "precioDocena"
>;

let catalogoPromise: Promise<CatalogoItem[]> | null = null;
const CATALOGO_TIMEOUT_MS = 10000;

function normalizarCatalogo(data: CatalogoItem[]) {
  return data
    .map((item) => ({
      ...item,
      id_variedad: Number(item.id_variedad),
      precioUnitario: Number(item.precioUnitario),
      precioMediaDocena: Number(item.precioMediaDocena),
      precioDocena: Number(item.precioDocena),
      activo: Number(item.activo),
    }))
    .filter((item) => item.activo === 1);
}

export function obtenerCatalogoApi(
  options: { force?: boolean } = {}
): Promise<CatalogoItem[]> {
  if (options.force) {
    catalogoPromise = null;
  }

  if (catalogoPromise) return catalogoPromise;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, CATALOGO_TIMEOUT_MS);

  catalogoPromise = apiFetch(`${API_URL}/api/v2/catalogo`, {
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Error al obtener el catálogo. Status: ${response.status}`
        );
      }

      const data: CatalogoItem[] = await response.json();
      return normalizarCatalogo(data);
    })
    .catch((error) => {
      catalogoPromise = null;
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timeout);
    });

  return catalogoPromise;
}

export async function actualizarPreciosCatalogoApi(
  idVariedad: number,
  precios: ActualizarPreciosCatalogoPayload
): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/v2/catalogo/${idVariedad}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(precios),
  });

  if (!response.ok) {
    throw new Error(
      `Error al actualizar los precios. Status: ${response.status}`
    );
  }

  if (catalogoPromise) {
    catalogoPromise = catalogoPromise.then((catalogo) =>
      catalogo.map((item) =>
        item.id_variedad === idVariedad ? { ...item, ...precios } : item
      )
    );
  }
}
