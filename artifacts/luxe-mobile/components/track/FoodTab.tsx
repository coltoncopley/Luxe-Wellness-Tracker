import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getGetDailySummaryQueryKey,
  getListFoodLogsQueryKey,
  useAnalyzeMealPhoto,
  useCreateFoodLog,
  useDeleteFoodLog,
  useGetDailySummary,
  useListFoodLogs,
} from "@workspace/api-client-react";
import type { MealPhotoAnalysis } from "@workspace/api-client-react";

import { Card, Chip, EmptyState, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { NutritionFactsLabel } from "@/components/NutritionFactsLabel";
import { useColors } from "@/hooks/useColors";
import { pickImageAsset, todayStr } from "@/lib/luxe";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export function FoodTab() {
  const c = useColors();
  const queryClient = useQueryClient();
  const date = todayStr();

  const summary = useGetDailySummary({ date });
  const logs = useListFoodLogs({ date });
  const createLog = useCreateFoodLog();
  const deleteLog = useDeleteFoodLog();

  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("breakfast");
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [satFat, setSatFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [cholesterol, setCholesterol] = useState("");
  const [servings, setServings] = useState("1");
  const [servingSize, setServingSize] = useState("");
  const [showMore, setShowMore] = useState(false);

  const analyze = useAnalyzeMealPhoto();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<MealPhotoAnalysis | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date }) });
    void queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date }) });
  };

  async function scanMeal(source: "camera" | "library") {
    setScanning(true);
    try {
      const asset = await pickImageAsset(source, { base64: true });
      if (!asset) return;
      if (!asset.base64) throw new Error("Couldn't read the photo. Please try again.");
      const imageDataUrl = `data:image/jpeg;base64,${asset.base64}`;
      const result = await analyze.mutateAsync({ data: { imageDataUrl } });
      setScanResult(result);
    } catch (err) {
      Alert.alert(
        "Couldn't analyze photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setScanning(false);
    }
  }

  function handleScanMeal() {
    if (scanning) return;
    Alert.alert("Scan a meal", "AI estimates calories, protein, carbs & fat from a photo.", [
      { text: "Take photo", onPress: () => void scanMeal("camera") },
      { text: "Choose from library", onPress: () => void scanMeal("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function logScan() {
    if (!scanResult) return;
    createLog.mutate(
      {
        data: {
          date,
          mealType,
          foodName: scanResult.name,
          calories: scanResult.calories,
          proteinG: scanResult.proteinG,
          carbsG: scanResult.carbsG,
          fatG: scanResult.fatG,
          satFatG: scanResult.satFatG,
          fiberG: scanResult.fiberG,
          sugarG: scanResult.sugarG,
          sodiumMg: scanResult.sodiumMg,
          cholesterolMg: scanResult.cholesterolMg,
        },
      },
      {
        onSuccess: () => {
          setScanResult(null);
          invalidate();
        },
      },
    );
  }

  const resetForm = () => {
    setFoodName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSatFat("");
    setFiber("");
    setSugar("");
    setSodium("");
    setCholesterol("");
    setServings("1");
    setServingSize("");
    setShowMore(false);
  };

  const handleAdd = () => {
    const calPer = parseFloat(calories);
    if (!foodName.trim() || !Number.isFinite(calPer) || calPer < 0) return;
    const servingsNum = servings.trim() ? parseFloat(servings) : 1;
    const mult = Number.isFinite(servingsNum) && servingsNum > 0 ? servingsNum : 1;
    // Inputs are per-serving; we persist totals-as-consumed (per-serving × servings).
    const perServing = (raw: string): number | undefined => {
      if (!raw.trim()) return undefined;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * mult * 10) / 10 : undefined;
    };
    const perServingInt = (raw: string): number | undefined => {
      if (!raw.trim()) return undefined;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * mult) : undefined;
    };
    const proteinVal = perServing(protein);
    const carbsVal = perServing(carbs);
    const fatVal = perServing(fat);
    const satFatVal = perServing(satFat);
    const fiberVal = perServing(fiber);
    const sugarVal = perServing(sugar);
    const sodiumVal = perServingInt(sodium);
    const cholesterolVal = perServingInt(cholesterol);
    createLog.mutate(
      {
        data: {
          date,
          mealType,
          foodName: foodName.trim(),
          calories: Math.round(calPer * mult),
          servings: mult,
          ...(servingSize.trim() ? { servingSize: servingSize.trim() } : {}),
          ...(proteinVal != null ? { proteinG: proteinVal } : {}),
          ...(carbsVal != null ? { carbsG: carbsVal } : {}),
          ...(fatVal != null ? { fatG: fatVal } : {}),
          ...(satFatVal != null ? { satFatG: satFatVal } : {}),
          ...(fiberVal != null ? { fiberG: fiberVal } : {}),
          ...(sugarVal != null ? { sugarG: sugarVal } : {}),
          ...(sodiumVal != null ? { sodiumMg: sodiumVal } : {}),
          ...(cholesterolVal != null ? { cholesterolMg: cholesterolVal } : {}),
        },
      },
      {
        onSuccess: () => {
          resetForm();
          invalidate();
        },
      },
    );
  };

  const s = summary.data;
  const items = logs.data ?? [];

  return (
    <View>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 28, color: c.foreground }}>
            {s?.totalCalories ?? 0}
            <Text style={{ fontSize: 15, color: c.mutedForeground }}> cal today</Text>
          </Text>
          {s?.calorieTarget != null ? (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
              target {s.calorieTarget}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
            Protein {Math.round(s?.totalProteinG ?? 0)}g
          </Text>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
            Carbs {Math.round(s?.totalCarbsG ?? 0)}g
          </Text>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
            Fat {Math.round(s?.totalFatG ?? 0)}g
          </Text>
        </View>
        {items.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <NutritionFactsLabel
              title="Today's Nutrition"
              servingLabel={`${items.length} item${items.length === 1 ? "" : "s"} logged today`}
              values={{
                calories: s?.totalCalories ?? 0,
                proteinG: s?.totalProteinG ?? 0,
                carbsG: s?.totalCarbsG ?? 0,
                fatG: s?.totalFatG ?? 0,
                satFatG: s?.totalSatFatG ?? 0,
                fiberG: s?.totalFiberG ?? 0,
                sugarG: s?.totalSugarG ?? 0,
                sodiumMg: s?.totalSodiumMg ?? 0,
                cholesterolMg: s?.totalCholesterolMg ?? 0,
              }}
            />
          </View>
        ) : null}
      </Card>

      <SectionTitle>Log a meal</SectionTitle>
      <Card style={{ gap: 12 }}>
        <LuxeButton
          label={scanning ? "Analyzing..." : "Scan a meal photo"}
          onPress={handleScanMeal}
          loading={scanning}
        />
        {scanResult ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 14,
              padding: 12,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {scanResult.name}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {scanResult.confidence} confidence estimate
                </Text>
              </View>
              <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: c.primary }}>
                {scanResult.calories} kcal
              </Text>
            </View>
            <NutritionFactsLabel
              servingLabel="AI estimate · per serving"
              values={{
                calories: scanResult.calories,
                proteinG: scanResult.proteinG,
                carbsG: scanResult.carbsG,
                fatG: scanResult.fatG,
                satFatG: scanResult.satFatG,
                fiberG: scanResult.fiberG,
                sugarG: scanResult.sugarG,
                sodiumMg: scanResult.sodiumMg,
                cholesterolMg: scanResult.cholesterolMg,
              }}
            />
            {scanResult.notes ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                {scanResult.notes}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {MEAL_TYPES.map((m) => (
                <Chip
                  key={m}
                  label={m.charAt(0).toUpperCase() + m.slice(1)}
                  active={mealType === m}
                  onPress={() => setMealType(m)}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <LuxeButton
                  label="Log this meal"
                  onPress={logScan}
                  loading={createLog.isPending}
                />
              </View>
              <Pressable hitSlop={8} onPress={() => setScanResult(null)} disabled={createLog.isPending}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.mutedForeground }}>
                  Discard
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: c.mutedForeground,
            textAlign: "center",
          }}
        >
          or enter it manually
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {MEAL_TYPES.map((m) => (
            <Chip
              key={m}
              label={m.charAt(0).toUpperCase() + m.slice(1)}
              active={mealType === m}
              onPress={() => setMealType(m)}
            />
          ))}
        </View>
        <LuxeInput placeholder="What did you eat?" value={foodName} onChangeText={setFoodName} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <LuxeInput
            placeholder="Serving size (e.g. 1 cup)"
            value={servingSize}
            onChangeText={setServingSize}
            style={{ flex: 2 }}
          />
          <LuxeInput
            placeholder="Servings"
            keyboardType="decimal-pad"
            value={servings}
            onChangeText={setServings}
            style={{ flex: 1 }}
          />
        </View>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
          Enter amounts per serving — we multiply by servings for your daily total.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <LuxeInput
            placeholder="Calories"
            keyboardType="number-pad"
            value={calories}
            onChangeText={setCalories}
            style={{ flex: 1 }}
          />
          <LuxeInput
            placeholder="Protein g"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={setProtein}
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <LuxeInput
            placeholder="Carbs g"
            keyboardType="decimal-pad"
            value={carbs}
            onChangeText={setCarbs}
            style={{ flex: 1 }}
          />
          <LuxeInput
            placeholder="Fat g"
            keyboardType="decimal-pad"
            value={fat}
            onChangeText={setFat}
            style={{ flex: 1 }}
          />
        </View>
        <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={6}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.primary }}>
            {showMore ? "− Fewer nutrients" : "+ More nutrients"}
          </Text>
        </Pressable>
        {showMore ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LuxeInput
                placeholder="Sat. fat g"
                keyboardType="decimal-pad"
                value={satFat}
                onChangeText={setSatFat}
                style={{ flex: 1 }}
              />
              <LuxeInput
                placeholder="Fiber g"
                keyboardType="decimal-pad"
                value={fiber}
                onChangeText={setFiber}
                style={{ flex: 1 }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LuxeInput
                placeholder="Sugar g"
                keyboardType="decimal-pad"
                value={sugar}
                onChangeText={setSugar}
                style={{ flex: 1 }}
              />
              <LuxeInput
                placeholder="Sodium mg"
                keyboardType="number-pad"
                value={sodium}
                onChangeText={setSodium}
                style={{ flex: 1 }}
              />
            </View>
            <LuxeInput
              placeholder="Cholesterol mg"
              keyboardType="number-pad"
              value={cholesterol}
              onChangeText={setCholesterol}
            />
          </View>
        ) : null}
        <LuxeButton
          label="Add meal"
          onPress={handleAdd}
          loading={createLog.isPending}
          disabled={!foodName.trim() || !calories.trim()}
        />
      </Card>

      <SectionTitle>Today's meals</SectionTitle>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon="coffee" text="Nothing logged yet today." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {items.map((f, i) => (
            <View
              key={f.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {f.foodName}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {f.mealType.charAt(0).toUpperCase() + f.mealType.slice(1)}
                  {f.servings != null && f.servings !== 1
                    ? ` · ${Math.round(f.servings * 100) / 100}×${f.servingSize ? ` ${f.servingSize}` : ""}`
                    : f.servingSize
                      ? ` · ${f.servingSize}`
                      : ""}
                  {f.proteinG != null ? ` · ${Math.round(f.proteinG)}g protein` : ""}
                  {f.fiberG != null ? ` · ${Math.round(f.fiberG)}g fiber` : ""}
                  {f.sodiumMg != null ? ` · ${Math.round(f.sodiumMg)}mg sodium` : ""}
                </Text>
              </View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                {f.calories} cal
              </Text>
              <Pressable
                hitSlop={10}
                style={{ marginLeft: 14 }}
                onPress={() =>
                  Alert.alert("Delete meal?", `Remove "${f.foodName}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteLog.mutate({ id: f.id }, { onSuccess: invalidate }),
                    },
                  ])
                }
              >
                <Feather name="trash-2" size={16} color={c.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
