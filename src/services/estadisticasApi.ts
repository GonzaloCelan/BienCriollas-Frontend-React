import { API_URL } from "../config/api";
import { apiFetch, crearApiError } from "./httpClient";

export type PeriodoEstadistica = "hoy" | "ultimos7" | "mes" | "anio";

export type FiltrosEstadisticas = {
  periodo: PeriodoEstadistica;
  fecha: string;
  mes: string;
  anio: number;
};

export type ClienteRankingDTO = {
  posicion: number;
  cliente: string;
  cantidadPedidos: number;
  totalAcumulado: number;
  ticketPromedio: number;
  totalUnidades: number;
};

export type ClientesRankingDTO = {
  periodo: { tipo: "DIA" | "ULTIMOS_7_DIAS" | "MES" | "ANIO"; desde: string; hasta: string };
  orden: "IMPORTE" | "PEDIDOS";
  totalClientes: number;
  ventasParticularesPeriodo: number;
  totalTopClientes: number;
  porcentajeVentasTop: number;
  clientes: ClienteRankingDTO[];
};

export type FranjaHoraPicoDTO = {
  inicio: string;
  fin: string;
  pedidos: number;
  montoVendido: number;
  porcentajeDelTotal: number;
};

export type TurnoHoraPicoDTO = {
  desde: string;
  hasta: string;
  totalPedidos: number;
  totalMontoVendido: number;
  franjas: FranjaHoraPicoDTO[];
};

export type HoraPicoDTO = {
  periodo: {
    tipo: "DIA" | "ULTIMOS_7_DIAS" | "MES" | "ANIO";
    desde: string;
    hasta: string;
  };
  totalPedidosAnalizados: number;
  totalMontoVendido: number;
  horaPico: (FranjaHoraPicoDTO & { turno: "MEDIODIA" | "NOCHE" }) | null;
  turnos: { mediodia: TurnoHoraPicoDTO; noche: TurnoHoraPicoDTO };
  pedidosFueraDeHorario: number;
  montoFueraDeHorario: number;
};

export type VariedadMasVendidaDTO = {
  idVariedad: number;
  nombre: string;
  unidadesVendidas: number;
};

export type RankingVariedadDTO = {
  idVariedad: number;
  nombre: string;
  unidadesVendidas: number;
};

export type VentaDiaSemanaDTO = {
  diaSemana: number;
  nombreDia: string;
  cantidadPedidos: number;
  unidadesVendidas: number;
  totalVendido: number;
};

export type TipoVentaDTO = {
  tipoVenta: string;
  cantidadPedidos: number;
  porcentaje: number | null;
};

export type MedioPagoDTO = {
  medioPago: string;
  cantidadPedidos: number;
  porcentaje: number | null;
};

export type MermaVariedadDTO = {
  idVariedad: number;
  nombre: string;
  unidadesPerdidas: number;
};

export type EstadisticaResumenDTO = {
  pedidosEntregados: number;
  empanadasVendidas: number;
  ticketPromedio: number;
  variedadMasVendida: VariedadMasVendidaDTO | null;

  rankingVariedades: RankingVariedadDTO[];
  ventasPorDiaSemana: VentaDiaSemanaDTO[];
  tiposVenta: TipoVentaDTO[];
  mediosPago: MedioPagoDTO[];
  mermasPorVariedad: MermaVariedadDTO[];
};

function formatDate(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

export function obtenerRangoEstadistica(
  periodo: PeriodoEstadistica,
  fechaSeleccionada?: string,
  mesSeleccionado?: string,
  anioSeleccionado?: number
): {
  desde: string;
  hasta: string;
} {
  if (periodo === "anio") {
    const anio = anioSeleccionado ?? new Date().getFullYear();
    return { desde: `${anio}-01-01`, hasta: `${anio + 1}-01-01` };
  }
  if (periodo === "hoy") {
    const desde = fechaSeleccionada ?? formatDate(new Date());

    const hastaDate = new Date(`${desde}T00:00:00`);
    hastaDate.setDate(hastaDate.getDate() + 1);

    return {
      desde,
      hasta: formatDate(hastaDate),
    };
  }

  if (periodo === "ultimos7") {
    const hoy = new Date(`${fechaSeleccionada ?? formatDate(new Date())}T00:00:00`);

    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - 6);

    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + 1);

    return {
      desde: formatDate(desde),
      hasta: formatDate(hasta),
    };
  }

  const mes = mesSeleccionado ?? formatDate(new Date()).slice(0, 7);
  const [anio, numeroMes] = mes.split("-").map(Number);

  const desde = new Date(anio, numeroMes - 1, 1);
  const hasta = new Date(anio, numeroMes, 1);

  return {
    desde: formatDate(desde),
    hasta: formatDate(hasta),
  };
}

async function handleResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    const text = await response.text();
    console.error(errorMessage, text);
    throw new Error(`${errorMessage}. Status: ${response.status}`);
  }
}

function crearParametrosPeriodo({ periodo, fecha, mes, anio }: FiltrosEstadisticas) {
  if (periodo === "anio") return new URLSearchParams({ periodo: "ANIO", anio: String(anio) });
  if (periodo === "mes") return new URLSearchParams({ periodo: "MES", mes });
  return new URLSearchParams({ periodo: periodo === "hoy" ? "DIA" : "ULTIMOS_7_DIAS", fecha });
}

export async function obtenerResumenEstadisticas(
  filtros: FiltrosEstadisticas,
  signal?: AbortSignal
): Promise<EstadisticaResumenDTO> {
  const params = filtros.periodo === "anio"
    ? crearParametrosPeriodo(filtros)
    : new URLSearchParams(obtenerRangoEstadistica(filtros.periodo, filtros.fecha, filtros.mes));

  const response = await apiFetch(
    `${API_URL}/api/v2/estadisticas/resumen?${params.toString()}`,
    { signal }
  );

  await handleResponse(response, "Error al obtener estadísticas");

  return await response.json();
}

export async function obtenerHoraPico(
  filtros: FiltrosEstadisticas,
  signal?: AbortSignal
): Promise<HoraPicoDTO> {
  const params = crearParametrosPeriodo(filtros);

  const response = await apiFetch(
    `${API_URL}/api/v2/estadisticas/hora-pico?${params.toString()}`,
    { headers: { Accept: "application/json" }, signal }
  );

  if (!response.ok) {
    throw await crearApiError(response, "No se pudo cargar la hora pico del negocio.");
  }

  return response.json();
}

export async function obtenerRankingClientes(
  filtros: FiltrosEstadisticas,
  signal?: AbortSignal
): Promise<ClientesRankingDTO> {
  const params = crearParametrosPeriodo(filtros);
  params.set("orden", "IMPORTE");
  params.set("limit", "5");
  const response = await apiFetch(
    `${API_URL}/api/v2/estadisticas/clientes-ranking?${params.toString()}`,
    { headers: { Accept: "application/json" }, signal }
  );
  if (!response.ok) {
    throw await crearApiError(response, "No se pudo cargar el ranking de clientes.");
  }
  return response.json();
}
