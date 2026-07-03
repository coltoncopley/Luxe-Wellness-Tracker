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

  const handleAdd = () => {
    const cal = parseInt(calories, 10);
    if (!foodName.trim() || !Number.isFinite(cal) || cal < 0) return;
    const proteinVal = protein.trim() ? parseFloat(protein) : undefined;
    createLog.mutate(
      {
        data: {
          date,
          mealType,
          foodName: foodName.trim(),
          calories: cal,
          ...(proteinVal != null && Number.isFinite(proteinVal) ? { proteinG: proteinVal } : {}),
        },
      },
      {
        onSuccess: () => {
          setFoodName("");
          setCalories("");
          setProtein("");
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
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
                P: {Math.round(scanResult.proteinG)}g
              </Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
                C: {Math.round(scanResult.carbsG)}g
              </Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
                F: {Math.round(scanResult.fatG)}g
              </Text>
            </View>
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
            placeholder="Calories"
            keyboardType="number-pad"
            value={calories}
            onChangeText={setCalories}
            style={{ flex: 1 }}
          />
          <LuxeInput
            placeholder="Protein g (optional)"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={setProtein}
            style={{ flex: 1 }}
          />
        </View>
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
                  {f.proteinG != null ? ` · ${Math.round(f.proteinG)}g protein` : ""}
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
