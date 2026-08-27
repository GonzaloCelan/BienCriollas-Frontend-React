import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { BACKEND_URL } from "../config/api";
import type { EstadoBackend } from "../services/pedidosApi";
import { obtenerAccessToken } from "../services/httpClient";

export type PedidoEventoTipo = "CREADO" | "ACTUALIZADO" | "CANCELADO";

export type PedidoEvento = {
  tipo: PedidoEventoTipo;
  idPedido: number;
  estado: EstadoBackend;
};

function esPedidoEvento(value: unknown): value is PedidoEvento {
  if (!value || typeof value !== "object") return false;

  const evento = value as Partial<PedidoEvento>;
  const tiposValidos: PedidoEventoTipo[] = [
    "CREADO",
    "ACTUALIZADO",
    "CANCELADO",
  ];
  const estadosValidos: EstadoBackend[] = [
    "PENDIENTE",
    "PREPARADO",
    "ENTREGADO",
    "CANCELADO",
  ];

  return (
    typeof evento.idPedido === "number" &&
    tiposValidos.includes(evento.tipo as PedidoEventoTipo) &&
    estadosValidos.includes(evento.estado as EstadoBackend)
  );
}

export function usePedidosRealtime(
  onEvento: (evento: PedidoEvento) => void
) {
  const onEventoRef = useRef(onEvento);

  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    const token = obtenerAccessToken();

    if (!BACKEND_URL || !token) {
      console.error("No se puede conectar el WebSocket sin URL y sesión activa.");
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${BACKEND_URL}/ws`),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      console.info("WebSocket de pedidos conectado");

      client.subscribe("/topic/pedidos", (mensaje) => {
        try {
          const evento: unknown = JSON.parse(mensaje.body);

          if (!esPedidoEvento(evento)) {
            console.error("Evento de pedido inválido", evento);
            return;
          }

          onEventoRef.current(evento);
        } catch (error) {
          console.error("Evento de pedido inválido", error);
        }
      });
    };

    client.onStompError = (frame) => {
      console.error("Error STOMP", frame.headers.message);
    };

    client.onWebSocketError = (error) => {
      console.error("Error de conexión WebSocket", error);
    };

    client.activate();

    return () => {
      void client.deactivate();
    };
  }, []);
}
