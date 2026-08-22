import LottieAnimation from "./LottieAnimation";
import "../styles/kpiCard.css";

type KpiCardProps = {
  title: string;
  value: number;
  animationData: object;
  active?: boolean;
  onClick?: () => void;
};

function KpiCard({
  title,
  value,
  animationData,
  active = false,
  onClick,
}: KpiCardProps) {
  return (
    <button
      type="button"
      className={`kpi-filter-card ${active ? "kpi-filter-card--active" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-filter-card__icon">
        <LottieAnimation
          animationData={animationData}
          className="kpi-filter-card__lottie"
        />
      </div>

      <div className="kpi-filter-card__content">
        <span>{title}</span>
        <strong key={value}>{value}</strong>
      </div>

      <div className="kpi-filter-card__indicator">
        {active ? "Filtrando" : "Filtrar"}
      </div>
    </button>
  );
}

export default KpiCard;
