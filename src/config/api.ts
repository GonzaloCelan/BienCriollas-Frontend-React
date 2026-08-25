const LOCAL_API_URL = "http://localhost:8080";
const PRODUCTION_API_URL =
  "https://biencriollas-backend-production.up.railway.app";

const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL;
const legacyApiUrl = import.meta.env.PROD
  ? import.meta.env.VITE_PRODUCTION_API_URL
  : import.meta.env.VITE_API_URL;

export const BACKEND_URL = (
  configuredBackendUrl ||
  legacyApiUrl ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : LOCAL_API_URL)
)
  .trim()
  .replace(/\/$/, "");

export const API_URL = BACKEND_URL;
