import { API_URL } from "../config/api";
import {
  apiFetch,
  crearApiError,
  guardarSesion,
  limpiarSesionGuardada,
} from "./httpClient";

export type RolUsuario = "ADMINISTRADOR" | "EMPLEADO";

export type Usuario = {
  id: number;
  nombre: string;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  usuario: Usuario;
};

export async function iniciarSesionApi(
  username: string,
  password: string
): Promise<LoginResponse> {
  limpiarSesionGuardada();

  const response = await fetch(`${API_URL}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw await crearApiError(response, "No se pudo iniciar sesión.");
  }

  const data = (await response.json()) as LoginResponse;
  guardarSesion(data.accessToken, data.usuario);
  return data;
}

export async function recuperarUsuarioApi(): Promise<Usuario> {
  const response = await apiFetch(`${API_URL}/api/v2/auth/me`);

  if (!response.ok) {
    throw await crearApiError(response, "No se pudo recuperar la sesión.");
  }

  return (await response.json()) as Usuario;
}

export async function cerrarSesionApi(): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/v2/auth/logout`, {
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw await crearApiError(response, "No se pudo cerrar la sesión.");
  }
}

export async function cambiarMiPasswordApi(payload: {
  passwordActual: string;
  passwordNueva: string;
}): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/v2/auth/me/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await crearApiError(response, "No se pudo cambiar la contraseña.");
  }
}
