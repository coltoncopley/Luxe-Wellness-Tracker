import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { DAILY_VALUES, fmtG, fmtMg, pctDV } from "@/lib/nutrition";

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

export function NutritionFactsLabel({
  values,
  servingLabel,
  title = "Nutrition Facts",
}: {
  values: NutritionValues;
  servingLabel?: string | null;
  title?: string;
}) {
  const c = useColors();

  const Row = ({
    label,
    amount,
    pct,
    indent,
    strong,
    thick,
  }: {
    label: string;
    amount: string;
    pct?: number | null;
    indent?: boolean;
    strong?: boolean;
    thick?: boolean;
  }) => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderTopWidth: thick ? 2 : 1,
        borderTopColor: c.border,
        paddingVertical: 3,
        paddingLeft: indent ? 16 : 0,
      }}
    >
      <Text style={{ fontSize: 13, color: c.foreground }}>
        <Text style={{ fontFamily: strong ? "Inter_700Bold" : "Inter_600SemiBold" }}>{label}</Text>
        <Text style={{ fontFamily: "Inter_400Regular" }}> {amount}</Text>
      </Text>
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: c.foreground }}>
        {pct != null ? `${pct}%` : ""}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: c.foreground,
        borderRadius: 12,
        padding: 12,
        backgroundColor: c.card,
      }}
    >
      <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 24, color: c.foreground }}>
        {title}
      </Text>
      {servingLabel ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: c.mutedForeground,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
            marginTop: 2,
          }}
        >
          {servingLabel}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottomWidth: 6,
          borderBottomColor: c.foreground,
          paddingBottom: 4,
          marginTop: 6,
        }}
      >
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground }}>
          Calories
        </Text>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 30, color: c.foreground }}>
          {Math.round(values.calories)}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 11,
          color: c.foreground,
          textAlign: "right",
          marginTop: 6,
        }}
      >
        % Daily Value*
      </Text>

      <Row label="Total Fat" amount={fmtG(values.fatG)} pct={pctDV(values.fatG, DAILY_VALUES.fatG)} strong />
      <Row
        label="Saturated Fat"
        amount={fmtG(values.satFatG)}
        pct={pctDV(values.satFatG, DAILY_VALUES.satFatG)}
        indent
      />
      <Row
        label="Cholesterol"
        amount={fmtMg(values.cholesterolMg)}
        pct={pctDV(values.cholesterolMg, DAILY_VALUES.cholesterolMg)}
        strong
      />
      <Row
        label="Sodium"
        amount={fmtMg(values.sodiumMg)}
        pct={pctDV(values.sodiumMg, DAILY_VALUES.sodiumMg)}
        strong
      />
      <Row
        label="Total Carbohydrate"
        amount={fmtG(values.carbsG)}
        pct={pctDV(values.carbsG, DAILY_VALUES.carbsG)}
        strong
      />
      <Row
        label="Dietary Fiber"
        amount={fmtG(values.fiberG)}
        pct={pctDV(values.fiberG, DAILY_VALUES.fiberG)}
        indent
      />
      <Row label="Total Sugars" amount={fmtG(values.sugarG)} indent />
      <Row label="Protein" amount={fmtG(values.proteinG)} strong />

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 10,
          lineHeight: 13,
          color: c.mutedForeground,
          borderTopWidth: 4,
          borderTopColor: c.foreground,
          paddingTop: 6,
          marginTop: 6,
        }}
      >
        * Percent Daily Values are based on a 2,000 calorie diet. Values are estimates and may vary.
      </Text>
    </View>
  );
}
