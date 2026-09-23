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
          <div className="auth-card__brand">
            <img src="/logocolor.png" alt="Bien Criollas" />
          </div>
          <h1 id="login-title">Iniciar sesión</h1>
          <span>Sistema de gestión Bien Criollas</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span className="auth-field-label">Usuario</span>
            <div className="auth-field">
              <UserRound size={20} aria-hidden="true" />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Usuario"
                disabled={enviando}
              />
            </div>
          </label>

          <label>
            <span className="auth-field-label">Contraseña</span>
            <div className="auth-field">
              <LockKeyhole size={20} aria-hidden="true" />
              <input
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
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

          {error && <div className="auth-form__error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={enviando}>
            {enviando && <LoaderCircle size={18} className="auth-spinner" />}
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginScreen;
