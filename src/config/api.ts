const LOCAL_API_URL = "http://localhost:8080";
const PRODUCTION_API_URL =
  "https://biencriollas-backend-production.up.railway.app";

const configuredApiUrl = import.meta.env.PROD
  ? import.meta.env.VITE_PRODUCTION_API_URL
  : import.meta.env.VITE_API_URL;

export const API_URL = (
  configuredApiUrl ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : LOCAL_API_URL)
).replace(/\/$/, "");
