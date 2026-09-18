import { AlertCircle, RotateCw, Trophy, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { obtenerRankingClientes, type ClientesRankingDTO } from "../services/estadisticasApi";
import type { BusinessStatsFilters } from "./PeakHourStats";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const ordersLabel = (count: number) => `${count} ${count === 1 ? "pedido" : "pedidos"}`;

export default function CustomerRankingStats({ periodo, fecha, mes }: BusinessStatsFilters) {
  const reducedMotion = useReducedMotion();
  const [retry, setRetry] = useState(0);
  const requestKey = `${periodo}|${fecha}|${mes}|${retry}`;
  const [result, setResult] = useState<{ key: string; data: ClientesRankingDTO | null; error: string }>({ key: "", data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    void obtenerRankingClientes(periodo, fecha, mes, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null,
          error: error instanceof Error ? error.message : "No se pudo cargar el ranking de clientes.",
        });
      });
    return () => controller.abort();
  }, [periodo, fecha, mes, requestKey]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? "" : result.error;
  const leader = data?.clientes[0];
  const entry = { duration: reducedMotion ? 0 : .5, ease: [.22, 1, .36, 1] as const };

  return <motion.article className="stats-card stats-business-card" aria-labelledby="stats-customers-title" aria-busy={loading}
    initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ ...entry, delay: reducedMotion ? 0 : .1 }}>
    <header className="stats-card__header">
      <div><h3 id="stats-customers-title">Los 5 mejores clientes</h3><span>Pedidos particulares entregados · ordenados por importe acumulado</span></div>
      <div className="stats-business-icon"><UsersRound size={18} /></div>
    </header>
    {loading && <div className="stats-peak-loading" role="status" aria-label="Cargando ranking de clientes"><div className="stats-skeleton-card"><span /><span /><span /></div><span>Cargando clientes del período…</span></div>}
    {error && <div className="stats-peak-error" role="alert"><AlertCircle size={20} /><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCw size={14} />Reintentar</button></div>}
    {data && <>
      <p className="stats-peak-period">{dateLabel(data.periodo.desde)}{data.periodo.hasta !== data.periodo.desde && ` – ${dateLabel(data.periodo.hasta)}`}</p>
      {leader ? <>
        <div className="stats-customer-leader"><div className="stats-customer-trophy"><Trophy size={23} /></div>
          <div><span className="stats-business-eyebrow">Cliente destacado</span><strong>{leader.cliente}</strong><small>{ordersLabel(leader.cantidadPedidos)} en el período</small></div>
          <strong className="stats-customer-leader-total">{money.format(leader.totalAcumulado)}</strong>
        </div>
        <table className="stats-customers-table">
          <caption className="stats-sr-only">Mejores clientes por importe acumulado en el período seleccionado</caption>
          <thead><tr><th scope="col">Cliente</th><th scope="col">Pedidos</th><th scope="col">Total acumulado</th></tr></thead>
          <tbody>{data.clientes.map((customer, index) => <motion.tr key={`${requestKey}|${customer.posicion}`}
            initial={{ opacity: 0, x: reducedMotion ? 0 : -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ ...entry, delay: reducedMotion ? 0 : index * .06 }}
            title={`Ticket promedio: ${money.format(customer.ticketPromedio)} · ${customer.totalUnidades} unidades`}>
            <th scope="row"><span className={`stats-customer-position ${customer.posicion === 1 ? "is-first" : ""}`}>{customer.posicion}</span><span>{customer.cliente}</span></th>
            <td>{customer.cantidadPedidos}</td><td>{money.format(customer.totalAcumulado)}</td>
          </motion.tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={2}>Total del Top {data.clientes.length}</th><td>{money.format(data.totalTopClientes)}</td></tr></tfoot>
        </table>
      </> : <div className="stats-peak-empty"><UsersRound size={22} /><div><strong>Sin clientes para mostrar</strong><p>{data.ventasParticularesPeriodo > 0
        ? "Hay ventas particulares, pero los pedidos del período no tienen un nombre de cliente válido."
        : "No hay pedidos particulares entregados con clientes identificados en este período."}</p></div></div>}
      <div className="stats-customer-summary">
        <div><span>Clientes identificados</span><strong>{data.totalClientes}</strong></div>
        <div><span>Ventas particulares</span><strong>{money.format(data.ventasParticularesPeriodo)}</strong></div>
        <div><span>Participación del Top</span><strong>{percent.format(data.porcentajeVentasTop)}%</strong></div>
      </div>
      <p className="stats-business-footnote">Por fecha del pedido. Las ventas particulares incluyen pedidos sin nombre; el ranking agrupa los clientes por nombre.</p>
    </>}
  </motion.article>;
}
