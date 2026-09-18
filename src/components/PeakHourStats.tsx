import { AlertCircle, Clock3, Flame, Moon, RotateCw, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  obtenerHoraPico,
  type HoraPicoDTO,
  type PeriodoEstadistica,
} from "../services/estadisticasApi";

export type BusinessStatsFilters = { periodo: PeriodoEstadistica; fecha: string; mes: string };

const money = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => value.split("-").reverse().join("/");

export default function PeakHourStats({ periodo, fecha, mes }: BusinessStatsFilters) {
  const reducedMotion = useReducedMotion();
  const [retry, setRetry] = useState(0);
  const requestKey = `${periodo}|${fecha}|${mes}|${retry}`;
  const [result, setResult] = useState<{ key: string; data: HoraPicoDTO | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    void obtenerHoraPico(periodo, fecha, mes, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({
          key: requestKey, data: null,
          error: error instanceof Error ? error.message : "No se pudo cargar la hora pico del negocio.",
        });
      });
    return () => controller.abort();
  }, [periodo, fecha, mes, requestKey]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? "" : result.error;
  const entry = { duration: reducedMotion ? 0 : .5, ease: [.22, 1, .36, 1] as const };

  return <motion.article className="stats-card stats-business-card" aria-labelledby="stats-peak-title" aria-busy={loading}
    initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={entry}>
    <header className="stats-card__header">
      <div><h3 id="stats-peak-title">Hora pico del negocio</h3><span>Pedidos entregados por su hora de creación · franjas de 30 minutos</span></div>
      <div className="stats-business-icon"><Clock3 size={18} /></div>
    </header>
    {loading && <div className="stats-peak-loading" role="status" aria-label="Cargando hora pico"><div className="stats-skeleton-card"><span /><span /><span /></div><span>Cargando ventas por horario…</span></div>}
    {error && <div className="stats-peak-error" role="alert"><AlertCircle size={20} /><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCw size={14} />Reintentar</button></div>}
    {data && <PeakHourChart key={requestKey} data={data} />}
  </motion.article>;
}

function PeakHourChart({ data }: { data: HoraPicoDTO }) {
  const reducedMotion = useReducedMotion();
  const peak = data.horaPico;
  const shifts = [
    { name: "Mediodía", key: "MEDIODIA", icon: Sun, ...data.turnos.mediodia },
    { name: "Noche", key: "NOCHE", icon: Moon, ...data.turnos.noche },
  ];
  const maxOrders = Math.max(1, ...shifts.flatMap((shift) => shift.franjas.map((slot) => slot.pedidos)));
  const [selectedKey, setSelectedKey] = useState(peak ? `${peak.turno}|${peak.inicio}` : `MEDIODIA|${data.turnos.mediodia.franjas[0]?.inicio}`);
  const selected = shifts.flatMap((shift) => shift.franjas.map((slot) => ({ ...slot, key: `${shift.key}|${slot.inicio}` }))).find((slot) => slot.key === selectedKey);

  return <>
    <p className="stats-peak-period">{dateLabel(data.periodo.desde)}{data.periodo.hasta !== data.periodo.desde && ` – ${dateLabel(data.periodo.hasta)}`}</p>
    {peak ? <div className="stats-peak-summary">
      <div><span className="stats-business-eyebrow"><Flame size={13} /> Mayor movimiento · {peak.turno === "MEDIODIA" ? "mediodía" : "noche"}</span>
        <strong>{peak.inicio}<span>– {peak.fin}</span></strong>
        <small>{money.format(peak.montoVendido)} vendidos en esta franja.</small></div>
      <div className="stats-peak-count"><strong>{peak.pedidos}</strong><span>pedidos · {percent.format(peak.porcentajeDelTotal)}% del total</span></div>
    </div> : <div className="stats-peak-empty"><Clock3 size={22} /><div><strong>Sin hora pico disponible</strong><p>{data.totalPedidosAnalizados === 0 ? "No hay pedidos entregados con fecha de creación en este período." : "Todos los pedidos analizados se crearon fuera de los turnos del local."}</p></div></div>}

    <div className="stats-shifts">
      {shifts.map((shift, shiftIndex) => <div className="stats-shift" key={shift.key}>
        <div className="stats-shift-heading"><span><shift.icon size={14} />{shift.name}</span><small>{shift.desde} a {shift.hasta}</small></div>
        <div className="stats-hour-chart" role="group" aria-label={`Ventas del turno ${shift.name}`}>
          {shift.franjas.map((slot, index) => {
            const key = `${shift.key}|${slot.inicio}`;
            const isPeak = peak?.turno === shift.key && peak.inicio === slot.inicio;
            return <button type="button" key={key}
              className={`stats-hour-slot ${slot.pedidos === 0 ? "is-zero" : ""} ${isPeak ? "is-peak" : ""} ${key === selectedKey ? "is-selected" : ""}`}
              aria-label={`${slot.inicio} a ${slot.fin}: ${slot.pedidos} pedidos${isPeak ? ", hora pico" : ""}`}
              aria-pressed={key === selectedKey}
              onMouseEnter={() => setSelectedKey(key)} onFocus={() => setSelectedKey(key)} onClick={() => setSelectedKey(key)}>
              <div className="stats-hour-column" style={{ height: `${slot.pedidos / maxOrders * 100}%` }}>
                <b>{slot.pedidos}</b>
                <motion.span className="stats-hour-bar" initial={{ scaleY: reducedMotion ? 1 : 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
                  transition={{ duration: reducedMotion ? 0 : .5, delay: reducedMotion ? 0 : .06 * index + .12 * shiftIndex, ease: [.22, 1, .36, 1] }} />
                {isPeak && <Flame size={13} className="stats-hour-peak-icon" aria-hidden="true" />}
              </div>
              <span className="stats-hour-label">{slot.inicio}</span>
            </button>;
          })}
        </div>
        <div className="stats-shift-total"><span>{shift.totalPedidos} pedidos</span><strong>{money.format(shift.totalMontoVendido)}</strong></div>
      </div>)}
    </div>
    {selected && <div className="stats-hour-detail" role="status" aria-live="polite" aria-atomic="true">
      <span><Clock3 size={14} /><strong>{selected.inicio} – {selected.fin}</strong></span>
      <span>{selected.pedidos} pedidos · {percent.format(selected.porcentajeDelTotal)}%<strong>{money.format(selected.montoVendido)}</strong></span>
    </div>}
    <div className="stats-peak-totals"><span><strong>{data.totalPedidosAnalizados}</strong> pedidos analizados</span><strong>{money.format(data.totalMontoVendido)}</strong></div>
    {data.pedidosFueraDeHorario > 0 && <div className="stats-outside-hours"><AlertCircle size={15} /><div><strong>{data.pedidosFueraDeHorario} {data.pedidosFueraDeHorario === 1 ? "pedido fuera de horario" : "pedidos fuera de horario"}</strong><span>{money.format(data.montoFueraDeHorario)} · incluidos en el total, fuera de las barras.</span></div></div>}
    <p className="stats-business-footnote"><span className="stats-peak-dot" />Rojo: hora pico · tocá una barra para ver sus ventas.</p>
  </>;
}
