import { API_URL } from "../config/api";
import type { RolUsuario, Usuario } from "./authApi";
import { apiFetch, crearApiError } from "./httpClient";

export type CrearUsuarioPayload = {
  nombre: string;
  username: string;
  password: string;
  rol: RolUsuario;
};

async function procesar<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

export async function listarUsuariosApi(): Promise<Usuario[]> {
  const response = await apiFetch(`${API_URL}/api/v2/usuarios`);
  return procesar<Usuario[]>(response, "No se pudieron obtener los usuarios.");
}

export async function crearUsuarioApi(
  payload: CrearUsuarioPayload
): Promise<Usuario> {
  const response = await apiFetch(`${API_URL}/api/v2/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return procesar<Usuario>(response, "No se pudo crear el usuario.");
}

export async function cambiarEstadoUsuarioApi(
  id: number,
  activo: boolean
): Promise<Usuario> {
  const response = await apiFetch(`${API_URL}/api/v2/usuarios/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activo }),
  });
  return procesar<Usuario>(response, "No se pudo cambiar el estado.");
}

export async function cambiarRolUsuarioApi(
  id: number,
  rol: RolUsuario
): Promise<Usuario> {
  const response = await apiFetch(`${API_URL}/api/v2/usuarios/${id}/rol`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rol }),
  });
  return procesar<Usuario>(response, "No se pudo cambiar el rol.");
}

export async function restablecerPasswordUsuarioApi(
  id: number,
  password: string
): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/v2/usuarios/${id}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw await crearApiError(response, "No se pudo restablecer la contraseña.");
  }
}
