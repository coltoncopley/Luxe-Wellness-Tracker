// FDA "Nutrition Facts" reference Daily Values (2,000 kcal diet).
// Total Sugars and Protein deliberately have no %DV — that matches the
// current FDA label (only Added Sugars carries a %DV, which we don't track).
export const DAILY_VALUES = {
  fatG: 78,
  satFatG: 20,
  cholesterolMg: 300,
  sodiumMg: 2300,
  carbsG: 275,
  fiberG: 28,
} as const;

export function pctDV(value: number | null | undefined, dv: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round((value / dv) * 100);
}

export function fmtG(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}g`;
}

export function fmtMg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}mg`;
}
