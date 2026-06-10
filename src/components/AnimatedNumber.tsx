import { useEffect, useMemo, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  money?: boolean;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function AnimatedNumber({
  value,
  duration = 850,
  money = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  const targetValue = useMemo(() => Number(value ?? 0), [value]);

  useEffect(() => {
    let animationFrame: number;
    const startTime = performance.now();
    const startValue = displayValue;
    const difference = targetValue - startValue;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + difference * easedProgress;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [targetValue, duration]);

  return <>{money ? formatMoney(displayValue) : formatNumber(displayValue)}</>;
}

export default AnimatedNumber;