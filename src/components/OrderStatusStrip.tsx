import {
  Clock3,
  CookingPot,
  CheckCircle2,
  Ban,
  type LucideIcon,
} from "lucide-react";

import type { EstadoBackend } from "../services/pedidosApi";

import "../styles/orderStatusStrip.css";

type StatusItem = {
  key: EstadoBackend;
  title: string;
  subtitle: string;
  value: number;
  icon: LucideIcon;
};

type OrderStatusStripProps = {
  active: EstadoBackend;
  onChange: (estado: EstadoBackend) => void;
  counts: {
    pendientes: number;
    preparados: number;
    entregados: number;
    cancelados: number;
  };
};

function OrderStatusStrip({
  active,
  onChange,
  counts,
}: OrderStatusStripProps) {
  const items: StatusItem[] = [
    {
      key: "PENDIENTE",
      title: "Pendientes",
      subtitle: "Pedidos por preparar",
      value: counts.pendientes,
      icon: Clock3,
    },
    {
      key: "PREPARADO",
      title: "Preparados",
      subtitle: "Listos para entregar",
      value: counts.preparados,
      icon: CookingPot,
    },
    {
      key: "ENTREGADO",
      title: "Entregados",
      subtitle: "Finalizados",
      value: counts.entregados,
      icon: CheckCircle2,
    },
    {
      key: "CANCELADO",
      title: "Cancelados",
      subtitle: "Pedidos anulados",
      value: counts.cancelados,
      icon: Ban,
    },
  ];

  return (
    <section className="status-strip">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;

        return (
          <button
            key={item.key}
            type="button"
            className={`status-strip__item ${
              isActive ? "status-strip__item--active" : ""
            } status-strip__item--${item.key.toLowerCase()}`}
            onClick={() => onChange(item.key)}
          >
            <div className="status-strip__top">
              <div className="status-strip__icon">
                <Icon size={18} />
              </div>

              <span className="status-strip__state">
  {isActive ? "Filtrando" : "Filtrar"}
</span>
            </div>

            <div className="status-strip__body">
              <div className="status-strip__text">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>

              <div className="status-strip__value" key={item.value}>
                {item.value}
              </div>
            </div>

            <div className="status-strip__line" />
          </button>
        );
      })}
    </section>
  );
}

export default OrderStatusStrip;