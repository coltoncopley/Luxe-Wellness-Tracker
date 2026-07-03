import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  getGetMindSummaryQueryKey,
  useGetMindSummary,
  useUpsertMindCheckin,
} from "@workspace/api-client-react";

import { ScoreRing } from "@/components/ScoreRing";
import { Card, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";

const MOOD_OPTIONS = ["😞", "🙁", "😐", "🙂", "😄"];
const LEVEL_LABELS = ["Very low", "Low", "Okay", "Good", "Great"];
const STRESS_LABELS = ["Very calm", "Calm", "Okay", "Stressed", "Very stressed"];

function scoreMessage(score: number): string {
  if (score >= 85) return "Beautifully balanced today.";
  if (score >= 65) return "You're doing well — keep tending to yourself.";
  if (score >= 45) return "A gentle day. A few deep breaths might help.";
  return "Be extra kind to yourself today. You're not alone.";
}

function ScalePicker({
  label,
  value,
  onChange,
  labels,
  emojis,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  labels: string[];
  emojis?: string[];
}) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground }}>
          {label}
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          {labels[value - 1]}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: active ? c.accent : c.secondary,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: emojis ? 18 : 14,
                  color: active ? "#0F1729" : c.mutedForeground,
                }}
              >
                {emojis ? emojis[n - 1] : n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const BREATH_PHASES = [
  { name: "Breathe in", seconds: 4, scale: 1 },
  { name: "Hold", seconds: 4, scale: 1 },
  { name: "Breathe out", seconds: 6, scale: 0.6 },
] as const;

function BreathingExercise() {
  const c = useColors();
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cyclesDone, setCyclesDone] = useState(0);
  const scale = useSharedValue(0.75);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) {
      scale.value = withTiming(0.75, { duration: 500 });
      return;
    }
    const phase = BREATH_PHASES[phaseIdx]!;
    scale.value = withTiming(phase.scale, {
      duration: phase.seconds * 1000,
      easing: Easing.inOut(Easing.ease),
    });
    timerRef.current = setTimeout(() => {
      const next = (phaseIdx + 1) % BREATH_PHASES.length;
      setPhaseIdx(next);
      if (next === 0) setCyclesDone((n) => n + 1);
    }, phase.seconds * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, phaseIdx]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const phase = BREATH_PHASES[phaseIdx]!;

  return (
    <Card style={{ alignItems: "center", paddingVertical: 24, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
        <Feather name="wind" size={16} color={c.accent} />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
          One-minute breathing
        </Text>
      </View>
      <View style={{ height: 160, width: 160, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              height: 160,
              width: 160,
              borderRadius: 80,
              backgroundColor: c.accent,
              opacity: 0.18,
              borderWidth: 1,
              borderColor: c.accent,
            },
            circleStyle,
          ]}
        />
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.accent }}>
            {running ? phase.name : "Ready?"}
          </Text>
          {running ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 4 }}>
              {cyclesDone} {cyclesDone === 1 ? "cycle" : "cycles"} done
            </Text>
          ) : null}
        </View>
      </View>
      <LuxeButton
        label={running ? "Stop" : "Start breathing"}
        variant={running ? "outline" : "gold"}
        onPress={() => {
          setRunning((r) => !r);
          setPhaseIdx(0);
          if (!running) setCyclesDone(0);
        }}
      />
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, textAlign: "center" }}>
        Follow the circle: in for 4, hold for 4, out for 6. A few cycles can calm your nervous system.
      </Text>
    </Card>
  );
}

export function MindTab() {
  const c = useColors();
  const queryClient = useQueryClient();
  const summary = useGetMindSummary();
  const upsert = useUpsertMindCheckin();

  const today = summary.data?.today ?? null;

  const [draft, setDraft] = useState<{
    mood?: number;
    energy?: number;
    stress?: number;
    anxiety?: number;
    gratitude?: string;
    journal?: string;
  }>({});

  const mood = draft.mood ?? today?.mood ?? 3;
  const energy = draft.energy ?? today?.energy ?? 3;
  const stress = draft.stress ?? today?.stress ?? 3;
  const anxiety = draft.anxiety ?? today?.anxiety ?? 3;
  const gratitude = draft.gratitude ?? today?.gratitude ?? "";
  const journal = draft.journal ?? today?.journal ?? "";

  const handleSave = () => {
    upsert.mutate(
      {
        data: {
          mood,
          energy,
          stress,
          anxiety,
          gratitude: gratitude.trim() || null,
          journal: journal.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setDraft({});
          void queryClient.invalidateQueries({ queryKey: getGetMindSummaryQueryKey() });
        },
      },
    );
  };

  const history = (summary.data?.history ?? []).slice(-7);
  const todayScore = today?.score ?? null;

  return (
    <View>
      <Card style={{ alignItems: "center", paddingVertical: 24 }}>
        <ScoreRing score={todayScore ?? 0} label="Calm Score" />
        <Text style={{ marginTop: 12, fontFamily: "Inter_500Medium", fontSize: 14, color: c.mutedForeground, textAlign: "center" }}>
          {summary.data?.streakDays ? `🔥 ${summary.data.streakDays}-day streak` : "Check in daily to build your streak"}
        </Text>
        {todayScore !== null ? (
          <Text style={{ marginTop: 4, fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center" }}>
            {scoreMessage(todayScore)}
          </Text>
        ) : null}
      </Card>

      <Card style={{ marginTop: 16, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Feather name="lock" size={16} color={c.mutedForeground} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, color: c.mutedForeground }}>
          Completely private to you. This is a self-care tool, not medical care — if you're
          struggling, please reach out to your doctor or call/text 988.
        </Text>
      </Card>

      <SectionTitle>Today's check-in</SectionTitle>
      <Card>
        <ScalePicker label="Mood" value={mood} onChange={(v) => setDraft((d) => ({ ...d, mood: v }))} labels={LEVEL_LABELS} emojis={MOOD_OPTIONS} />
        <ScalePicker label="Energy" value={energy} onChange={(v) => setDraft((d) => ({ ...d, energy: v }))} labels={LEVEL_LABELS} />
        <ScalePicker label="Stress" value={stress} onChange={(v) => setDraft((d) => ({ ...d, stress: v }))} labels={STRESS_LABELS} />
        <ScalePicker label="Anxiety" value={anxiety} onChange={(v) => setDraft((d) => ({ ...d, anxiety: v }))} labels={STRESS_LABELS} />

        <View style={{ paddingVertical: 8 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground, marginBottom: 8 }}>
            One thing I'm grateful for
          </Text>
          <LuxeInput
            placeholder="Even something tiny counts..."
            value={gratitude}
            onChangeText={(t) => setDraft((d) => ({ ...d, gratitude: t }))}
            maxLength={1000}
            multiline
            style={{ minHeight: 60, textAlignVertical: "top" }}
          />
        </View>

        <View style={{ paddingVertical: 8 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground, marginBottom: 8 }}>
            Journal (optional)
          </Text>
          <LuxeInput
            placeholder="Anything on your mind today?"
            value={journal}
            onChangeText={(t) => setDraft((d) => ({ ...d, journal: t }))}
            maxLength={4000}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
        </View>

        <View style={{ marginTop: 8 }}>
          <LuxeButton
            label={today ? "Update today's check-in" : "Save check-in"}
            onPress={handleSave}
            loading={upsert.isPending}
          />
        </View>
      </Card>

      <SectionTitle>Take a breath</SectionTitle>
      <BreathingExercise />

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
