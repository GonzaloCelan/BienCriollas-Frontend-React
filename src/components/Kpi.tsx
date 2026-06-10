import type { ReactNode } from "react";
import "../styles/kpi.css";

type KpiVariant = "red" | "green" | "blue" | "orange" | "purple" | "neutral";

type KpiCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  helper?: string;
  icon?: ReactNode;
  variant?: KpiVariant;
  loading?: boolean;
};

function Kpi({
  title,
  value,
  subtitle,
  helper,
  icon,
  variant = "red",
  loading = false,
}: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card__top">
        <span className="kpi-card__title">{title}</span>

        {icon && <div className="kpi-card__icon">{icon}</div>}
      </div>

      <strong className="kpi-card__value">{loading ? "..." : value}</strong>

      {subtitle && <span className="kpi-card__subtitle">{subtitle}</span>}

      {helper && <span className="kpi-card__helper">{helper}</span>}
    </article>
  );
}

export default Kpi;