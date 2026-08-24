import type { Pedido, EstadoPedidoFrontend } from "../components/PedidosTable";
import { API_URL } from "../config/api";

export type EstadoBackend =
  | "PENDIENTE"
  | "PREPARADO"
  | "ENTREGADO"
  | "CANCELADO";

export type TipoVentaBackend = "PARTICULAR" | "PEDIDOS_YA";
export type TipoPagoBackend = "EFECTIVO" | "TRANSFERENCIA" | "COMBINADO";

export type PedidoDetalleRequestDTO = {
  idVariedad: number;
  cantidad: number;
};

export type PedidoRequestDTO = {
  cliente: string;
  tipoVenta: TipoVentaBackend;
  tipoPago: TipoPagoBackend;
  numeroPedidoPedidosYa: string | null;
  horaEntrega: string | null;
  montoEfectivo: number;
  montoTransferencia: number;
  totalPedido: number;
  detalles: PedidoDetalleRequestDTO[];
};

type PedidoResponseDTO = {
  idPedido: number;
  cliente: string;
  tipoVenta: string;
  tipoPago: string;
  numeroPedidoPedidosYa: string | null;
  horaEntrega: string | null;
  totalPedido: number;
  estadoPedido: EstadoBackend;
  montoEfectivo?: number | null;
  montoTransferencia?: number | null;
};

type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type PedidoDetalleResponseDTO = {
  cliente: string;
  idVariedad: number;
  nombreVariedad: string;
  cantidad: number;
  subtotal: number;
  tipoVenta: TipoVentaBackend;
  tipoPago: TipoPagoBackend;
};

export type PedidoNotificacionDTO = {
  idPedido: number;
  cliente: string;
  horaEntrega: string | null;
  total: number;
};

function normalizarEstado(estado: EstadoBackend): EstadoPedidoFrontend {
  if (estado === "PREPARADO") return "Preparado";
  if (estado === "ENTREGADO") return "Entregado";
  if (estado === "CANCELADO") return "Cancelado";

  return "Pendiente";
}

function normalizarTipoVenta(tipoVenta: string): string {
  const value = tipoVenta?.toUpperCase();

  if (value === "PEDIDOS_YA" || value === "PEDIDOSYA" || value === "EMPRESA") {
    return "Pedidos Ya";
  }

  return "Particular";
}

function normalizarTipoPago(tipoPago: string): string {
  const value = tipoPago?.toUpperCase();

  if (value === "COMBINADO") {
    return "Combinado";
  }

  if (value === "TRANSFERENCIA") {
    return "Transferencia";
  }

  return "Efectivo";
}

function formatearHorario(horaEntrega: string | null): string {
  if (!horaEntrega) return "-";

  return horaEntrega.slice(0, 5);
}

function mapPedido(pedido: PedidoResponseDTO): Pedido {
  return {
    id: pedido.idPedido,
    cliente: pedido.cliente,
    tipoVenta: normalizarTipoVenta(pedido.tipoVenta),
    pago: normalizarTipoPago(pedido.tipoPago),
    horario: formatearHorario(pedido.horaEntrega),
    estado: normalizarEstado(pedido.estadoPedido),
    total: Number(pedido.totalPedido ?? 0),
    numeroPedidoPedidosYa: pedido.numeroPedidoPedidosYa,
    montoEfectivo: Number(pedido.montoEfectivo ?? 0),
    montoTransferencia: Number(pedido.montoTransferencia ?? 0),
  };
}

export async function obtenerPedidosPorEstado(
  estado: EstadoBackend,
  page = 0,
  size = 20
): Promise<Pedido[]> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/pedido-estado/${estado}?page=${page}&size=${size}`
  );

  if (!response.ok) {
    throw new Error(
      `Error al obtener pedidos ${estado}. Status: ${response.status}`
    );
  }

  const data: PageResponse<PedidoResponseDTO> = await response.json();

  return data.content.map(mapPedido);
}

export async function obtenerPedidosDelDia(): Promise<Pedido[]> {
  const [pendientes, preparados, entregados, cancelados] = await Promise.all([
    obtenerPedidosPorEstado("PENDIENTE"),
    obtenerPedidosPorEstado("PREPARADO"),
    obtenerPedidosPorEstado("ENTREGADO"),
    obtenerPedidosPorEstado("CANCELADO"),
  ]);

  return [...pendientes, ...preparados, ...entregados, ...cancelados];
}

export async function actualizarEstadoPedidoApi(
  idPedido: number,
  nuevoEstado: EstadoBackend
): Promise<boolean> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/actualizar-estado/${idPedido}/${nuevoEstado}`,
    {
      method: "PUT",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error al actualizar estado del pedido. Status: ${response.status}`
    );
  }

  return await response.json();
}

export async function crearPedidoApi(
  pedido: PedidoRequestDTO
): Promise<Pedido> {
  const response = await fetch(`${API_URL}/api/v2/pedido/crear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pedido),
  });

  if (!response.ok) {
    throw new Error(`Error al crear pedido. Status: ${response.status}`);
  }

  const data: PedidoResponseDTO = await response.json();

  return mapPedido(data);
}

export async function actualizarPedidoApi(
  idPedido: number,
  pedido: PedidoRequestDTO
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/actualizar/${idPedido}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pedido),
    }
  );

  if (!response.ok) {
    throw new Error(`Error al actualizar pedido. Status: ${response.status}`);
  }
}

export async function obtenerDetallePedidoApi(
  idPedido: number
): Promise<Pedido["items"]> {
  const response = await fetch(`${API_URL}/api/v2/pedido/detalle/${idPedido}`);

  if (!response.ok) {
    throw new Error(
      `Error al obtener detalle del pedido. Status: ${response.status}`
    );
  }

  const data: PedidoDetalleResponseDTO[] = await response.json();

  return data.map((item) => ({
    idVariedad: Number(item.idVariedad),
    nombre: item.nombreVariedad,
    cantidad: Number(item.cantidad ?? 0),
    subtotal: Number(item.subtotal ?? 0),
  }));
}

export async function obtenerPedidosPendientesNotificacion(): Promise<
  PedidoNotificacionDTO[]
> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/pedido-estado/PENDIENTE?page=0&size=20`
  );

  if (!response.ok) {
    throw new Error(
      `Error al obtener pedidos pendientes. Status: ${response.status}`
    );
  }

  const data: PageResponse<PedidoResponseDTO> = await response.json();

  return data.content.map((pedido) => ({
    idPedido: pedido.idPedido,
    cliente: pedido.cliente,
    horaEntrega: formatearHorario(pedido.horaEntrega),
    total: Number(pedido.totalPedido ?? 0),
  }));
}

export async function actualizarTipoPagoPedidoApi(
  idPedido: number,
  nuevoPago: TipoPagoBackend
): Promise<boolean> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/actualizar-pago/${idPedido}/${nuevoPago}`,
    {
      method: "PUT",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error al actualizar el pago del pedido. Status: ${response.status}`
    );
  }

  return await response.json();
}
