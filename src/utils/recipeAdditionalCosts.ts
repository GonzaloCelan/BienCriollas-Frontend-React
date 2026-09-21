export type AdditionalCostType = "LABOR" | "PACKAGING" | "ENERGY" | "OTHER";

export type AdditionalCostCalculationMode = "FIXED_TOTAL" | "PER_UNIT" | "PERCENTAGE";

export const additionalCostTypeOptions: Array<{ value: AdditionalCostType; label: string }> = [
  { value: "LABOR", label: "Mano de obra" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "ENERGY", label: "Energía" },
  { value: "OTHER", label: "Otro" },
];

export const additionalCostModeOptions: Array<{ value: AdditionalCostCalculationMode; label: string }> = [
  { value: "FIXED_TOTAL", label: "Total fijo" },
  { value: "PER_UNIT", label: "Por unidad" },
  { value: "PERCENTAGE", label: "Porcentaje" },
];

export function forcedModeForCostType(type: AdditionalCostType): AdditionalCostCalculationMode | null {
  if (type === "LABOR") return "FIXED_TOTAL";
  if (type === "PACKAGING") return "PER_UNIT";
  if (type === "ENERGY") return "PERCENTAGE";
  return null;
}

export function additionalCostTypeLabel(type: AdditionalCostType) {
  return additionalCostTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function additionalCostModeLabel(mode: AdditionalCostCalculationMode) {
  return additionalCostModeOptions.find((option) => option.value === mode)?.label ?? mode;
}
