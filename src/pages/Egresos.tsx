import AppConfirmDialog from "../components/AppConfirmDialog";
import Kpi from "../components/Kpi";

import {
  CalendarDays,
  ChevronDown,
  Factory,
  Search,
  Users,
  Wallet,
  ShoppingCart,
  Save,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import {
  listarHistorialEgresos,
  obtenerEgresoAcumulado,
  obtenerEgresosDiarios,
  obtenerPorcentajesEgresos,
  obtenerTotalesPorTipo,
  obtenerUltimosMovimientos,
  registrarEgreso,
  type Egreso,
  type EgresoResponseDTO,
  type EgresosPorcentajeDTO,
  type TipoEgreso,
} from "../services/egresosApi";

import "../styles/egresos.css";

type FiltroTipo = TipoEgreso | "TODAS";

type EgresoTabla = {
  id: number;
  fecha: string;
  hora: string;
  categoria: TipoEgreso;
  descripcion: string;
  responsable: string;
  monto: number;
  creadoEn: string;
};

const tipoOptions: { value: TipoEgreso; label: string }[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "PRODUCCION", label: "Producción" },
  { value: "OTROS", label: "Día a día" },
];

function parseMoney(value: string) {
  const cleanValue = value.replace(/[^\d]/g, "");
  return Number(cleanValue || 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "-";

  if (value.includes(":")) {
    return value.slice(0, 5);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTodayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split("T")[0];
}

function getCurrentMonthISO() {
  return getTodayISO().slice(0, 7);
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getCurrentMonthName() {
  const today = new Date();

  const monthName = new Intl.DateTimeFormat("es-AR", {
    month: "long",
  }).format(today);

  return capitalize(monthName);
}

function getCurrentDayName() {
  const today = new Date();

  const dayName = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
  }).format(today);

  return capitalize(dayName);
}

function getYearMonth(value: string) {
  const [anio, mes] = value.split("-").map(Number);

  return {
    anio,
    mes,
  };
}

function getCategoriaLabel(categoria: TipoEgreso) {
  if (categoria === "PERSONAL") return "Personal";
  if (categoria === "PRODUCCION") return "Producción";
  return "Día a día";
}

function getCategoriaClass(categoria: TipoEgreso) {
  if (categoria === "PERSONAL") return "expense-pill--personal";
  if (categoria === "PRODUCCION") return "expense-pill--production";
  return "expense-pill--daily";
}

function getCategoriaIcon(categoria: TipoEgreso) {
  if (categoria === "PERSONAL") return <Users size={15} />;
  if (categoria === "PRODUCCION") return <Factory size={15} />;
  return <ShoppingCart size={15} />;
}


function safeNumber(value?: number | null) {
  return Number(value ?? 0);
}

function mapEgresoToTable(egreso: Egreso): EgresoTabla {
  return {
    id: egreso.idEgreso,
    fecha: formatDate(egreso.creadoEn),
    hora: formatTime(egreso.hora || egreso.creadoEn),
    categoria: egreso.tipoEgreso,
    descripcion: egreso.descripcion,
    responsable: "Sistema",
    monto: safeNumber(egreso.monto),
    creadoEn: egreso.creadoEn,
  };
}

function getPorcentaje(
  porcentajes: EgresosPorcentajeDTO[],
  tipo: TipoEgreso
) {
  return safeNumber(
    porcentajes.find((item) => item.tipoEgreso === tipo)?.porcentaje
  );
}

function Egresos() {
  const [resumen, setResumen] = useState<EgresoResponseDTO | null>(null);
  const [porcentajes, setPorcentajes] = useState<EgresosPorcentajeDTO[]>([]);
  const [egresosHoy, setEgresosHoy] = useState<EgresoTabla[]>([]);
  const [historial, setHistorial] = useState<EgresoTabla[]>([]);
  const [ultimosMovimientos, setUltimosMovimientos] = useState<EgresoTabla[]>(
    []
  );

  const [tipoEgreso, setTipoEgreso] = useState<TipoEgreso>("PRODUCCION");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");

  const [filtroMes, setFiltroMes] = useState(getCurrentMonthISO());
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("TODAS");
  const [busqueda, setBusqueda] = useState("");

  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTabla, setTotalTabla] = useState(0);

  const [loadingInicial, setLoadingInicial] = useState(true);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nombreMesActual = getCurrentMonthName();
  const nombreDiaActual = getCurrentDayName();

  async function cargarDatosGenerales() {
    try {
      setLoadingInicial(true);
      setError("");

      const [resumenData, diariosData, porcentajesData, ultimosData] =
        await Promise.all([
          obtenerEgresoAcumulado(),
          obtenerEgresosDiarios(),
          obtenerPorcentajesEgresos(),
          obtenerUltimosMovimientos(),
        ]);

      setResumen(resumenData);
      setPorcentajes(porcentajesData);
      setEgresosHoy(diariosData.map(mapEgresoToTable));
      setUltimosMovimientos(ultimosData.map(mapEgresoToTable));
    } catch (error) {
      console.error(error);
      setError("No se pudieron cargar los egresos.");
    } finally {
      setLoadingInicial(false);
    }
  }

  async function cargarHistorial(pageToLoad = page) {
    try {
      setLoadingTabla(true);
      setError("");

      const { anio, mes } = getYearMonth(filtroMes);

      const [totalesTipoData, historialData] = await Promise.all([
        obtenerTotalesPorTipo({ anio, mes }),
        listarHistorialEgresos({
          anio,
          mes,
          tipo: filtroTipo,
          page: pageToLoad,
          size: pageSize,
        }),
      ]);

      const totalPersonalTabla =
        totalesTipoData.find((item) => item.tipoEgreso === "PERSONAL")
          ?.total ?? 0;

      const totalProduccionTabla =
        totalesTipoData.find((item) => item.tipoEgreso === "PRODUCCION")
          ?.total ?? 0;

      const totalOtrosTabla =
        totalesTipoData.find((item) => item.tipoEgreso === "OTROS")?.total ?? 0;

      let totalFiltrado =
        totalPersonalTabla + totalProduccionTabla + totalOtrosTabla;

      if (filtroTipo === "PERSONAL") {
        totalFiltrado = totalPersonalTabla;
      }

      if (filtroTipo === "PRODUCCION") {
        totalFiltrado = totalProduccionTabla;
      }

      if (filtroTipo === "OTROS") {
        totalFiltrado = totalOtrosTabla;
      }

      setTotalTabla(totalFiltrado);
      setHistorial(historialData.content.map(mapEgresoToTable));
      setTotalElements(historialData.totalElements);
      setTotalPages(historialData.totalPages || 1);
    } catch (error) {
      console.error(error);
      setError("No se pudo cargar el historial de egresos.");
    } finally {
      setLoadingTabla(false);
    }
  }

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [filtroMes, filtroTipo, page]);

  function abrirConfirmacionEgreso() {
    const descripcionTrim = descripcion.trim();
    const montoNumber = parseMoney(monto);

    if (!descripcionTrim) {
      alert("Cargá una descripción.");
      return;
    }

    if (montoNumber <= 0) {
      alert("Cargá un monto válido.");
      return;
    }

    setConfirmOpen(true);
  }

  async function confirmarRegistroEgreso() {
    if (saving) return;

    const descripcionTrim = descripcion.trim();
    const montoNumber = parseMoney(monto);

    try {
      setSaving(true);

      await registrarEgreso({
        idCaja: null,
        tipoEgreso,
        descripcion: descripcionTrim,
        monto: montoNumber,
      });

      setDescripcion("");
      setMonto("");
      setTipoEgreso("PRODUCCION");
      setConfirmOpen(false);
      setPage(0);

      await Promise.all([cargarDatosGenerales(), cargarHistorial(0)]);
    } catch (error) {
      console.error(error);
      alert("No se pudo registrar el egreso.");
    } finally {
      setSaving(false);
    }
  }

  function handleChangeMes(value: string) {
    setFiltroMes(value);
    setPage(0);
  }

  function handleChangeTipo(value: FiltroTipo) {
    setFiltroTipo(value);
    setPage(0);
  }

  const totalPersonal = safeNumber(resumen?.totalPersonal);
  const totalProduccion = safeNumber(resumen?.totalProduccion);
  const totalOtros = safeNumber(resumen?.totalOtros);

  const totalMes = totalPersonal + totalProduccion + totalOtros;
  const totalHoy = egresosHoy.reduce((acc, item) => acc + item.monto, 0);

  const porcentajePersonal =
    totalMes > 0 ? Math.round((totalPersonal / totalMes) * 100) : 0;

  const porcentajeProduccion =
    totalMes > 0 ? Math.round((totalProduccion / totalMes) * 100) : 0;

  const porcentajeOtros =
    totalMes > 0 ? Math.round((totalOtros / totalMes) * 100) : 0;

  const variacionPersonal = getPorcentaje(porcentajes, "PERSONAL");
  const variacionProduccion = getPorcentaje(porcentajes, "PRODUCCION");

  const historialFiltrado = useMemo(() => {
    const search = busqueda.trim().toLowerCase();

    if (!search) return historial;

    return historial.filter((item) =>
      item.descripcion.toLowerCase().includes(search)
    );
  }, [historial, busqueda]);

  return (
    <section className="expenses-page">
      <header className="expenses-hero">
        <div>
          <p className="expenses-eyebrow">Gestión de egresos</p>
          <h2>Egresos</h2>
          <span>Control y registro de gastos operativos del negocio.</span>
        </div>
      </header>

      {error && <div className="expenses-error">{error}</div>}

      <section className="expenses-layout">
        <main className="expenses-main">
          <section className="expenses-summary">
            <Kpi
              title={`Acumulado de hoy ${nombreDiaActual}`}
              value={formatMoney(totalHoy)}
              subtitle={`${egresosHoy.length} movimientos`}
              icon={<Wallet size={22} />}
              variant="orange"
              loading={loadingInicial}
            />

            <Kpi
              title="Personal"
              value={formatMoney(totalPersonal)}
              subtitle={`${porcentajePersonal}% del mes`}
              helper={
                variacionPersonal > 0
                  ? `${variacionPersonal}% vs. mes anterior`
                  : undefined
              }
              icon={<Users size={22} />}
              variant="purple"
              loading={loadingInicial}
            />

            <Kpi
              title="Producción"
              value={formatMoney(totalProduccion)}
              subtitle={`${porcentajeProduccion}% del mes`}
              helper={
                variacionProduccion > 0
                  ? `${variacionProduccion}% vs. mes anterior`
                  : undefined
              }
              icon={<Factory size={22} />}
              variant="blue"
              loading={loadingInicial}
            />

            <Kpi
  title={`Acumulado ${nombreMesActual}`}
  value={formatMoney(totalMes)}
  subtitle="Total mensual de egresos"
  icon={<CalendarDays size={22} />}
  variant="red"
  loading={loadingInicial}
/>
          </section>

          <section className="expenses-card expenses-quick-form">
            <header className="expenses-card__header">
              <div className="expenses-card__title">
                <div>
                  <h3>Carga rápida de egreso</h3>
                  <span>Registrá un gasto sin abrir otra pantalla.</span>
                </div>
              </div>
            </header>

            <div className="expenses-form-grid">
              <label className="expenses-field">
                <span>Categoría</span>

                <select
                  value={tipoEgreso}
                  onChange={(event) =>
                    setTipoEgreso(event.target.value as TipoEgreso)
                  }
                >
                  {tipoOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="expenses-field expenses-field--description">
                <span>Descripción</span>

                <input
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Ej.: Pago de sueldos, compra de insumos..."
                />
              </label>

              <label className="expenses-field">
                <span>Monto</span>

                <div className="expenses-money-input">
                  <b>$</b>
                  <input
                    value={monto}
                    onChange={(event) => setMonto(event.target.value)}
                    placeholder="0,00"
                    inputMode="numeric"
                  />
                </div>
              </label>

              <label className="expenses-field">
                <span>Fecha</span>

                <div className="expenses-date-input">
                  <CalendarDays size={15} />
                  <input type="date" value={getTodayISO()} disabled />
                </div>
              </label>

              <button
                type="button"
                className="expenses-save-btn"
                onClick={abrirConfirmacionEgreso}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar egreso"}
              </button>
            </div>
          </section>

          <section className="expenses-card expenses-table-card">
            <header className="expenses-table-header">
              <div className="expenses-card__title">
                <div>
                  <h3>Egresos registrados</h3>
                  <span>
                    Total filtrado: <b>{formatMoney(totalTabla)}</b>
                  </span>
                </div>
              </div>

              <div className="expenses-table-filters">
                <label className="expenses-filter-input">
                  <CalendarDays size={15} />
                  <input
                    type="month"
                    value={filtroMes}
                    onChange={(event) => handleChangeMes(event.target.value)}
                  />
                </label>

                <label className="expenses-filter-select">
                  <select
                    value={filtroTipo}
                    onChange={(event) =>
                      handleChangeTipo(event.target.value as FiltroTipo)
                    }
                  >
                    <option value="TODAS">Todas las categorías</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="PRODUCCION">Producción</option>
                    <option value="OTROS">Día a día</option>
                  </select>

                  <ChevronDown size={14} />
                </label>

                <div className="expenses-search">
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Buscar egreso..."
                  />
                  <Search size={15} />
                </div>
              </div>
            </header>

            <div className="expenses-table-wrap">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th>Monto</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingTabla ? (
                    <tr>
                      <td colSpan={6}>Cargando egresos...</td>
                    </tr>
                  ) : historialFiltrado.length > 0 ? (
                    historialFiltrado.map((egreso, index) => (
                      <tr
                        key={`${egreso.id}-${index}`}
                        style={{ animationDelay: `${index * 0.045}s` }}
                      >
                        <td>
                          <div className="expenses-date-cell">
                            <strong>{egreso.fecha}</strong>
                            <span>{egreso.hora}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`expense-pill ${getCategoriaClass(
                              egreso.categoria
                            )}`}
                          >
                            {getCategoriaIcon(egreso.categoria)}
                            {getCategoriaLabel(egreso.categoria)}
                          </span>
                        </td>

                        <td>
                          <strong className="expenses-description">
                            {egreso.descripcion}
                          </strong>
                        </td>

                        <td>{egreso.responsable}</td>

                        <td>
                          <strong className="expenses-amount">
                            {formatMoney(egreso.monto)}
                          </strong>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No hay egresos cargados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="expenses-table-footer">
              <span>
                Mostrando {historialFiltrado.length} de {totalElements} egresos
              </span>

              <div className="expenses-pagination">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                >
                  ‹
                </button>

                <button type="button" className="active">
                  {page + 1}
                </button>

                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() =>
                    setPage((prev) => Math.min(prev + 1, totalPages - 1))
                  }
                >
                  ›
                </button>
              </div>

              <button type="button" className="expenses-filter-btn">
                Filas por página {pageSize}
                <ChevronDown size={14} />
              </button>
            </footer>
          </section>
        </main>

        <aside className="expenses-side">
          <section className="expenses-card expenses-chart-card">
            <header className="expenses-side-header">
              <div>
                <h3>Resumen por categoría</h3>
                <span>Distribución mensual</span>
              </div>

              <button type="button" className="expenses-filter-btn">
                Este mes
                <ChevronDown size={14} />
              </button>
            </header>

            <div className="expenses-donut-row">
              <div
                className="expenses-donut"
                style={{
                  background: `conic-gradient(
                    #ef233c 0 ${porcentajePersonal}%,
                    #f97316 ${porcentajePersonal}% ${
                    porcentajePersonal + porcentajeProduccion
                  }%,
                    #3b82f6 ${
                      porcentajePersonal + porcentajeProduccion
                    }% 100%
                  )`,
                }}
              >
                <div>
                  <span>Total</span>
                  <strong>{formatMoney(totalMes)}</strong>
                </div>
              </div>

              <div className="expenses-category-list">
                <div>
                  <span className="expense-dot expense-dot--personal" />
                  <p>Personal</p>
                  <strong>{formatMoney(totalPersonal)}</strong>
                  <small>{porcentajePersonal}%</small>
                </div>

                <div>
                  <span className="expense-dot expense-dot--production" />
                  <p>Producción</p>
                  <strong>{formatMoney(totalProduccion)}</strong>
                  <small>{porcentajeProduccion}%</small>
                </div>

                <div>
                  <span className="expense-dot expense-dot--daily" />
                  <p>Día a día</p>
                  <strong>{formatMoney(totalOtros)}</strong>
                  <small>{porcentajeOtros}%</small>
                </div>
              </div>
            </div>
          </section>

          <section className="expenses-card expenses-movements-card">
            <header className="expenses-side-header">
              <div>
                <h3>Últimos movimientos</h3>
                <span>Gastos recientes</span>
              </div>
            </header>

            <div className="expenses-movements">
              {loadingInicial ? (
                <div className="expenses-empty">Cargando movimientos...</div>
              ) : ultimosMovimientos.length > 0 ? (
                ultimosMovimientos.map((item) => (
                  <article className="expenses-movement" key={item.id}>
                    <div
                      className={`expenses-movement__icon ${getCategoriaClass(
                        item.categoria
                      )}`}
                    >
                      {getCategoriaIcon(item.categoria)}
                    </div>

                    <div>
                      <strong>{item.descripcion}</strong>
                      <span>
                        {item.fecha}, {item.hora}
                      </span>
                    </div>

                    <div>
                      <b>{formatMoney(item.monto)}</b>
                      <small>{getCategoriaLabel(item.categoria)}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="expenses-empty">No hay movimientos.</div>
              )}
            </div>

            <button type="button" className="expenses-link-btn">
              Ver todos los egresos
              <ChevronDown size={14} />
            </button>
          </section>
        </aside>
      </section>

      <AppConfirmDialog
        open={confirmOpen}
        title="Registrar egreso"
        description={`Vas a registrar "${descripcion.trim()}" como egreso de ${getCategoriaLabel(
          tipoEgreso
        )} por ${formatMoney(parseMoney(monto))}.`}
        confirmText="Guardar egreso"
        cancelText="Volver"
        loading={saving}
        variant="danger"
        onConfirm={confirmarRegistroEgreso}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

export default Egresos;