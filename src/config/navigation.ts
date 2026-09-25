import type { AppPage } from "../components/Sidebar";

export const productionEnabled = import.meta.env.VITE_PRODUCTION_ENABLED === "true";

const productionPages: AppPage[] = [
  "ingredientes", "recetas", "proceso", "produccion-real", "costos-rendimiento",
];

const enabledProductionPages = new Set<AppPage>([
  "ingredientes",
  "recetas",
  "proceso",
  "produccion-real",
]);

export function isPageAvailable(page: AppPage): boolean {
  if (!productionPages.includes(page)) return true;
  return productionEnabled && enabledProductionPages.has(page);
}
