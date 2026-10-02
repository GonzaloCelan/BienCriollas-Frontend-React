import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { obtenerStockActual, type StockItem } from "../services/stockApi";

import "../styles/criticalStockPanel.css";

const CRITICAL_STOCK_LIMIT = 50;

type CriticalStockPanelProps = {
  onNavigateToStock: () => void;
  refreshToken: number;
};

function CriticalStockPanel({ onNavigateToStock, refreshToken }: CriticalStockPanelProps) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const latestRequest = useRef(0);

  const cargarStock = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const data = await obtenerStockActual();
      if (requestId === latestRequest.current) setStock(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const refresh = window.setTimeout(() => void cargarStock(), 0);
    return () => window.clearTimeout(refresh);
  }, [cargarStock, refreshToken]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void cargarStock();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [cargarStock]);

  const stockCritico = useMemo(() => {
    return stock
      .filter((item) => item.stock < CRITICAL_STOCK_LIMIT)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);
  }, [stock]);

  if (stockCritico.length === 0) {
    return null;
  }

  return (
    <aside className="critical-stock">
      <header className="critical-stock__header">
        <div>
          <h3>Stock crítico</h3>
          <p>Variedades con bajo stock</p>
        </div>

        <AlertTriangle size={17} />
      </header>

      <div className="critical-stock__list">
        {stockCritico.map((item) => (
          <button
            type="button"
            className="critical-stock__item"
            key={item.id}
            onClick={onNavigateToStock}
            aria-label={`Ir a Stock por ${item.nombre}`}
          >
            <div className="critical-stock__content">
              <div className="critical-stock__top">
                <strong>{item.nombre}</strong>

                <span>{item.stock} unidades</span>
              </div>

              <div className="critical-stock__bar">
                <div
                  style={{
                    width: `${Math.min(
                      (item.stock / CRITICAL_STOCK_LIMIT) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default CriticalStockPanel;
