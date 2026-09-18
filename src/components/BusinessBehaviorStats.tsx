import PeakHourStats, { type BusinessStatsFilters } from "./PeakHourStats";
import CustomerRankingStats from "./CustomerRankingStats";
import "../styles/businessStats.css";

export default function BusinessBehaviorStats(filters: BusinessStatsFilters) {
  return <section className="stats-business" aria-label="Horarios de ventas y mejores clientes">
    <div className="stats-business-grid">
      <PeakHourStats {...filters} />
      <CustomerRankingStats {...filters} />
    </div>
  </section>;
}
