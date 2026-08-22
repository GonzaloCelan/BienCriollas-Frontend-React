import emptyOrdersAnimation from "../assets/lotties/empty_order.json";
import LottieAnimation from "./LottieAnimation";

import type { EstadoBackend } from "../services/pedidosApi";

import "../styles/ordersStates.css";

type OrdersEmptyStateProps = {
  estado: EstadoBackend;
};

const mensajes: Record<
  EstadoBackend,
  {
    titulo: string;
    descripcion: string;
  }
> = {
  PENDIENTE: {
    titulo: "No hay pedidos pendientes",
    descripcion: "Cuando ingresen nuevos pedidos, aparecerán en esta tabla.",
  },
  PREPARADO: {
    titulo: "No hay pedidos preparados",
    descripcion: "Los pedidos listos para entregar aparecerán acá.",
  },
  ENTREGADO: {
    titulo: "No hay pedidos entregados",
    descripcion: "Todavía no se registraron pedidos entregados en esta vista.",
  },
  CANCELADO: {
    titulo: "No hay pedidos cancelados",
    descripcion: "Los pedidos cancelados aparecerán en esta sección.",
  },
};

function OrdersEmptyState({ estado }: OrdersEmptyStateProps) {
  const contenido = mensajes[estado];

  return (
    <div className="orders-state orders-state--empty">
      <div className="orders-state__animation">
        <LottieAnimation
          animationData={emptyOrdersAnimation}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <h3>{contenido.titulo}</h3>
      <p>{contenido.descripcion}</p>
    </div>
  );
}

export default OrdersEmptyState;
