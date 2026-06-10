import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";

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
  const animationContainerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!animationContainerRef.current) return;

    animationRef.current?.destroy();

    animationRef.current = lottie.loadAnimation({
      container: animationContainerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData,
    });

    return () => {
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [animationData]);

  return (
    <button
      type="button"
      className={`kpi-filter-card ${active ? "kpi-filter-card--active" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-filter-card__icon">
        <div ref={animationContainerRef} className="kpi-filter-card__lottie" />
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