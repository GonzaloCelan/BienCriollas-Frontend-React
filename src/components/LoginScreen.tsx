import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";

import { useAuth } from "../context/useAuth";
import { ApiError } from "../services/httpClient";

import "../styles/auth.css";

export function SessionLoadingScreen() {
  return (
    <main className="auth-screen" aria-label="Recuperando sesión">
      <div className="auth-loading">
        <img src="/logocolor.png" alt="Bien Criollas" />
        <LoaderCircle size={26} className="auth-spinner" />
        <span>Verificando tu sesión…</span>
      </div>
    </main>
  );
}

function LoginScreen() {
  const { iniciarSesion } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Ingresá tu usuario y contraseña.");
      return;
    }

    try {
      setEnviando(true);
      setError("");
      await iniciarSesion(username.trim(), password);
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : "No pudimos iniciar sesión. Revisá los datos e intentá nuevamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card__heading">
          <img src="/logocolor.png" alt="Bien Criollas" />
          <h1 id="login-title">Iniciar sesión</h1>
          <span>Ingresá con tu usuario para continuar.</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuario</span>
            <div className="auth-field">
              <UserRound size={18} />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Tu usuario"
                disabled={enviando}
              />
            </div>
          </label>

          <label>
            <span>Contraseña</span>
            <div className="auth-field">
              <LockKeyhole size={18} />
              <input
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                disabled={enviando}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((actual) => !actual)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <div className="auth-form__error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={enviando}>
            {enviando && <LoaderCircle size={18} className="auth-spinner" />}
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <small className="auth-card__footer">
          Acceso exclusivo para personal autorizado.
        </small>
      </section>
    </main>
  );
}

export default LoginScreen;
