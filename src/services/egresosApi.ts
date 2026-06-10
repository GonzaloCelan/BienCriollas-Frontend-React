const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:8080";

export type TipoEgreso = "PERSONAL" | "PRODUCCION" | "OTROS";

export type EgresoTipoDTO = {
  idCaja: number | null;
  tipoEgreso: TipoEgreso;
  descripcion: string;
  monto: number;
};

export type Egreso = {
  idEgreso: number;
  tipoEgreso: TipoEgreso;
  descripcion: string;
  monto: number;
  hora: string;
  creadoEn: string;
};

export type EgresoResponseDTO = {
  totalPersonal: number;
  totalProduccion: number;
  totalOtros: number;
};

export type EgresosPorcentajeDTO = {
  tipoEgreso: TipoEgreso;
  totalMesActual: number;
  porcentaje: number;
};

export type EgresoTotalPorTipoDTO = {
  tipoEgreso: TipoEgreso;
  total: number;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

async function handleResponse<T>(
  response: Response,
  errorMessage: string
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    console.error(errorMessage, text);

    throw new Error(`${errorMessage}. Status: ${response.status}`);
  }

  return response.json();
}

export async function registrarEgreso(
  payload: EgresoTipoDTO
): Promise<Egreso> {
  const response = await fetch(`${API_URL}/api/v2/egreso/registrar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<Egreso>(response, "Error al registrar egreso");
}

export async function obtenerEgresoAcumulado(): Promise<EgresoResponseDTO> {
  const response = await fetch(`${API_URL}/api/v2/egreso/acumulado`);

  return handleResponse<EgresoResponseDTO>(
    response,
    "Error al obtener egreso acumulado"
  );
}

export async function obtenerEgresosDiarios(): Promise<Egreso[]> {
  const response = await fetch(`${API_URL}/api/v2/egreso/diario`);

  return handleResponse<Egreso[]>(response, "Error al obtener egresos diarios");
}

export async function listarEgresosPorTipo(params: {
  tipo: TipoEgreso;
  page?: number;
  size?: number;
}): Promise<PageResponse<Egreso>> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 10));

  const response = await fetch(
    `${API_URL}/api/v2/egreso/tipo/${params.tipo}?${query.toString()}`
  );

  return handleResponse<PageResponse<Egreso>>(
    response,
    "Error al listar egresos por tipo"
  );
}

export async function obtenerPorcentajesEgresos(): Promise<
  EgresosPorcentajeDTO[]
> {
  const response = await fetch(`${API_URL}/api/v2/egreso/porcentajes`);

  return handleResponse<EgresosPorcentajeDTO[]>(
    response,
    "Error al obtener porcentajes de egresos"
  );
}

export async function obtenerTotalesPorTipo(params: {
  anio: number;
  mes: number;
}): Promise<EgresoTotalPorTipoDTO[]> {
  const query = new URLSearchParams();

  query.set("anio", String(params.anio));
  query.set("mes", String(params.mes));

  const response = await fetch(
    `${API_URL}/api/v2/egreso/totales-tipo?${query.toString()}`
  );

  return handleResponse<EgresoTotalPorTipoDTO[]>(
    response,
    "Error al obtener totales por tipo"
  );
}

export async function listarHistorialEgresos(params: {
  anio: number;
  mes: number;
  tipo?: TipoEgreso | "TODAS";
  page?: number;
  size?: number;
}): Promise<PageResponse<Egreso>> {
  const query = new URLSearchParams();

  query.set("anio", String(params.anio));
  query.set("mes", String(params.mes));
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 10));

  if (params.tipo && params.tipo !== "TODAS") {
    query.set("tipo", params.tipo);
  }

  const response = await fetch(
    `${API_URL}/api/v2/egreso/historial?${query.toString()}`
  );

  return handleResponse<PageResponse<Egreso>>(
    response,
    "Error al listar historial de egresos"
  );
}

export async function obtenerUltimosMovimientos(): Promise<Egreso[]> {
  const response = await fetch(`${API_URL}/api/v2/egreso/ultimos`);

  return handleResponse<Egreso[]>(
    response,
    "Error al obtener últimos movimientos"
  );
}