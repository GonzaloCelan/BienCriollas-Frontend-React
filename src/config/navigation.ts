import type { AppPage } from "../components/Sidebar";

export const productionEnabled = import.meta.env.VITE_PRODUCTION_ENABLED === "true";

const productionPages: AppPage[] = [
  "ingredientes", "recetas", "proceso", "produccion-real", "costos-rendimiento",
];

export function isPageAvailable(page: AppPage): boolean {
  return productionEnabled || !productionPages.includes(page);
}
