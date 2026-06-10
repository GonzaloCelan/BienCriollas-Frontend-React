import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { obtenerStockActual, type StockItem } from "../services/stockApi";

import carneImg from "../assets/variedades/carne_ia.png";
import verduraImg from "../assets/variedades/verdura_ia.png";
import chocloImg from "../assets/variedades/choclo_ia.png";
import polloImg from "../assets/variedades/pollo_ia.png";
import atunImg from "../assets/variedades/atun_ia.png";
import capresseImg from "../assets/variedades/capresse.png";
import fugazzaImg from "../assets/variedades/fugazza_ia.png";
import quesoAzulImg from "../assets/variedades/azul_ia.png";
import bondiolaImg from "../assets/variedades/bondi_ia.png";
import vacioImg from "../assets/variedades/vacio.jpeg";
import campoImg from "../assets/variedades/campo_ia.png";
import jamonQuesoImg from "../assets/variedades/jq_ia.png";

import "../styles/criticalStockPanel.css";

const CRITICAL_STOCK_LIMIT = 50;

const variedadImages: Record<number, string> = {
  1: carneImg,
  2: verduraImg,
  3: chocloImg,
  4: polloImg,
  5: atunImg,
  6: capresseImg,
  7: fugazzaImg,
  8: quesoAzulImg,
  9: bondiolaImg,
  10: vacioImg,
  11: campoImg,
  12: jamonQuesoImg,
};

function CriticalStockPanel() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargarStock() {
    try {
      setError("");

      const data = await obtenerStockActual();
      setStock(data);
    } catch (error) {
      console.error(error);
      setError("No se pudo cargar el stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarStock();

    const interval = window.setInterval(() => {
      cargarStock();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const stockCritico = useMemo(() => {
    return stock
      .filter((item) => item.stock < CRITICAL_STOCK_LIMIT)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);
  }, [stock]);

  return (
    <aside className="critical-stock">
      <header className="critical-stock__header">
        <div>
          <h3>Stock crítico</h3>
          <p>Variedades con bajo stock</p>
        </div>

        <AlertTriangle size={17} />
      </header>

      {loading ? (
        <div className="critical-stock__message">Cargando stock...</div>
      ) : error ? (
        <div className="critical-stock__message critical-stock__message--error">
          {error}
        </div>
      ) : stockCritico.length === 0 ? (
        <div className="critical-stock__message">
          No hay variedades críticas.
        </div>
      ) : (
        <div className="critical-stock__list">
          {stockCritico.map((item) => {
            const image = variedadImages[item.id];

            return (
              <article className="critical-stock__item" key={item.id}>
                <div className="critical-stock__image">
                  {image ? (
                    <img src={image} alt={item.nombre} />
                  ) : (
                    <span>{item.nombre.charAt(0)}</span>
                  )}
                </div>

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
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export default CriticalStockPanel;