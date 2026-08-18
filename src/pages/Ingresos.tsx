import {
  Banknote,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Filter,
  PlusCircle,
  Search,
} from "lucide-react";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import "../styles/ingresos.css";

import Kpi from "../components/Kpi";
import AppConfirmDialog from "../components/AppConfirmDialog";
import AnimatedNumber from "../components/AnimatedNumber";

import {
  obtenerResumenIngresos,
  obtenerRangoIngreso,
  registrarLiquidacionPedidosYa,
  type IngresoResumenDTO,
  type MovimientoIngresoDTO,
  type PeriodoIngreso,
} from "../services/ingresosApi";

type FiltroTipo =
  | "TODOS"
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "PEDIDOS_YA"
  | "LIQUIDACION";

const ITEMS_POR_PAGINA = 10;

function getTodayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function getCurrentMonthISO() {
  return getTodayISO().slice(0, 7);
}

function formatDateISO(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function obtenerMesBase(
  periodo: PeriodoIngreso,
  fechaSeleccionada: string,
  mesSeleccionado: string
) {
  if (periodo === "mes") {
    return mesSeleccionado;
  }

  if (periodo === "hoy") {
    return fechaSeleccionada.slice(0, 7);
  }

  return getTodayISO().slice(0, 7);
}

function obtenerRangoMes(mesISO: string) {
  const [anio, mes] = mesISO.split("-").map(Number);

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  return {
    desde: formatDateISO(desde),
    hasta: formatDateISO(hasta),
  };
}

function obtenerNombreMes(mesISO: string) {
  const [anio, mes] = mesISO.split("-").map(Number);

  const nombre = new Intl.DateTimeFormat("es-AR", {
    month: "long",
  }).format(new Date(anio, mes - 1, 1));

  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
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

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizarTipoVenta(tipoVenta: string) {
  const value = tipoVenta?.toUpperCase();

  if (value === "PEDIDOS_YA") return "Pedidos Ya";

  return "Particular";
}

function normalizarMedioPago(medioPago: string) {
  const value = medioPago?.toUpperCase();

  if (value === "EFECTIVO") return "Efectivo";
  if (value === "TRANSFERENCIA") return "Transferencia";
  if (value === "PEDIDOS_YA") return "Pedidos Ya";
  if (value === "LIQUIDACION") return "Liquidación";

  return medioPago || "-";
}

function normalizarEstadoIngreso(estado: MovimientoIngresoDTO["estadoIngreso"]) {
  if (estado === "COBRADO") return "Cobrado";
  if (estado === "LIQUIDACION_RECIBIDA") return "Liquidación recibida";

  return "Pendiente liquidación";
}

function getTipoClass(movimiento: MovimientoIngresoDTO) {
  if (movimiento.origen === "LIQUIDACION_PEDIDOS_YA") {
    return "income-pill--py";
  }

  const medio = movimiento.medioPago?.toUpperCase();

  if (medio === "EFECTIVO") return "income-pill--cash";
  if (medio === "TRANSFERENCIA") return "income-pill--transfer";

  return "income-pill--py";
}

function getTipoIcon(movimiento: MovimientoIngresoDTO) {
  if (movimiento.origen === "LIQUIDACION_PEDIDOS_YA") {
    return <span className="income-py-icon">P</span>;
  }

  const medio = movimiento.medioPago?.toUpperCase();

  if (medio === "EFECTIVO") return <Banknote size={15} />;
  if (medio === "TRANSFERENCIA") return <CreditCard size={15} />;

  return <span className="income-py-icon">P</span>;
}

function getEstadoClass(estado: MovimientoIngresoDTO["estadoIngreso"]) {
  if (estado === "COBRADO" || estado === "LIQUIDACION_RECIBIDA") {
    return "income-status--success";
  }

  return "income-status--pending";
}

function coincideConFiltroTipo(
  movimiento: MovimientoIngresoDTO,
  filtroTipo: FiltroTipo
) {
  if (filtroTipo === "TODOS") return true;

  if (filtroTipo === "LIQUIDACION") {
    return movimiento.origen === "LIQUIDACION_PEDIDOS_YA";
  }

  if (filtroTipo === "PEDIDOS_YA") {
    return (
      movimiento.tipoVenta?.toUpperCase() === "PEDIDOS_YA" &&
      movimiento.origen === "PEDIDO"
    );
  }

  return movimiento.medioPago?.toUpperCase() === filtroTipo;
}

function Ingresos() {
  const [periodo, setPeriodo] = useState<PeriodoIngreso>("hoy");
  const [fecha, setFecha] = useState(getTodayISO());
  const [mesSeleccionado, setMesSeleccionado] = useState(getCurrentMonthISO());

  const [data, setData] = useState<IngresoResumenDTO | null>(null);
  const [dataMensual, setDataMensual] = useState<IngresoResumenDTO | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const [fechaLiquidacion, setFechaLiquidacion] = useState(getTodayISO());
  const [descripcion, setDescripcion] = useState("Liquidación Pedidos Ya");
  const [monto, setMonto] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("TODOS");
  const [paginaActual, setPaginaActual] = useState(1);

  async function cargarIngresos() {
    try {
      setLoading(true);
      setError("");

      const rangoPeriodo = obtenerRangoIngreso(
        periodo,
        fecha,
        mesSeleccionado
      );

      const mesBase = obtenerMesBase(periodo, fecha, mesSeleccionado);
      const rangoMes = obtenerRangoMes(mesBase);

      const [responsePeriodo, responseMensual] = await Promise.all([
        obtenerResumenIngresos(rangoPeriodo.desde, rangoPeriodo.hasta),
        obtenerResumenIngresos(rangoMes.desde, rangoMes.hasta),
      ]);

      setData(responsePeriodo);
      setDataMensual(responseMensual);
      setPaginaActual(1);
    } catch (error) {
      console.error(error);
      setError("No se pudieron cargar los ingresos.");
      setData(null);
      setDataMensual(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarIngresos();
  }, [periodo, fecha, mesSeleccionado]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroTipo]);

  const movimientos = useMemo(() => data?.movimientos ?? [], [data]);

  const movimientosFiltrados = useMemo(() => {
    const search = busqueda.trim().toLowerCase();

    return movimientos.filter((movimiento) => {
      const coincideTipo = coincideConFiltroTipo(movimiento, filtroTipo);

      const coincideBusqueda =
        !search ||
        movimiento.descripcion?.toLowerCase().includes(search) ||
        movimiento.tipoVenta?.toLowerCase().includes(search) ||
        movimiento.medioPago?.toLowerCase().includes(search) ||
        movimiento.estadoIngreso?.toLowerCase().includes(search);

      return coincideTipo && coincideBusqueda;
    });
  }, [movimientos, busqueda, filtroTipo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(movimientosFiltrados.length / ITEMS_POR_PAGINA)
  );

  const movimientosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;

    return movimientosFiltrados.slice(inicio, fin);
  }, [movimientosFiltrados, paginaActual]);

  const totalFiltrado = movimientosFiltrados.reduce(
    (acc, movimiento) => acc + safeNumber(movimiento.monto),
    0
  );

  const desdeItem =
    movimientosFiltrados.length === 0
      ? 0
      : (paginaActual - 1) * ITEMS_POR_PAGINA + 1;

  const hastaItem = Math.min(
    paginaActual * ITEMS_POR_PAGINA,
    movimientosFiltrados.length
  );

  const efectivo = safeNumber(data?.efectivo);
  const transferencia = safeNumber(data?.transferencia);
  const pedidosYaEstimado = safeNumber(data?.pedidosYaEstimado);

  const liquidacionesMensuales = safeNumber(dataMensual?.liquidacionesPedidosYa);
  const acumuladoMensual = safeNumber(dataMensual?.acumuladoPeriodo);

  const mesBase = obtenerMesBase(periodo, fecha, mesSeleccionado);
  const nombreMesAcumulado = obtenerNombreMes(mesBase);

  const efectivoMensual = safeNumber(dataMensual?.efectivo);
  const transferenciaMensual = safeNumber(dataMensual?.transferencia);

  const totalDistribucion =
    efectivoMensual + transferenciaMensual + liquidacionesMensuales;

  const porcentajeEfectivo =
    totalDistribucion > 0
      ? Math.round((efectivoMensual / totalDistribucion) * 100)
      : 0;

  const porcentajeTransferencia =
    totalDistribucion > 0
      ? Math.round((transferenciaMensual / totalDistribucion) * 100)
      : 0;

  const porcentajeLiquidaciones =
    totalDistribucion > 0
      ? Math.round((liquidacionesMensuales / totalDistribucion) * 100)
      : 0;

  function cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    setPaginaActual(nuevaPagina);
  }

  function validarLiquidacion() {
    const montoNumber = Number(monto.replace(",", "."));

    if (!fechaLiquidacion) {
      setError("Seleccioná una fecha para la liquidación.");
      return false;
    }

    if (!montoNumber || montoNumber <= 0) {
      setError("Cargá un monto válido.");
      return false;
    }

    return true;
  }

  function solicitarGuardarLiquidacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!validarLiquidacion()) return;

    setConfirmDialogOpen(true);
  }

  async function confirmarGuardarLiquidacion() {
    const montoNumber = Number(monto.replace(",", "."));

    try {
      setSaving(true);
      setError("");

      await registrarLiquidacionPedidosYa({
        fecha: fechaLiquidacion,
        monto: montoNumber,
        descripcion: descripcion.trim() || "Liquidación Pedidos Ya",
      });

      setConfirmDialogOpen(false);
      setMonto("");
      setDescripcion("Liquidación Pedidos Ya");

      await cargarIngresos();
    } catch (error) {
      console.error(error);
      setError("No se pudo registrar la liquidación de Pedidos Ya.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="income-page">
      <header className="income-hero">
        <div>
          <p className="income-eyebrow">Control financiero</p>
          <h2>Ingresos</h2>
          <span>
            Control de efectivo, transferencias, pedidos entregados y
            liquidaciones de Pedidos Ya.
          </span>
        </div>

        <div className="income-period-filters">
          <div className="income-range-actions">
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

          <label className="income-date-filter">
            <CalendarDays size={15} />
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value);
                setPeriodo("hoy");
              }}
            />
            <ChevronDown size={14} />
          </label>

          <label className="income-date-filter">
            <CalendarDays size={15} />
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(event) => {
                setMesSeleccionado(event.target.value);
                setPeriodo("mes");
              }}
            />
            <ChevronDown size={14} />
          </label>
        </div>
      </header>

      {error && <div className="income-error">{error}</div>}

      <section className="income-layout">
        <main className="income-main">
          <section className="income-kpis">
            <Kpi
              title="Dinero en efectivo"
              value={<AnimatedNumber value={efectivo} money />}
              subtitle="Pedidos particulares cobrados"
              helper="No incluye Pedidos Ya"
              icon={<Banknote size={22} />}
              variant="green"
            />

            <Kpi
              title="Transferencias"
              value={<AnimatedNumber value={transferencia} money />}
              subtitle="Pedidos particulares cobrados"
              helper="No incluye Pedidos Ya"
              icon={<CreditCard size={22} />}
              variant="blue"
            />

            <Kpi
              title="Pedidos Ya estimado"
              value={<AnimatedNumber value={pedidosYaEstimado} money />}
              subtitle="Pendiente de liquidación"
              helper="Pedidos Ya entregados"
              icon={<span className="income-py-icon">P</span>}
              variant="red"
            />

            <Kpi
              title={`Acumulado ${nombreMesAcumulado}`}
              value={<AnimatedNumber value={acumuladoMensual} money />}
              subtitle="Mes seleccionado"
              helper="Efectivo + transferencia + liquidaciones"
              icon={<CalendarDays size={22} />}
              variant="purple"
            />
          </section>

          <section className="income-card income-form-card">
            <header className="income-card__header">
              <div className="income-card__title">
                <div>
                  <h3>Registrar liquidación Pedidos Ya</h3>
                  <span>
                    Cargá el depósito recibido cuando Pedidos Ya liquide.
                  </span>
                </div>
              </div>
            </header>

            <form
              className="income-form-grid"
              onSubmit={solicitarGuardarLiquidacion}
            >
              <label className="income-field income-field--description">
                <span>Descripción</span>
                <input
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Ej.: Liquidación primera quincena"
                />
              </label>

              <label className="income-field">
                <span>Monto depositado</span>
                <div className="income-money-input">
                  <b>$</b>
                  <input
                    value={monto}
                    onChange={(event) => setMonto(event.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
              </label>

              <label className="income-field">
                <span>Fecha</span>
                <div className="income-date-input">
                  <input
                    type="date"
                    value={fechaLiquidacion}
                    onChange={(event) =>
                      setFechaLiquidacion(event.target.value)
                    }
                  />
                  <CalendarDays size={15} />
                </div>
              </label>

              <button
                type="submit"
                className="income-save-btn"
                disabled={saving}
              >
                <PlusCircle size={16} />
                {saving ? "Guardando..." : "Guardar liquidación"}
              </button>
            </form>
          </section>

          <section className="income-card income-table-card">
            <header className="income-table-header">
              <div>
                <h3>Historial de ingresos</h3>
                <span>
                  Total filtrado: <b>{formatMoney(totalFiltrado)}</b>
                </span>
              </div>

              <div className="income-table-actions">
                <button type="button" className="income-filter-btn">
                  <Filter size={15} />
                  Filtros
                </button>

                <label className="income-filter-select">
                  <select
                    value={filtroTipo}
                    onChange={(event) =>
                      setFiltroTipo(event.target.value as FiltroTipo)
                    }
                  >
                    <option value="TODOS">Todos los tipos</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="PEDIDOS_YA">Pedidos Ya</option>
                    <option value="LIQUIDACION">Liquidaciones</option>
                  </select>
                  <ChevronDown size={14} />
                </label>

                <div className="income-search">
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Buscar movimiento..."
                  />
                  <Search size={15} />
                </div>
              </div>
            </header>

            <div className="income-table-wrap">
              <table className="income-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Medio / Origen</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    Array.from({ length: ITEMS_POR_PAGINA }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6}>
                          <div className="income-table-skeleton" />
                        </td>
                      </tr>
                    ))
                  ) : movimientosPaginados.length > 0 ? (
                    movimientosPaginados.map((movimiento) => (
                      <tr key={`${movimiento.origen}-${movimiento.id}`}>
                        <td data-label="Fecha">
                          <div className="income-date-cell">
                            <strong>{formatDate(movimiento.fecha)}</strong>
                            <span>{formatTime(movimiento.fechaHora)}</span>
                          </div>
                        </td>

                        <td data-label="Tipo">
                          <span
                            className={`income-pill ${getTipoClass(
                              movimiento
                            )}`}
                          >
                            {getTipoIcon(movimiento)}
                            {normalizarTipoVenta(movimiento.tipoVenta)}
                          </span>
                        </td>

                        <td data-label="Descripción">
                          <strong className="income-description">
                            {movimiento.descripcion}
                          </strong>
                        </td>

                        <td data-label="Medio / origen">
                          {normalizarMedioPago(movimiento.medioPago)}
                        </td>

                        <td data-label="Monto">
                          <strong className="income-amount">
                            {formatMoney(movimiento.monto)}
                          </strong>
                        </td>

                        <td data-label="Estado">
                          <span
                            className={`income-status ${getEstadoClass(
                              movimiento.estadoIngreso
                            )}`}
                          >
                            {normalizarEstadoIngreso(
                              movimiento.estadoIngreso
                            )}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="income-empty">
                          No hay movimientos para este período.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="income-table-footer">
              <span>
                Mostrando {desdeItem} a {hastaItem} de{" "}
                {movimientosFiltrados.length} movimientos
              </span>

              <div className="income-pagination">
                <button
                  type="button"
                  disabled={paginaActual === 1}
                  onClick={() => cambiarPagina(paginaActual - 1)}
                >
                  ‹
                </button>

                {Array.from({ length: totalPaginas }).map((_, index) => {
                  const page = index + 1;

                  return (
                    <button
                      key={page}
                      type="button"
                      className={paginaActual === page ? "active" : ""}
                      onClick={() => cambiarPagina(page)}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={paginaActual === totalPaginas}
                  onClick={() => cambiarPagina(paginaActual + 1)}
                >
                  ›
                </button>
              </div>
            </footer>
          </section>
        </main>

        <aside className="income-side">
          <section className="income-card income-chart-card">
            <header className="income-side-header">
              <div>
                <h3>Distribución de ingresos</h3>
                <span>Composición del acumulado mensual</span>
              </div>
            </header>

            <div className="income-donut-area">
              <div
                className="income-donut"
                style={{
                  background: `conic-gradient(
                    #16a34a 0 ${porcentajeTransferencia}%,
                    #22c55e ${porcentajeTransferencia}% ${
                    porcentajeTransferencia + porcentajeEfectivo
                  }%,
                    #ef233c ${
                      porcentajeTransferencia + porcentajeEfectivo
                    }% 100%
                  )`,
                }}
              >
                <div>
                  <span>Total</span>
                  <strong>{formatMoney(acumuladoMensual)}</strong>
                </div>
              </div>

              <div className="income-chart-list">
                <div>
                  <span className="income-dot income-dot--transfer" />
                  <p>Transferencia</p>
                  <strong>{porcentajeTransferencia}%</strong>
                </div>

                <div>
                  <span className="income-dot income-dot--cash" />
                  <p>Efectivo</p>
                  <strong>{porcentajeEfectivo}%</strong>
                </div>

                <div>
                  <span className="income-dot income-dot--py" />
                  <p>Liquidaciones PYA</p>
                  <strong>{porcentajeLiquidaciones}%</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="income-card income-activity-card">
            <header className="income-side-header">
              <div>
                <h3>Actividad reciente</h3>
                <span>Últimos movimientos</span>
              </div>
            </header>

            <div className="income-activity-list">
              {movimientos.slice(0, 5).map((movimiento) => (
                <article
                  className="income-activity"
                  key={`${movimiento.origen}-activity-${movimiento.id}`}
                >
                  <div
                    className={`income-activity__icon ${getTipoClass(
                      movimiento
                    )}`}
                  >
                    {getTipoIcon(movimiento)}
                  </div>

                  <div>
                    <strong>{normalizarMedioPago(movimiento.medioPago)}</strong>
                    <span>{movimiento.descripcion}</span>
                  </div>

                  <div>
                    <b>{formatMoney(movimiento.monto)}</b>
                    <small>
                      {formatDate(movimiento.fecha)}{" "}
                      {formatTime(movimiento.fechaHora)}
                    </small>
                  </div>
                </article>
              ))}

              {!loading && movimientos.length === 0 && (
                <div className="income-empty">No hay actividad reciente.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <AppConfirmDialog
        open={confirmDialogOpen}
        title="Confirmar liquidación de Pedidos Ya"
        description={`Vas a registrar una liquidación por ${formatMoney(
          Number(monto.replace(",", ".")) || 0
        )}. Esta operación sumará el movimiento al historial de ingresos.`}
        confirmText="Guardar liquidación"
        cancelText="Cancelar"
        loading={saving}
        variant="primary"
        onConfirm={confirmarGuardarLiquidacion}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </section>
  );
}

export default Ingresos;
