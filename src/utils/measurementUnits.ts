export type MeasurementUnit = "GRAM" | "MILLILITER" | "UNIT";

const UNIT_SYMBOLS: Record<MeasurementUnit, string> = {
  GRAM: "g",
  MILLILITER: "ml",
  UNIT: "u.",
};

const UNIT_NAMES: Record<MeasurementUnit, string> = {
  GRAM: "gramos",
  MILLILITER: "mililitros",
  UNIT: "unidades",
};

export function measurementUnitSymbol(unit: MeasurementUnit): string {
  return UNIT_SYMBOLS[unit];
}

export function measurementUnitName(unit: MeasurementUnit): string {
  return UNIT_NAMES[unit];
}

export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });
  if (unit === "GRAM" && Math.abs(value) >= 1000) return `${formatter.format(value / 1000)} kg`;
  if (unit === "MILLILITER" && Math.abs(value) >= 1000) return `${formatter.format(value / 1000)} L`;
  return `${formatter.format(value)} ${UNIT_SYMBOLS[unit]}`;
}
