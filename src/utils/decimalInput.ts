/**
 * Convierte un decimal escrito con punto o coma a la representación numérica
 * que usa la API. Si aparecen ambos separadores, el último es el decimal y el
 * otro se considera separador de miles.
 */
export function normalizeDecimalInput(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, "").replace(/[^\d.,+-]/g, "");
  if (!cleaned) return "";

  const sign = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/[+-]/g, "");
  const lastDot = unsigned.lastIndexOf(".");
  const lastComma = unsigned.lastIndexOf(",");
  const decimalIndex = Math.max(lastDot, lastComma);

  if (decimalIndex < 0) return `${sign}${unsigned.replace(/\D/g, "")}`;

  const integerPart = unsigned.slice(0, decimalIndex).replace(/\D/g, "");
  const decimalPart = unsigned.slice(decimalIndex + 1).replace(/\D/g, "");
  return `${sign}${integerPart || "0"}.${decimalPart}`;
}

export function parseDecimalInput(value: string): number {
  const normalized = normalizeDecimalInput(value);
  if (!normalized || normalized === "-" || normalized.endsWith(".")) return Number.NaN;
  return Number(normalized);
}

export function decimalPlaces(value: string): number {
  const normalized = normalizeDecimalInput(value);
  const separatorIndex = normalized.indexOf(".");
  return separatorIndex < 0 ? 0 : normalized.length - separatorIndex - 1;
}

export function formatDecimalInput(value: number, maximumFractionDigits = 6): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(maximumFractionDigits).replace(/\.?0+$/, "");
}
