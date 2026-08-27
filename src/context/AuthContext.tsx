import { useCallback, useEffect, useState, type PropsWithChildren } from "react";

import {
  cambiarMiPasswordApi,
  cerrarSesionApi,
  iniciarSesionApi,
  recuperarUsuarioApi,
  type Usuario,
} from "../services/authApi";
import {
  ACCESS_TOKEN_KEY,
  AUTH_FORBIDDEN_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  USER_STORAGE_KEY,
  guardarSesion,
  limpiarSesionGuardada,
} from "../services/httpClient";
import { AuthContext, type AuthContextValue } from "./authContextBase";

function irAlLogin() {
  if (window.location.pathname !== "/login") {
    window.history.replaceState({}, "", "/login");
  }
}

function irALaAplicacion() {
  if (window.location.pathname === "/login") {
    window.history.replaceState({}, "", "/");
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [recuperandoSesion, setRecuperandoSesion] = useState(
    () => Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY))
  );
  const [permisoError, setPermisoError] = useState("");

  const cerrarSesionLocal = useCallback(() => {
    limpiarSesionGuardada();
    setUsuario(null);
    irAlLogin();
  }, []);

  useEffect(() => {
    let mounted = true;
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);

    if (!token) {
      irAlLogin();
      return;
    }

    void recuperarUsuarioApi()
      .then((data) => {
        if (!mounted) return;
        guardarSesion(token, data);
        setUsuario(data);
        irALaAplicacion();
      })
      .catch(() => {
        if (!mounted) return;
        cerrarSesionLocal();
      })
      .finally(() => {
        if (mounted) setRecuperandoSesion(false);
      });

    return () => {
      mounted = false;
    };
  }, [cerrarSesionLocal]);

  useEffect(() => {
    function handleUnauthorized() {
      cerrarSesionLocal();
    }

    function handleForbidden(event: Event) {
      const customEvent = event as CustomEvent<string>;
      setPermisoError(
        customEvent.detail || "No tenés permisos para realizar esta operación."
      );
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);
    };
  }, [cerrarSesionLocal]);

  async function iniciarSesion(username: string, password: string) {
    const data = await iniciarSesionApi(username, password);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    setPermisoError("");
    irALaAplicacion();
  }

  async function cerrarSesion() {
    try {
      await cerrarSesionApi();
    } finally {
      cerrarSesionLocal();
    }
  }

  async function cambiarPassword(
    passwordActual: string,
    passwordNueva: string
  ) {
    await cambiarMiPasswordApi({ passwordActual, passwordNueva });
    cerrarSesionLocal();
  }

  const value: AuthContextValue = {
    usuario,
    recuperandoSesion,
    esAdministrador: usuario?.rol === "ADMINISTRADOR",
    permisoError,
    iniciarSesion,
    cerrarSesion,
    cambiarPassword,
    limpiarPermisoError: () => setPermisoError(""),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
