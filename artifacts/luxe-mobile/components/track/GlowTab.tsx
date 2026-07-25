import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import {
  getGetGlowSummaryQueryKey,
  useGetGlowSummary,
  useUpsertGlowCheckin,
} from "@workspace/api-client-react";

import { ScoreRing } from "@/components/ScoreRing";
import { Card, LuxeButton, SectionTitle, Stepper } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

export function GlowTab() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const summary = useGetGlowSummary();
  const upsert = useUpsertGlowCheckin();

  const today = summary.data?.today ?? null;

  const [draft, setDraft] = useState<{
    waterCups?: number;
    sleepHours?: number;
    stressLevel?: number;
    activityMinutes?: number;
    proteinGrams?: number;
    skincareDone?: boolean;
  }>({});

  const water = draft.waterCups ?? today?.waterCups ?? 0;
  const sleep = draft.sleepHours ?? today?.sleepHours ?? 0;
  const stress = draft.stressLevel ?? today?.stressLevel ?? 3;
  const activity = draft.activityMinutes ?? today?.activityMinutes ?? 0;
  const protein = draft.proteinGrams ?? today?.proteinGrams ?? 0;
  const skincare = draft.skincareDone ?? today?.skincareDone ?? false;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const handleSave = () => {
    upsert.mutate(
      {
        data: {
          waterCups: water,
          sleepHours: sleep,
          stressLevel: stress,
          activityMinutes: activity,
          proteinGrams: protein,
          skincareDone: skincare,
        },
      },
      {
        onSuccess: () => {
          setDraft({});
          void queryClient.invalidateQueries({ queryKey: getGetGlowSummaryQueryKey() });
        },
      },
    );
  };

  const history = (summary.data?.history ?? []).slice(-7);

  return (
    <View>
      <Card style={{ alignItems: "center", paddingVertical: 24 }}>
        <ScoreRing score={today?.score ?? 0} label="Glow Score" />
        <Text style={{ marginTop: 12, fontFamily: "Inter_500Medium", fontSize: 14, color: c.mutedForeground }}>
          {summary.data?.streakDays ? `🔥 ${summary.data.streakDays}-day streak` : "Check in daily to build your streak"}
        </Text>
      </Card>

      <SectionTitle>Today's habits</SectionTitle>
      <Card>
        <Stepper
          label="Water (cups)"
          value={water}
          onDecrement={() => setDraft((d) => ({ ...d, waterCups: clamp(water - 1, 0, 30) }))}
          onIncrement={() => setDraft((d) => ({ ...d, waterCups: clamp(water + 1, 0, 30) }))}
        />
        <Stepper
          label="Sleep (hours)"
          value={sleep}
          display={sleep.toFixed(1)}
          onDecrement={() => setDraft((d) => ({ ...d, sleepHours: clamp(sleep - 0.5, 0, 24) }))}
          onIncrement={() => setDraft((d) => ({ ...d, sleepHours: clamp(sleep + 0.5, 0, 24) }))}
        />
        <Stepper
          label="Activity (min)"
          value={activity}
          onDecrement={() => setDraft((d) => ({ ...d, activityMinutes: clamp(activity - 15, 0, 1440) }))}
          onIncrement={() => setDraft((d) => ({ ...d, activityMinutes: clamp(activity + 15, 0, 1440) }))}
        />
        <Stepper
          label="Protein (g)"
          value={protein}
          onDecrement={() => setDraft((d) => ({ ...d, proteinGrams: clamp(protein - 10, 0, 1000) }))}
          onIncrement={() => setDraft((d) => ({ ...d, proteinGrams: clamp(protein + 10, 0, 1000) }))}
        />

        <View style={{ paddingVertical: 10 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground, marginBottom: 10 }}>
            Stress level
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setDraft((d) => ({ ...d, stressLevel: n }))}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: stress === n ? c.accent : c.secondary,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: stress === n ? "#0F1729" : c.mutedForeground,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>Calm</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>Stressed</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground }}>
            Skincare routine done
          </Text>
          <Switch
            value={skincare}
            onValueChange={(v) => setDraft((d) => ({ ...d, skincareDone: v }))}
            trackColor={{ true: c.accent, false: c.secondary }}
            thumbColor={c.switchThumb}
          />
        </View>

        <Pressable
          onPress={() => router.push("/explore/routine")}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
          hitSlop={8}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.primary }}>
            Manage routine
          </Text>
          <Feather name="chevron-right" size={14} color={c.primary} />
        </Pressable>

        <View style={{ marginTop: 8 }}>
          <LuxeButton label="Save check-in" onPress={handleSave} loading={upsert.isPending} />
        </View>
      </Card>

      {history.length > 0 ? (
        <>
          <SectionTitle>Last 7 days</SectionTitle>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
              {history.map((h) => (
                <View key={h.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      width: "100%",
                      height: Math.max(4, (h.score / 100) * 70),
                      backgroundColor: c.accent,
                      borderRadius: 4,
                      opacity: 0.5 + (h.score / 100) * 0.5,
                    }}
                  />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: c.mutedForeground }}>
                    {fmtDate(h.date).split(" ")[1]}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </View>
  );
}
