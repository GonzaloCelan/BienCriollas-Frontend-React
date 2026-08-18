import { API_URL } from "../config/api";

export type StockApiResponse = {
  id_variedad: number;
  stock_disponible: number;
  stock_total: number;
  fecha_elaboracion: string | null;
};

export type StockItem = {
  id: number;
  nombre: string;
  descripcion: string;
  stock: number;
  stockTotal: number;
  fechaElaboracion: string | null;
  produccion: number;
};

/**
 * Este es el formato que usa el FRONT.
 * La pantalla Stock trabaja con idVariedad + cantidad.
 */
export type StockUpdateRequest = {
  idVariedad: number;
  cantidad: number;
};

/**
 * Este es el formato que espera el BACK.
 * Record Java:
 * StockDTO(Long id_variedad, LocalDate fecha_elaboracion, Integer stock_total)
 */
type StockUpdateBackendRequest = {
  id_variedad: number;
  fecha_elaboracion: string;
  stock_total: number;
};

export type PerdidaEmpanadaRequest = {
  idVariedad: number;
  cantidad: number;
};

export type AjusteStockRequest = {
  idVariedad: number;
  stockDisponible: number;
};

const VARIEDADES: Record<number, { nombre: string; descripcion: string }> = {
  1: { nombre: "Carne", descripcion: "Empanada de carne tradicional" },
  2: { nombre: "Verdura", descripcion: "Empanada de verdura" },
  3: { nombre: "Choclo", descripcion: "Empanada de choclo" },
  4: { nombre: "Pollo", descripcion: "Empanada de pollo" },
  5: { nombre: "Atún", descripcion: "Empanada de atún" },
  6: { nombre: "Capresse", descripcion: "Mozzarella, tomate y albahaca" },
  7: { nombre: "Fugazza", descripcion: "Cebolla y mozzarella" },
  8: { nombre: "Queso azul", descripcion: "Queso azul y mozzarella" },
  9: { nombre: "Bondiola", descripcion: "Empanada de bondiola" },
  10: {
    nombre: "Vacío desmenuzado",
    descripcion: "Empanada de vacío desmenuzado",
  },
  11: { nombre: "Campo", descripcion: "Empanada campo" },
  12: { nombre: "Jamón y queso", descripcion: "Jamón cocido y queso" },
};

function obtenerFechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

async function handleResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    const text = await response.text();
    console.error(errorMessage, text);
    throw new Error(`${errorMessage}. Status: ${response.status}`);
  }
}

export const obtenerStockActual = async (): Promise<StockItem[]> => {
  const response = await fetch(`${API_URL}/api/v2/stock/obtener-stock-actual`);

  await handleResponse(response, "Error al obtener el stock actual");

  const data: StockApiResponse[] = await response.json();

  return data.map((item) => {
    const variedad = VARIEDADES[item.id_variedad];

    return {
      id: item.id_variedad,
      nombre: variedad?.nombre ?? `Variedad #${item.id_variedad}`,
      descripcion: variedad?.descripcion ?? "Sin descripción",
      stock: item.stock_disponible,
      stockTotal: item.stock_total,
      fechaElaboracion: item.fecha_elaboracion,
      produccion: 0,
    };
  });
};

export const actualizarStock = async (
  produccion: StockUpdateRequest[]
): Promise<void> => {
  const fechaHoy = obtenerFechaHoy();

  const payload: StockUpdateBackendRequest[] = produccion.map((item) => ({
    id_variedad: item.idVariedad,
    fecha_elaboracion: fechaHoy,
    stock_total: item.cantidad,
  }));

  console.log("Payload producción enviado al back:", payload);

  const response = await fetch(`${API_URL}/api/v2/stock/actualizar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await handleResponse(response, "Error al actualizar stock");
};

export const registrarPerdidas = async (
  perdidas: PerdidaEmpanadaRequest[]
): Promise<void> => {
  const response = await fetch(`${API_URL}/api/v2/stock/perdidas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(perdidas),
  });

  await handleResponse(response, "Error al registrar pérdidas");
};

export const ajustarStockDisponible = async (
  ajustes: AjusteStockRequest[]
): Promise<void> => {
  const response = await fetch(`${API_URL}/api/v2/stock/ajustar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ajustes),
  });

  await handleResponse(response, "Error al ajustar stock");
};
