export const ACCESS_TOKEN_KEY = "accessToken";
export const USER_STORAGE_KEY = "usuario";
export const AUTH_UNAUTHORIZED_EVENT = "bien-criollas:unauthorized";
export const AUTH_FORBIDDEN_EVENT = "bien-criollas:forbidden";

export type BackendErrorBody = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
};

export class ApiError extends Error {
  status: number;
  body: BackendErrorBody | null;

  constructor(message: string, status: number, body: BackendErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function obtenerAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function limpiarSesionGuardada() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

export function guardarSesion(token: string, usuario: unknown) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(usuario));
}

async function leerError(response: Response): Promise<BackendErrorBody | null> {
  try {
    return (await response.clone().json()) as BackendErrorBody;
  } catch {
    return null;
  }
}

export async function crearApiError(
  response: Response,
  fallbackMessage: string
) {
  const body = await leerError(response);
  return new ApiError(body?.message || fallbackMessage, response.status, body);
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  const token = obtenerAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    const error = await leerError(response);
    limpiarSesionGuardada();
    window.dispatchEvent(
      new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
        detail: error?.message || "Tu sesión venció. Volvé a ingresar.",
      })
    );
  } else if (response.status === 403) {
    const error = await leerError(response);
    window.dispatchEvent(
      new CustomEvent(AUTH_FORBIDDEN_EVENT, {
        detail:
          error?.message || "No tenés permisos para realizar esta operación.",
      })
    );
  }

  return response;
}
