import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, X } from "lucide-react";

import { useAuth } from "../context/useAuth";
import { ApiError } from "../services/httpClient";

import "../styles/auth.css";

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
};

function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { cambiarPassword } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function handleClose() {
    setActual("");
    setNueva("");
    setRepetida("");
    setError("");
    onClose();
  }

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (nueva.length < 10 || nueva.length > 72) {
      setError("La contraseña nueva debe tener entre 10 y 72 caracteres.");
      return;
    }

    if (nueva !== repetida) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await cambiarPassword(actual, nueva);
    } catch (changeError) {
      setError(
        changeError instanceof ApiError
          ? changeError.message
          : "No se pudo cambiar la contraseña."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="auth-dialog__overlay" role="presentation">
      <section className="auth-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="auth-dialog__icon"><KeyRound size={20} /></div>
          <div>
            <span>SEGURIDAD</span>
            <h2>Cambiar contraseña</h2>
          </div>
          <button type="button" onClick={handleClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <p>Al guardarla, la sesión se cerrará y tendrás que ingresar nuevamente.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Contraseña actual
            <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
          </label>
          <label>
            Contraseña nueva
            <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required minLength={10} maxLength={72} />
          </label>
          <label>
            Repetir contraseña nueva
            <input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required />
          </label>

          {error && <div className="auth-form__error">{error}</div>}

          <div className="auth-dialog__actions">
            <button type="button" className="auth-dialog__cancel" onClick={handleClose} disabled={guardando}>Cancelar</button>
            <button type="submit" className="auth-dialog__save" disabled={guardando || !actual || !nueva || !repetida}>
              {guardando && <LoaderCircle size={17} className="auth-spinner" />}
              {guardando ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ChangePasswordDialog;
