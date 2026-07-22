import { DAILY_VALUES, pctDV, fmtG, fmtMg } from "@/lib/nutrition";

export type NutritionValues = {
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  satFatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  cholesterolMg?: number | null;
};

function LabelRow({
  label,
  amount,
  pct,
  indent,
  strong,
}: {
  label: string;
  amount: string;
  pct?: number | null;
  indent?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-t border-black/70 py-0.5 leading-snug ${
        indent ? "pl-4" : ""
      }`}
    >
      <span>
        <span className={strong ? "font-bold" : "font-semibold"}>{label}</span>{" "}
        <span>{amount}</span>
      </span>
      <span className="font-bold tabular-nums">{pct != null ? `${pct}%` : ""}</span>
    </div>
  );
}

export function NutritionFactsLabel({
  values,
  servingLabel,
  title = "Nutrition Facts",
  className = "",
}: {
  values: NutritionValues;
  servingLabel?: string | null;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border-2 border-black bg-white p-3 font-sans text-black ${className}`}
      data-testid="nutrition-facts-label"
    >
      <div className="text-2xl font-extrabold leading-none tracking-tight">{title}</div>
      {servingLabel ? (
        <div className="mt-0.5 border-b border-black/70 pb-1 text-xs">{servingLabel}</div>
      ) : null}

      <div className="mt-1 flex items-end justify-between border-b-8 border-black pb-1">
        <span className="text-lg font-extrabold">Calories</span>
        <span className="text-3xl font-extrabold tabular-nums">
          {Math.round(values.calories)}
        </span>
      </div>

      <div className="mt-1 text-right text-[11px] font-bold">% Daily Value*</div>

      <div className="text-sm">
        <LabelRow
          label="Total Fat"
          amount={fmtG(values.fatG)}
          pct={pctDV(values.fatG, DAILY_VALUES.fatG)}
          strong
        />
        <LabelRow
          label="Saturated Fat"
          amount={fmtG(values.satFatG)}
          pct={pctDV(values.satFatG, DAILY_VALUES.satFatG)}
          indent
        />
        <LabelRow
          label="Cholesterol"
          amount={fmtMg(values.cholesterolMg)}
          pct={pctDV(values.cholesterolMg, DAILY_VALUES.cholesterolMg)}
          strong
        />
        <LabelRow
          label="Sodium"
          amount={fmtMg(values.sodiumMg)}
          pct={pctDV(values.sodiumMg, DAILY_VALUES.sodiumMg)}
          strong
        />
        <LabelRow
          label="Total Carbohydrate"
          amount={fmtG(values.carbsG)}
          pct={pctDV(values.carbsG, DAILY_VALUES.carbsG)}
          strong
        />
        <LabelRow
          label="Dietary Fiber"
          amount={fmtG(values.fiberG)}
          pct={pctDV(values.fiberG, DAILY_VALUES.fiberG)}
          indent
        />
        <LabelRow label="Total Sugars" amount={fmtG(values.sugarG)} indent />
        <LabelRow label="Protein" amount={fmtG(values.proteinG)} strong />
      </div>

      <p className="mt-2 border-t-4 border-black pt-1 text-[10px] leading-tight text-black/70">
        * Percent Daily Values are based on a 2,000 calorie diet. Values are estimates and may vary.
      </p>
    </div>
  );
}
