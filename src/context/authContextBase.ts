import { createContext } from "react";

import type { Usuario } from "../services/authApi";

export type AuthContextValue = {
  usuario: Usuario | null;
  recuperandoSesion: boolean;
  esAdministrador: boolean;
  permisoError: string;
  iniciarSesion: (username: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  cambiarPassword: (
    passwordActual: string,
    passwordNueva: string
  ) => Promise<void>;
  limpiarPermisoError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
