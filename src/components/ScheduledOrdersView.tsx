import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Eye,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

import type { Pedido } from "./PedidosTable";
import OrderDetailDrawer from "./OrderDetailDrawer";
import type { ScheduledOrdersSummary } from "../services/pedidosApi";

import "../styles/scheduledOrders.css";

type ScheduledOrdersViewProps = {
  pedidos: Pedido[];
  summary: ScheduledOrdersSummary;
  loading: boolean;
  error: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onClearDate: () => void;
  onEdit: (pedido: Pedido) => void | Promise<void>;
  onCancel: (idPedido: number) => void;
  onLoadDetail: (idPedido: number) => Promise<Pedido["items"]>;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupLabel(value: string) {
  const date = parseDateOnly(value);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const prefix = localDateValue(tomorrow) === value ? "Mañana · " : "";
  const formatted = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return `${prefix}${formatted}`;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function totalUnits(pedido: Pedido) {
  return (pedido.items ?? []).reduce((total, item) => total + item.cantidad, 0);
}

export default function ScheduledOrdersView({
  pedidos,
  summary,
  loading,
  error,
  selectedDate,
  onDateChange,
  onClearDate,
  onEdit,
  onCancel,
  onLoadDetail,
}: ScheduledOrdersViewProps) {
  const [search, setSearch] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [detailItems, setDetailItems] = useState<Pedido["items"]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-AR");
    const filtered = query
      ? pedidos.filter((pedido) =>
          pedido.cliente.toLocaleLowerCase("es-AR").includes(query)
        )
      : pedidos;
    return filtered.reduce<Record<string, Pedido[]>>((result, pedido) => {
      const date = pedido.fechaEntrega ?? "Sin fecha";
      (result[date] ??= []).push(pedido);
      return result;
    }, {});
  }, [pedidos, search]);

  async function openDetail(pedido: Pedido) {
    setSelectedPedido(pedido);
    setDetailItems([]);
    setDetailLoading(true);
    try {
      setDetailItems((await onLoadDetail(pedido.id)) ?? []);
    } catch (detailError) {
      console.error(detailError);
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="scheduled-view">
      <section className="scheduled-summary">
        <header>
          <span><CalendarClock size={20} /></span>
          <div>
            <small>Pedidos programados</small>
            <h3>{summary.totalPedidosProgramados} próximos pedidos</h3>
            <p>Encargos registrados para los próximos días.</p>
          </div>
        </header>
        <div>
          <article><small>Para hoy</small><strong>{summary.pedidosParaHoy}</strong></article>
          <article><small>Para mañana</small><strong>{summary.pedidosParaManana}</strong></article>
          <article><small>Empanadas comprometidas</small><strong>{summary.totalUnidadesComprometidas}</strong></article>
        </div>
      </section>

      <section className="scheduled-toolbar">
        <label>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente..."
          />
        </label>
        <div>
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
            aria-label="Filtrar programados por fecha"
          />
          {selectedDate && <button type="button" onClick={onClearDate}>Limpiar</button>}
        </div>
      </section>

      {error && <div className="scheduled-error"><AlertTriangle size={17} />{error}</div>}

      {loading ? (
        <div className="scheduled-loading">Cargando pedidos programados…</div>
      ) : Object.keys(groups).length ? (
        <div className="scheduled-groups">
          {Object.entries(groups).map(([date, dateOrders], groupIndex) => (
            <section className="scheduled-group" key={date} style={{ animationDelay: `${groupIndex * 0.05}s` }}>
              <header>
                <span>{date === "Sin fecha" ? date : groupLabel(date)}</span>
                <strong>{dateOrders.length} {dateOrders.length === 1 ? "pedido" : "pedidos"}</strong>
              </header>
              <div className="scheduled-list">
                {dateOrders.map((pedido, index) => (
                  <article className="scheduled-order" key={pedido.id} style={{ animationDelay: `${index * 0.045}s` }}>
                    <div className="scheduled-order__time">
                      <span><CalendarClock size={14} /> Programado</span>
                      <strong>{pedido.horario === "-" ? "Sin hora" : pedido.horario.slice(0, 5)}</strong>
                    </div>
                    <div className="scheduled-order__client">
                      <strong>{pedido.cliente || "Sin cliente"}</strong>
                      <span>Pedido #{pedido.id} · {pedido.tipoVenta}</span>
                    </div>
                    <div className="scheduled-order__facts">
                      <span><strong>{totalUnits(pedido)}</strong> empanadas</span>
                      <span><strong>{money(pedido.total)}</strong> total</span>
                    </div>
                    <div className="scheduled-order__status">
                      <span>{pedido.estado}</span>
                      <small>{pedido.stockDiscounted ? "Stock descontado" : "Stock reservado"}</small>
                    </div>
                    <div className="scheduled-order__actions">
                      <button type="button" onClick={() => void openDetail(pedido)} aria-label={`Ver pedido ${pedido.id}`}><Eye size={15} /></button>
                      <button type="button" onClick={() => void onEdit(pedido)} aria-label={`Editar pedido ${pedido.id}`}><Pencil size={15} /></button>
                      <button type="button" className="danger" onClick={() => onCancel(pedido.id)} aria-label={`Cancelar pedido ${pedido.id}`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="scheduled-empty">
          <span><CalendarClock size={28} /></span>
          <h3>No hay pedidos programados.</h3>
          <p>Los pedidos para fechas futuras aparecerán acá.</p>
        </section>
      )}

      <OrderDetailDrawer
        pedido={selectedPedido}
        items={detailLoading ? [] : detailItems}
        totalItems={
          detailLoading
            ? 0
            : (detailItems ?? []).reduce((total, item) => total + item.cantidad, 0)
        }
        onClose={() => setSelectedPedido(null)}
      />
    </div>
  );
}
