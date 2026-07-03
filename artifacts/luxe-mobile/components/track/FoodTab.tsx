import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import {
  getGetDailySummaryQueryKey,
  getListFoodLogsQueryKey,
  useCreateFoodLog,
  useDeleteFoodLog,
  useGetDailySummary,
  useListFoodLogs,
} from "@workspace/api-client-react";

import { Card, Chip, EmptyState, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { todayStr } from "@/lib/luxe";

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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey({ date }) });
    void queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date }) });
  };

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
