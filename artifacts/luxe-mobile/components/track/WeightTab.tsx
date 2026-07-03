import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getGetGoalQueryKey,
  getGetWeightProgressQueryKey,
  useCreateWeightEntry,
  useDeleteWeightEntry,
  useGetGoal,
  useGetWeightProgress,
  useSetGoal,
} from "@workspace/api-client-react";

import { Card, EmptyState, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate, todayStr } from "@/lib/luxe";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const c = useColors();
  return (
    <Card style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12 }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 20,
          color: accent ? c.tint : c.foreground,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </Card>
  );
}

export function WeightTab() {
  const c = useColors();
  const queryClient = useQueryClient();
  const progress = useGetWeightProgress();
  const goal = useGetGoal();
  const createEntry = useCreateWeightEntry();
  const deleteEntry = useDeleteWeightEntry();
  const setGoal = useSetGoal();

  const [weightInput, setWeightInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWeightProgressQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetGoalQueryKey() });
  };

  const p = progress.data;
  const entries = p?.entries ?? [];
  const recent = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14);

  const handleAdd = () => {
    const w = parseFloat(weightInput);
    if (!Number.isFinite(w) || w <= 0 || w > 1500) return;
    createEntry.mutate(
      { data: { date: todayStr(), weightLbs: w } },
      {
        onSuccess: () => {
          setWeightInput("");
          invalidate();
        },
      },
    );
  };

  const handleSaveGoal = () => {
    const g = parseFloat(goalInput);
    if (!Number.isFinite(g) || g <= 0 || g > 1500) return;
    setGoal.mutate(
      { data: { goalWeightLbs: g } },
      {
        onSuccess: () => {
          setEditingGoal(false);
          setGoalInput("");
          invalidate();
        },
      },
    );
  };

  const pct = p?.percentToGoal;

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat
          label="Current"
          value={p?.currentWeightLbs != null ? `${p.currentWeightLbs.toFixed(1)}` : "—"}
        />
        <Stat
          label="Change"
          value={
            p?.totalChangeLbs != null
              ? `${p.totalChangeLbs > 0 ? "+" : ""}${p.totalChangeLbs.toFixed(1)}`
              : "—"
          }
          accent
        />
        <Stat
          label="Goal"
          value={p?.goalWeightLbs != null ? `${p.goalWeightLbs.toFixed(0)}` : "—"}
        />
      </View>

      {pct != null ? (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
              Progress to goal
            </Text>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.tint }}>
              {Math.round(Math.max(0, Math.min(100, pct)))}%
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: c.secondary, borderRadius: 4 }}>
            <View
              style={{
                height: 8,
                width: `${Math.max(0, Math.min(100, pct))}%`,
                backgroundColor: c.accent,
                borderRadius: 4,
              }}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle>Log today's weigh-in</SectionTitle>
      <Card style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <LuxeInput
          placeholder="Weight (lbs)"
          keyboardType="decimal-pad"
          value={weightInput}
          onChangeText={setWeightInput}
          style={{ flex: 1 }}
        />
        <LuxeButton
          label="Save"
          onPress={handleAdd}
          loading={createEntry.isPending}
          disabled={!weightInput.trim()}
          small
        />
      </Card>

      <SectionTitle>Goal weight</SectionTitle>
      <Card>
        {editingGoal ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <LuxeInput
              placeholder="Goal weight (lbs)"
              keyboardType="decimal-pad"
              value={goalInput}
              onChangeText={setGoalInput}
              style={{ flex: 1 }}
            />
            <LuxeButton label="Save" onPress={handleSaveGoal} loading={setGoal.isPending} small />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: c.foreground }}>
              {goal.data?.goalWeightLbs != null
                ? `${goal.data.goalWeightLbs.toFixed(0)} lbs`
                : "No goal set yet"}
            </Text>
            <LuxeButton
              label={goal.data?.goalWeightLbs != null ? "Edit" : "Set goal"}
              variant="outline"
              small
              onPress={() => {
                setGoalInput(goal.data?.goalWeightLbs != null ? String(goal.data.goalWeightLbs) : "");
                setEditingGoal(true);
              }}
            />
          </View>
        )}
      </Card>

      <SectionTitle>Recent entries</SectionTitle>
      {recent.length === 0 ? (
        <Card>
          <EmptyState icon="trending-down" text="No weigh-ins yet. Log your first one above." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {recent.map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
                {fmtDate(e.date)}
              </Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                {e.weightLbs.toFixed(1)} lbs
              </Text>
              <Pressable
                hitSlop={10}
                style={{ marginLeft: 16 }}
                onPress={() =>
                  Alert.alert("Delete entry?", `Remove the ${fmtDate(e.date)} weigh-in?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteEntry.mutate({ id: e.id }, { onSuccess: invalidate }),
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
