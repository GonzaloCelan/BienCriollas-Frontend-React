const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type PeriodoEstadistica = "hoy" | "ultimos7" | "mes";

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
  mesSeleccionado?: string
): {
  desde: string;
  hasta: string;
} {
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
    const hoy = new Date();

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

export async function obtenerResumenEstadisticas(
  desde: string,
  hasta: string
): Promise<EstadisticaResumenDTO> {
  const params = new URLSearchParams({
    desde,
    hasta,
  });

  const response = await fetch(
    `${API_URL}/api/v2/estadisticas/resumen?${params.toString()}`
  );

  await handleResponse(response, "Error al obtener estadísticas");

  return await response.json();
}