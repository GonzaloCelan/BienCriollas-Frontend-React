import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";

import type { Pedido } from "./PedidosTable";
import { parseOptionalEtaMinutes } from "../utils/deliveryEta";
import "../styles/deliveryEta.css";

type DeliveryEtaDialogProps = {
  pedido: Pedido;
  onClose: () => void;
  onSave: (minutes: number | null) => Promise<void>;
};

export default function DeliveryEtaDialog({ pedido, onClose, onSave }: DeliveryEtaDialogProps) {
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const parsedMinutes = parseOptionalEtaMinutes(minutes);
  const invalid = minutes !== "" && parsedMinutes === undefined;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  async function submitEta(value: number | null) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(value);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el ETA.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="delivery-eta-dialog">
      <button
        type="button"
        className="delivery-eta-dialog__backdrop"
        onClick={onClose}
        disabled={saving}
        aria-label="Cerrar edición del ETA"
      />
      <section role="dialog" aria-modal="true" aria-labelledby="delivery-eta-title" className="delivery-eta-dialog__panel">
        <header>
          <span className="delivery-eta-dialog__icon"><Clock3 size={19} /></span>
          <div>
            <small>Pedidos Ya · Pedido #{pedido.id}</small>
            <h2 id="delivery-eta-title">Tiempo del delivery</h2>
          </div>
          <button type="button" className="delivery-eta-dialog__close" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={(event) => {
          event.preventDefault();
          if (parsedMinutes !== null && parsedMinutes !== undefined) void submitEta(parsedMinutes);
        }}>
          <p>
            {pedido.fechaHoraEstimadaDelivery
              ? "Ingresá un nuevo tiempo para recalcular el ETA desde ahora."
              : "Agregá los minutos informados por Pedidos Ya."}
          </p>
          <label htmlFor="delivery-eta-minutes">Nuevo tiempo estimado</label>
          <div className="delivery-eta-dialog__input">
            <input
              id="delivery-eta-minutes"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) {
                  setMinutes(event.target.value);
                  setError("");
                }
              }}
              placeholder="Ej. 25"
              aria-invalid={invalid}
              aria-describedby="delivery-eta-hint"
              autoFocus
            />
            <span>min</span>
          </div>
          <small id="delivery-eta-hint" className={invalid ? "is-error" : ""}>
            {invalid ? "Ingresá un número entero mayor a cero." : "Dejarlo vacío no modifica el pedido."}
          </small>
          {error && <p className="delivery-eta-dialog__error" role="alert">{error}</p>}

          <footer>
            {pedido.fechaHoraEstimadaDelivery && (
              <button type="button" className="delivery-eta-dialog__remove" onClick={() => void submitEta(null)} disabled={saving}>
                Quitar ETA
              </button>
            )}
            <button type="button" className="delivery-eta-dialog__cancel" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="delivery-eta-dialog__save" disabled={saving || parsedMinutes === null || parsedMinutes === undefined}>
              {saving ? "Guardando..." : "Guardar ETA"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
