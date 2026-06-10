import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CreditCard,
  PackageCheck,
  ReceiptText,
  Trophy,
  Truck,
  AlertTriangle,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import Kpi from "../components/Kpi";

import {
  obtenerResumenEstadisticas,
  obtenerRangoEstadistica,
  type EstadisticaResumenDTO,
  type PeriodoEstadistica,
  type VentaDiaSemanaDTO,
} from "../services/estadisticasApi";

import "../styles/estadisticas.css";

type RankingViewItem = {
  puesto: number;
  nombre: string;
  cantidad: number;
  porcentaje: number;
};

type MermaViewItem = {
  nombre: string;
  cantidad: number;
  porcentaje: number;
};

type TooltipData = {
  x: number;
  y: number;
  item: VentaDiaSemanaDTO;
} | null;

function getTodayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function getCurrentMonthISO() {
  return getTodayISO().slice(0, 7);
}

function safeNumber(value?: number | null) {
  return Number(value ?? 0);
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatPercent(value?: number | null) {
  return `${Math.round(safeNumber(value))}%`;
}

function calcularPorcentaje(cantidad: number, total: number) {
  return total > 0 ? Math.round((cantidad / total) * 100) : 0;
}

function buildRanking(data?: EstadisticaResumenDTO | null): RankingViewItem[] {
  const items = data?.rankingVariedades ?? [];
  const topItems = items.slice(0, 8);

  const total = topItems.reduce(
    (acc, item) => acc + safeNumber(item.unidadesVendidas),
    0
  );

  return topItems.map((item, index) => {
    const cantidad = safeNumber(item.unidadesVendidas);

    return {
      puesto: index + 1,
      nombre: item.nombre,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    };
  });
}

function buildMermas(data?: EstadisticaResumenDTO | null): MermaViewItem[] {
  const items = data?.mermasPorVariedad ?? [];
  const topItems = items.slice(0, 6);

  const total = topItems.reduce(
    (acc, item) => acc + safeNumber(item.unidadesPerdidas),
    0
  );

  return topItems.map((item) => {
    const cantidad = safeNumber(item.unidadesPerdidas);

    return {
      nombre: item.nombre,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    };
  });
}

function normalizeDayLabel(nombreDia: string) {
  const map: Record<string, string> = {
    Lunes: "Lun",
    Martes: "Mar",
    Miércoles: "Mié",
    Jueves: "Jue",
    Viernes: "Vie",
    Sábado: "Sáb",
    Domingo: "Dom",
  };

  return map[nombreDia] ?? nombreDia.slice(0, 3);
}

function LineChartVentas({ data }: { data: VentaDiaSemanaDTO[] }) {
  const [tooltip, setTooltip] = useState<TooltipData>(null);

  const width = 620;
const height = 300;
const paddingX = 28;
const paddingY = 24;

  const maxValue = Math.max(
    ...data.map((item) => safeNumber(item.unidadesVendidas)),
    1
  );

  const points = data.map((item, index) => {
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const x =
      data.length === 1
        ? width / 2
        : paddingX + (index / (data.length - 1)) * usableWidth;

    const y =
      height -
      paddingY -
      (safeNumber(item.unidadesVendidas) / maxValue) * usableHeight;

    return {
      x,
      y,
      item,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${
          height - paddingY
        } L ${points[0].x} ${height - paddingY} Z`
      : "";

  if (data.length === 0) {
    return (
      <div className="stats-empty-card">
        No hay ventas para comparar días.
      </div>
    );
  }

  return (
    <div className="stats-line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="stats-line-chart__svg"
        role="img"
      >
        <defs>
          <linearGradient id="salesAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(239, 35, 60, 0.22)" />
            <stop offset="100%" stopColor="rgba(239, 35, 60, 0.02)" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = paddingY + step * (height - paddingY * 2);

          return (
            <line
              key={step}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              className="stats-line-chart__grid"
            />
          );
        })}

        {areaPath && <path className="stats-line-chart__area" d={areaPath} />}

        {linePath && <path className="stats-line-chart__line" d={linePath} />}

        {points.map((point) => (
          <g key={point.item.diaSemana}>
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              className="stats-line-chart__point"
            />

            <circle
              cx={point.x}
              cy={point.y}
              r="20"
              className="stats-line-chart__hover-zone"
              onMouseEnter={() => setTooltip(point)}
              onMouseMove={() => setTooltip(point)}
              onMouseLeave={() => setTooltip(null)}
            />

            <text
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              className="stats-line-chart__label"
            >
              {normalizeDayLabel(point.item.nombreDia)}
            </text>
          </g>
        ))}
      </svg>

      {tooltip && (
        <div
          className="stats-line-tooltip"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
          }}
        >
          <strong>{tooltip.item.nombreDia}</strong>

          <span>
            <b>{tooltip.item.unidadesVendidas}</b> unidades vendidas
          </span>

          <span>
            <b>{tooltip.item.cantidadPedidos}</b> pedidos entregados
          </span>

          <span>
            Total vendido: <b>{formatMoney(tooltip.item.totalVendido)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function StatsSkeletonCard() {
  return (
    <div className="stats-skeleton-card">
      <span />
      <span />
      <span />
    </div>
  );
}

function Estadisticas() {
  const [periodo, setPeriodo] = useState<PeriodoEstadistica>("hoy");
  const [fecha, setFecha] = useState(getTodayISO());
  const [mesSeleccionado, setMesSeleccionado] = useState(getCurrentMonthISO());
  const [estadistica, setEstadistica] =
    useState<EstadisticaResumenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargarEstadisticas() {
    try {
      setLoading(true);
      setError("");

      const { desde, hasta } = obtenerRangoEstadistica(
        periodo,
        fecha,
        mesSeleccionado
      );

      const data = await obtenerResumenEstadisticas(desde, hasta);

      setEstadistica(data);
    } catch (error) {
      console.error(error);
      setError("No se pudieron cargar las estadísticas.");
      setEstadistica(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarEstadisticas();
  }, [periodo, fecha, mesSeleccionado]);

  const rankingVariedades = useMemo(
    () => buildRanking(estadistica),
    [estadistica]
  );

  const mermasPorVariedad = useMemo(
    () => buildMermas(estadistica),
    [estadistica]
  );

  const ventasPorDiaSemana = estadistica?.ventasPorDiaSemana ?? [];
  const tiposVenta = estadistica?.tiposVenta ?? [];
  const mediosPago = estadistica?.mediosPago ?? [];

  const pedidosEntregados = safeNumber(estadistica?.pedidosEntregados);
  const empanadasVendidas = safeNumber(estadistica?.empanadasVendidas);
  const ticketPromedio = safeNumber(estadistica?.ticketPromedio);

  const particular = tiposVenta.find(
    (item) => item.tipoVenta?.toUpperCase() === "PARTICULAR"
  );

  const pedidosYa = tiposVenta.find(
    (item) => item.tipoVenta?.toUpperCase() === "PEDIDOS_YA"
  );

  const cantidadParticular = safeNumber(particular?.cantidadPedidos);
  const cantidadPedidosYa = safeNumber(pedidosYa?.cantidadPedidos);
  const totalTiposVenta = cantidadParticular + cantidadPedidosYa;

  const porcentajeParticular =
    particular?.porcentaje ??
    calcularPorcentaje(cantidadParticular, totalTiposVenta);

  const porcentajePedidosYa =
    pedidosYa?.porcentaje ??
    calcularPorcentaje(cantidadPedidosYa, totalTiposVenta);

  const efectivo = mediosPago.find(
    (item) => item.medioPago?.toUpperCase() === "EFECTIVO"
  );

  const transferencia = mediosPago.find(
    (item) => item.medioPago?.toUpperCase() === "TRANSFERENCIA"
  );

  const combinado = mediosPago.find(
    (item) => item.medioPago?.toUpperCase() === "COMBINADO"
  );

  const cantidadEfectivo = safeNumber(efectivo?.cantidadPedidos);
  const cantidadTransferencia = safeNumber(transferencia?.cantidadPedidos);
  const cantidadCombinado = safeNumber(combinado?.cantidadPedidos);
  const totalMediosPago =
    cantidadEfectivo + cantidadTransferencia + cantidadCombinado;

  const porcentajeEfectivo =
    efectivo?.porcentaje ??
    calcularPorcentaje(cantidadEfectivo, totalMediosPago);

  const porcentajeTransferencia =
    transferencia?.porcentaje ??
    calcularPorcentaje(cantidadTransferencia, totalMediosPago);

  const porcentajeCombinado =
    combinado?.porcentaje ??
    calcularPorcentaje(cantidadCombinado, totalMediosPago);

  return (
    <section className="stats-page">
      <header className="stats-hero">
        <div className="stats-hero__left">
          

          <div>
            <p className="stats-eyebrow">Estadísticas</p>
            <h2>Análisis comercial</h2>
            <span>Ventas, variedades, canales y comportamiento semanal.</span>
          </div>
        </div>

        <div className="stats-filters">
  <div className="stats-range-actions">
    <button
      type="button"
      className={periodo === "hoy" ? "active" : ""}
      onClick={() => setPeriodo("hoy")}
    >
      Día
    </button>

    <button
      type="button"
      className={periodo === "ultimos7" ? "active" : ""}
      onClick={() => setPeriodo("ultimos7")}
    >
      Últimos 7 días
    </button>

    <button
      type="button"
      className={periodo === "mes" ? "active" : ""}
      onClick={() => setPeriodo("mes")}
    >
      Mes
    </button>
  </div>

  <div className="stats-filter-group">
    <small>Buscar día</small>

    <label className="stats-date-btn">
      <CalendarDays size={15} />

      <input
        type="date"
        value={fecha}
        onChange={(event) => {
          setFecha(event.target.value);
          setPeriodo("hoy");
        }}
      />

      <ChevronDown size={15} />
    </label>
  </div>

  <div className="stats-filter-group">
    <small>Buscar mes</small>

    <label className="stats-date-btn">
      <CalendarDays size={15} />

      <input
        type="month"
        value={mesSeleccionado}
        onChange={(event) => {
          setMesSeleccionado(event.target.value);
          setPeriodo("mes");
        }}
      />

      <ChevronDown size={15} />
    </label>
  </div>
</div>
      </header>

      {error && <div className="stats-error">{error}</div>}

      <section className="stats-kpis">
        <Kpi
          title="Pedidos entregados"
          value={loading ? "..." : pedidosEntregados}
          subtitle="Pedidos completados"
          icon={<PackageCheck size={20} />}
        />

        <Kpi
          title="Empanadas vendidas"
          value={loading ? "..." : empanadasVendidas}
          subtitle="Unidades vendidas"
          icon={<BarChart3 size={20} />}
        />

        <Kpi
          title="Ticket promedio"
          value={loading ? "..." : formatMoney(ticketPromedio)}
          subtitle="Promedio por pedido"
          icon={<ReceiptText size={20} />}
        />

        <Kpi
          title="Variedad más vendida"
          value={
            loading
              ? "..."
              : estadistica?.variedadMasVendida?.nombre ?? "Sin datos"
          }
          subtitle={
            loading
              ? "Calculando..."
              : estadistica?.variedadMasVendida
              ? `${estadistica.variedadMasVendida.unidadesVendidas} unidades`
              : "Sin ventas"
          }
          icon={<Trophy size={20} />}
        />
      </section>

      <section className="stats-feature-grid">
        <article className="stats-card stats-ranking-card">
          <header className="stats-card__header">
            <div>
              <h3>Ranking de variedades</h3>
              <span>Top variedades vendidas del período</span>
            </div>

            <button type="button" className="stats-mini-select">
              Unidades
              <ChevronDown size={14} />
            </button>
          </header>

          {loading ? (
            <StatsSkeletonCard />
          ) : rankingVariedades.length > 0 ? (
            <div className="stats-ranking-premium">
              {rankingVariedades.map((item, index) => (
                <div
                  className="stats-ranking-premium__row"
                  key={item.nombre}
                  style={{ animationDelay: `${index * 0.055}s` }}
                >
                  <div className="stats-ranking-premium__main">
                    <span
                      className={`stats-ranking-premium__position ${
                        item.puesto === 1 ? "is-first" : ""
                      }`}
                    >
                      {item.puesto}
                    </span>

                    <div>
                      <strong>{item.nombre}</strong>
                      <small>{item.cantidad} unidades</small>
                    </div>
                  </div>

                  <div className="stats-ranking-premium__track">
                    <span style={{ width: `${item.porcentaje}%` }} />
                  </div>

                  <b>{item.porcentaje}%</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="stats-empty-card">
              No hay ventas de variedades para este período.
            </div>
          )}
        </article>

        <article className="stats-card stats-week-card">
          <header className="stats-card__header">
            <div>
              <h3>Ventas por día de la semana</h3>
              <span>Picos de venta y comportamiento semanal</span>
            </div>

            <div className="stats-card__small-icon">
              <BarChart3 size={18} />
            </div>
          </header>

          {loading ? (
            <StatsSkeletonCard />
          ) : (
            <LineChartVentas data={ventasPorDiaSemana} />
          )}
        </article>
      </section>

      <section className="stats-secondary-grid">
        <article className="stats-card stats-channel-card">
          <header className="stats-card__header">
            <div>
              <h3>Tipo de venta</h3>
              <span>Participación por canal</span>
            </div>

            <div className="stats-card__small-icon">
              <Truck size={18} />
            </div>
          </header>

          {loading ? (
            <StatsSkeletonCard />
          ) : (
            <>
              <div
                className="stats-channel-bar"
                style={{
                  gridTemplateColumns:
                    totalTiposVenta > 0
                      ? `${Math.max(Number(porcentajeParticular), 8)}fr ${Math.max(
                          Number(porcentajePedidosYa),
                          8
                        )}fr`
                      : "1fr 1fr",
                }}
              >
                <div className="stats-channel-bar__particular">
                  <strong>{cantidadParticular}</strong>
                  <span>{formatPercent(porcentajeParticular)}</span>
                </div>

                <div className="stats-channel-bar__pya">
                  <strong>{cantidadPedidosYa}</strong>
                  <span>{formatPercent(porcentajePedidosYa)}</span>
                </div>
              </div>

              <div className="stats-channel-legend">
                <span>
                  <b className="dot dot-red" />
                  Particular
                </span>

                <span>
                  <b className="dot dot-soft" />
                  Pedidos Ya
                </span>
              </div>
            </>
          )}
        </article>

        <article className="stats-card stats-payment-card">
          <header className="stats-card__header">
            <div>
              <h3>Medios de pago</h3>
              <span>Distribución por cantidad de pedidos</span>
            </div>

            <div className="stats-card__small-icon">
              <CreditCard size={18} />
            </div>
          </header>

          {loading ? (
            <StatsSkeletonCard />
          ) : (
            <div className="stats-payment-body">
              <div
                className="stats-donut"
                style={{
                  background: `conic-gradient(
                    #ef233c 0 ${Number(porcentajeEfectivo)}%,
                    #f7a8b1 ${Number(porcentajeEfectivo)}% ${
                    Number(porcentajeEfectivo) +
                    Number(porcentajeTransferencia)
                  }%,
                    #f4c4cc ${
                      Number(porcentajeEfectivo) +
                      Number(porcentajeTransferencia)
                    }% 100%
                  )`,
                }}
              >
                <div>
                  <strong>{totalMediosPago}</strong>
                  <span>Pedidos</span>
                </div>
              </div>

              <div className="stats-legend">
                <div>
                  <span className="dot dot-red" />
                  <strong>Efectivo</strong>
                  <b>{cantidadEfectivo} pedidos</b>
                  <small>{formatPercent(porcentajeEfectivo)}</small>
                </div>

                <div>
                  <span className="dot dot-soft" />
                  <strong>Transferencia</strong>
                  <b>{cantidadTransferencia} pedidos</b>
                  <small>{formatPercent(porcentajeTransferencia)}</small>
                </div>

                {cantidadCombinado > 0 && (
                  <div>
                    <span className="dot dot-pale" />
                    <strong>Combinado</strong>
                    <b>{cantidadCombinado} pedidos</b>
                    <small>{formatPercent(porcentajeCombinado)}</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </article>

        <article className="stats-card stats-loss-card">
          <header className="stats-card__header">
            <div>
              <h3>Mermas por variedad</h3>
              <span>Unidades perdidas por variedad</span>
            </div>

            <div className="stats-card__small-icon">
              <AlertTriangle size={18} />
            </div>
          </header>

          {loading ? (
            <StatsSkeletonCard />
          ) : mermasPorVariedad.length > 0 ? (
            <div className="stats-loss-list">
              {mermasPorVariedad.map((item, index) => (
                <div
                  className="stats-loss-row"
                  key={item.nombre}
                  style={{ animationDelay: `${index * 0.055}s` }}
                >
                  <span>{item.nombre}</span>

                  <div className="stats-loss-row__bar">
                    <b style={{ width: `${item.porcentaje}%` }} />
                  </div>

                  <strong>{item.cantidad}</strong>
                  <small>{item.porcentaje}%</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="stats-empty-card">
              No hay mermas cargadas para este período.
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

export default Estadisticas;