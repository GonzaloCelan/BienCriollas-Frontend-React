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

export type PaginaPedidos = {
  pedidos: Pedido[];
  totalElements: number;
  totalPages: number;
  page: number;
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

export async function obtenerPaginaPedidosPorEstado(
  estado: EstadoBackend,
  page = 0,
  size = 20
): Promise<PaginaPedidos> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/pedido-estado/${estado}?page=${page}&size=${size}`
  );

  if (!response.ok) {
    throw new Error(
      `Error al obtener pedidos ${estado}. Status: ${response.status}`
    );
  }

  const data: PageResponse<PedidoResponseDTO> = await response.json();

  return {
    pedidos: data.content.map(mapPedido),
    totalElements: data.totalElements,
    totalPages: data.totalPages,
    page: data.number,
    size: data.size,
  };
}

export async function obtenerPedidosPorEstado(
  estado: EstadoBackend,
  page = 0,
  size = 20
): Promise<Pedido[]> {
  const pagina = await obtenerPaginaPedidosPorEstado(estado, page, size);
  return pagina.pedidos;
}

export async function obtenerTodosLosPedidosPorEstado(
  estado: EstadoBackend,
  size = 50
): Promise<{ pedidos: Pedido[]; totalElements: number }> {
  const primeraPagina = await obtenerPaginaPedidosPorEstado(estado, 0, size);

  if (primeraPagina.totalPages <= 1) {
    return {
      pedidos: primeraPagina.pedidos,
      totalElements: primeraPagina.totalElements,
    };
  }

  const paginasRestantes = await Promise.all(
    Array.from({ length: primeraPagina.totalPages - 1 }, (_, index) =>
      obtenerPaginaPedidosPorEstado(estado, index + 1, size)
    )
  );

  return {
    pedidos: [
      ...primeraPagina.pedidos,
      ...paginasRestantes.flatMap((pagina) => pagina.pedidos),
    ],
    totalElements: primeraPagina.totalElements,
  };
}

export async function obtenerPedidosDelDia(): Promise<Pedido[]> {
  const [pendientes, preparados, entregados, cancelados] = await Promise.all([
    obtenerTodosLosPedidosPorEstado("PENDIENTE"),
    obtenerTodosLosPedidosPorEstado("PREPARADO"),
    obtenerTodosLosPedidosPorEstado("ENTREGADO"),
    obtenerTodosLosPedidosPorEstado("CANCELADO"),
  ]);

  return [
    ...pendientes.pedidos,
    ...preparados.pedidos,
    ...entregados.pedidos,
    ...cancelados.pedidos,
  ];
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
  const data = await obtenerTodosLosPedidosPorEstado("PENDIENTE");

  return data.pedidos.map((pedido) => ({
	    idPedido: pedido.id,
	    cliente: pedido.cliente,
	    horaEntrega: pedido.horario,
	    total: Number(pedido.total ?? 0),
  }));
}

export async function actualizarTipoPagoPedidoApi(
  idPedido: number,
  nuevoPago: TipoPagoBackend,
  montos?: { montoEfectivo: number; montoTransferencia: number }
): Promise<boolean> {
  const response = await fetch(
    `${API_URL}/api/v2/pedido/actualizar-pago/${idPedido}/${nuevoPago}`,
    {
      method: "PUT",
      headers: montos ? { "Content-Type": "application/json" } : undefined,
      body: montos ? JSON.stringify(montos) : undefined,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error al actualizar el pago del pedido. Status: ${response.status}`
    );
  }

  return await response.json();
}
