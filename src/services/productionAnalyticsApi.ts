import { API_URL } from "../config/api";
import type { MeasurementUnit } from "../utils/measurementUnits";
import { apiFetch, crearApiError } from "./httpClient";

const BASE_URL = `${API_URL}/api/v1/production-analytics`;

export type PerformanceStatus = "EXCELLENT" | "GOOD" | "NORMAL" | "WARNING" | "CRITICAL";

export type AnalyticsSettings = {
  averageHourlyLaborCost: number;
  energyPercentage: number;
  updatedAt: string;
};

export type ProductionSummary = {
  from: string;
  to: string;
  totalProductions: number;
  totalUnitsProduced: number;
  totalWasteUnits: number;
  totalIngredientCost: number;
  totalLaborCost: number;
  totalEnergyCost: number;
  totalPackagingCost: number;
  totalOtherAdditionalCost: number;
  totalProductionCost: number;
  averageCostPerUnit: number | null;
  totalPersonHours: number;
  averageUnitsPerPersonHour: number | null;
  averageProductivityVariationPercentage: number | null;
  totalLaborInefficiencyCost: number;
  totalEstimatedWasteCost: number;
  efficientProductions: number;
  inefficientProductions: number;
};

export type LaborSummary = {
  totalPersonHours: number;
  expectedPersonHours: number;
  extraPersonHours: number;
  averageUnitsPerPersonHour: number | null;
  standardUnitsPerPersonHour: number | null;
  productivityVariationPercentage: number | null;
  actualLaborCost: number;
  expectedLaborCost: number;
  laborInefficiencyCost: number;
};

export type VarietyPerformance = {
  varietyId: number;
  varietyName: string;
  productionCount: number;
  totalUnitsProduced: number;
  totalWasteUnits: number;
  averageWastePercentage: number | null;
  totalIngredientCost: number;
  totalLaborCost: number;
  totalPackagingCost: number;
  totalOtherAdditionalCost: number;
  totalEnergyCost: number;
  totalProductionCost: number;
  averageCostPerUnit: number | null;
  averageUnitsPerHour: number | null;
  averageUnitsPerPersonHour: number | null;
  averageLaborProductivityVariation: number | null;
  laborInefficiencyCost: number;
  totalCostDeviation: number;
};

export type IngredientDeviation = {
  ingredientId: number;
  ingredientName: string;
  measurementUnit: MeasurementUnit;
  totalExpectedQuantity: number;
  totalActualQuantity: number;
  differenceQuantity: number;
  differencePercentage: number | null;
  additionalCost: number;
};

export type WasteAnalysis = {
  reason: string;
  totalUnits: number;
  percentage: number;
  estimatedCost: number;
};

export type ProductionRanking = {
  productionId: number;
  productionDate: string;
  varietyName: string;
  finalUnits: number;
  actualUnitsPerPersonHour: number | null;
  productivityVariationPercentage: number | null;
  laborInefficiencyCost: number;
  actualCostPerUnit: number | null;
};

export type ProductionPerformance = {
  productionId: number;
  productionDate: string;
  varietyId: number;
  varietyName: string;
  plannedUnits: number;
  finalUnits: number;
  wasteUnits: number;
  wastePercentage: number | null;
  totalMinutes: number | null;
  peopleCount: number | null;
  expectedIngredientCost: number;
  actualIngredientCost: number;
  ingredientCostDeviation: number;
  standardUnitsPerHour: number | null;
  actualUnitsPerHour: number | null;
  productivityVariationPercentage: number | null;
  standardPersonHours: number | null;
  actualPersonHours: number | null;
  standardUnitsPerPersonHour: number | null;
  actualUnitsPerPersonHour: number | null;
  laborProductivityVariationPercentage: number | null;
  laborHourlyCostSnapshot: number | null;
  expectedPersonHoursForActualOutput: number | null;
  expectedLaborCostForActualOutput: number | null;
  actualLaborCost: number | null;
  laborInefficiencyCost: number | null;
  energyCost: number | null;
  expectedEnergyCost: number | null;
  energyCostDeviation: number | null;
  expectedPackagingCost: number | null;
  actualPackagingCost: number | null;
  packagingCostDeviation: number | null;
  expectedOtherAdditionalCost: number | null;
  actualOtherAdditionalCost: number | null;
  otherAdditionalCostDeviation: number | null;
  standardTotalCost: number | null;
  actualTotalCost: number | null;
  standardCostPerUnit: number | null;
  actualCostPerUnit: number | null;
  totalCostDeviation: number | null;
  totalCostDeviationPerUnit: number | null;
  estimatedWasteCost: number | null;
  performanceStatus: PerformanceStatus | null;
};

type DateRange = { from: string; to: string };

async function processResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await crearApiError(response, fallback);
  return (await response.json()) as T;
}

function rangeQuery(range: DateRange, extra?: Record<string, string>) {
  return new URLSearchParams({ from: range.from, to: range.to, ...extra }).toString();
}

export async function getAnalyticsSettingsApi() {
  return processResponse<AnalyticsSettings>(await apiFetch(`${BASE_URL}/settings`), "No se pudo cargar la configuración de costos.");
}

export async function updateAnalyticsSettingsApi(payload: Pick<AnalyticsSettings, "averageHourlyLaborCost" | "energyPercentage">) {
  return processResponse<AnalyticsSettings>(await apiFetch(`${BASE_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }), "No se pudo actualizar la configuración de costos.");
}

export async function getProductionSummaryApi(range: DateRange) {
  return processResponse<ProductionSummary>(await apiFetch(`${BASE_URL}/summary?${rangeQuery(range)}`), "No se pudo cargar el resumen de producción.");
}

export async function getLaborSummaryApi(range: DateRange) {
  return processResponse<LaborSummary>(await apiFetch(`${BASE_URL}/labor?${rangeQuery(range)}`), "No se pudo cargar el resumen de mano de obra.");
}

export async function getProductionPerformanceApi(productionId: number) {
  return processResponse<ProductionPerformance>(await apiFetch(`${BASE_URL}/productions/${productionId}`), "No se pudo cargar el rendimiento de la producción.");
}

export async function getVarietiesPerformanceApi(range: DateRange) {
  return processResponse<VarietyPerformance[]>(await apiFetch(`${BASE_URL}/varieties?${rangeQuery(range)}`), "No se pudo cargar el análisis por variedad.");
}

export async function getVarietyPerformanceApi(varietyId: number, range: DateRange) {
  return processResponse<VarietyPerformance>(await apiFetch(`${BASE_URL}/varieties/${varietyId}?${rangeQuery(range)}`), "No se pudo cargar el rendimiento de la variedad.");
}

export async function getIngredientDeviationsApi(range: DateRange) {
  return processResponse<IngredientDeviation[]>(await apiFetch(`${BASE_URL}/ingredients/deviations?${rangeQuery(range)}`), "No se pudieron cargar los desvíos de ingredientes.");
}

export async function getWasteAnalysisApi(range: DateRange) {
  return processResponse<WasteAnalysis[]>(await apiFetch(`${BASE_URL}/waste?${rangeQuery(range)}`), "No se pudo cargar el análisis de merma.");
}

export async function getProductionRankingApi(kind: "best" | "worst", range: DateRange, limit = 5) {
  return processResponse<ProductionRanking[]>(await apiFetch(`${BASE_URL}/ranking/${kind}?${rangeQuery(range, { limit: String(limit) })}`), "No se pudo cargar el ranking de producciones.");
}
