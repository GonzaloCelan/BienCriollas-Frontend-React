const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type PeriodoIngreso = "hoy" | "ultimos7" | "mes";

export type IngresoPorDiaDTO = {
  fecha: string;
  efectivo: number;
  transferencia: number;
  pedidosYaEstimado: number;
  total: number;
};

export type DistribucionIngresoDTO = {
  tipo: string;
  monto: number;
  porcentaje: number;
};

export type MovimientoIngresoDTO = {
  id: number;
  idPedido: number | null;
  fecha: string;
  fechaHora: string | null;
  descripcion: string;
  tipoVenta: string;
  medioPago: string;
  monto: number;
  estadoIngreso: "COBRADO" | "PENDIENTE_LIQUIDACION" | "LIQUIDACION_RECIBIDA";
  origen: "PEDIDO" | "LIQUIDACION_PEDIDOS_YA";
};

export type IngresoResumenDTO = {
  efectivo: number;
  transferencia: number;
  pedidosYaEstimado: number;
  liquidacionesPedidosYa: number;
  totalRealRecibido: number;
  acumuladoPeriodo: number;
  cantidadPedidosParticulares: number;
  cantidadPedidosYa: number;
  ingresosPorDia: IngresoPorDiaDTO[];
  distribucion: DistribucionIngresoDTO[];
  movimientos: MovimientoIngresoDTO[];
};

export type LiquidacionPedidosYaRequest = {
  fecha: string;
  monto: number;
  descripcion: string;
};

function formatDate(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

export function obtenerRangoIngreso(
  periodo: PeriodoIngreso,
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

export async function obtenerResumenIngresos(
  desde: string,
  hasta: string
): Promise<IngresoResumenDTO> {
  const params = new URLSearchParams({
    desde,
    hasta,
  });

  const response = await fetch(
    `${API_URL}/api/v2/ingresos/resumen?${params.toString()}`
  );

  await handleResponse(response, "Error al obtener ingresos");

  return await response.json();
}

export async function registrarLiquidacionPedidosYa(
  request: LiquidacionPedidosYaRequest
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/v2/ingresos/liquidaciones-pedidos-ya`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  await handleResponse(response, "Error al registrar liquidación Pedidos Ya");
}