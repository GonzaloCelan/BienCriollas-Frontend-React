type StockMode = "produccion" | "mermas" | "conteo";

type StockCardProps = {
  id: number;
  nombre: string;
  stock: number;
  stockTotal: number;
  fechaElaboracion: string | null;
  produccion: number;
  image: string;
  inputLabel: string;
  mode: StockMode;
  onChangeProduccion: (id: number, value: number) => void;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatus(stock: number) {
  if (stock <= 0) {
    return {
      key: "empty",
      label: "Sin stock",
    };
  }

  if (stock < 50) {
    return {
      key: "critical",
      label: "Crítico",
    };
  }

  if (stock <= 100) {
    return {
      key: "low",
      label: "Alerta",
    };
  }

  return {
    key: "stable",
    label: "Disponible",
  };
}

function getPlaceholder(mode: StockMode) {
  if (mode === "produccion") return "Ej: 120";
  if (mode === "mermas") return "Ej: 8";
  return "Ej: 76";
}

function StockCard({
  id,
  nombre,
  stock,
  stockTotal,
  fechaElaboracion,
  produccion,
  image,
  inputLabel,
  mode,
  onChangeProduccion,
}: StockCardProps) {
  const status = getStatus(stock);

  const stockBase = stockTotal > 0 ? stockTotal : 150;
  const percentage = Math.min((stock / stockBase) * 100, 100);

  function handleInput(value: string) {
  if (value === "") {
    onChangeProduccion(id, 0);
    return;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    onChangeProduccion(id, 0);
    return;
  }

  onChangeProduccion(id, Math.max(0, parsedValue));
}
  return (
    <article
      className={`stock-card stock-card--${status.key} stock-card--mode-${mode}`}
    >
      <div className="stock-card__image-wrap">
        <img src={image} alt={nombre} className="stock-card__image" />

        <span className={`stock-card__badge stock-card__badge--${status.key}`}>
          {status.label}
        </span>
      </div>

      <div className="stock-card__body">
        <header className="stock-card__header">
          <h3>{nombre}</h3>
        </header>

        <div className="stock-card__info">
          <div className="stock-card__line">
            <span>Stock disponible</span>
            <strong>{stock}</strong>
          </div>

          <div className="stock-card__line">
            <span>Total elaborado</span>
            <strong>{stockTotal}</strong>
          </div>

          <div className="stock-card__line">
            <span>Última elaboración</span>
            <strong>{formatDate(fechaElaboracion)}</strong>
          </div>
        </div>

        <div className="stock-card__progress">
          <span style={{ width: `${percentage}%` }} />
        </div>

        <label className="stock-card__production">
          <span>{inputLabel}</span>

          <input
  type="number"
  min={0}
  value={produccion === 0 ? "" : produccion}
  onChange={(event) => handleInput(event.target.value)}
  placeholder={getPlaceholder(mode)}
/>
        </label>
      </div>
    </article>
  );
}

export default StockCard;