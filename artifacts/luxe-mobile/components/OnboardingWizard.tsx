import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Platform, ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getGetMeQueryKey, useCompleteOnboarding } from "@workspace/api-client-react";
import type {
  OnboardingInputPrimaryGoal,
  OnboardingInputDailyActionsItem,
} from "@workspace/api-client-react";

import { Card, LuxeButton } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

const GOALS = [
  { value: "weight_nutrition", label: "Weight & nutrition" },
  { value: "better_skin", label: "Better skin" },
  { value: "daily_wellness", label: "Daily wellness habits" },
  { value: "hormone_education", label: "Hormone health education" },
  { value: "maintain_results", label: "Maintain my results" },
];

const ACTIONS = [
  { value: "weigh_in", label: "Log your weigh-in" },
  { value: "log_meal", label: "Log a meal" },
  { value: "glow_checkin", label: "Glow check-in" },
  { value: "mind_checkin", label: "Mind check-in" },
  { value: "move", label: "Move your body" },
  { value: "skincare", label: "Skincare routine" },
];

const RECOMMENDED: Record<string, string[]> = {
  weight_nutrition: ["weigh_in", "log_meal", "glow_checkin"],
  better_skin: ["skincare", "glow_checkin", "log_meal"],
  daily_wellness: ["glow_checkin", "mind_checkin", "move"],
  hormone_education: ["glow_checkin", "weigh_in", "mind_checkin"],
  maintain_results: ["weigh_in", "glow_checkin", "move"],
};

export function OnboardingWizard() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [actions, setActions] = useState<Set<string>>(new Set());

  const handleGoalSelect = (g: string) => {
    setGoal(g);
    setActions(new Set(RECOMMENDED[g] || []));
    setStep(2);
  };

  const toggleAction = (a: string) => {
    const next = new Set(actions);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    setActions(next);
  };

  const submit = (primaryGoal: string, dailyActions: string[]) => {
    complete.mutate(
      {
        data: {
          primaryGoal: primaryGoal as OnboardingInputPrimaryGoal,
          dailyActions: dailyActions as OnboardingInputDailyActionsItem[],
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      }
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 32,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 28, color: c.foreground }}>
          Welcome to LUXE
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: c.mutedForeground, marginTop: 8, lineHeight: 22 }}>
          Let's tailor your experience. This takes less than 2 minutes.
        </Text>

        {step === 1 ? (
          <View style={{ marginTop: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground, marginBottom: 8 }}>
              What's your primary focus right now?
            </Text>
            {GOALS.map((g) => (
              <Pressable
                key={g.value}
                onPress={() => handleGoalSelect(g.value)}
                style={({ pressed }) => ({
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: c.foreground }}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 32, gap: 16 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground, marginBottom: 4 }}>
              Choose your daily check-ins
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginBottom: 8 }}>
              We've pre-selected the best habits for your goal. Keep what works for you.
            </Text>
            <Card style={{ gap: 0, paddingHorizontal: 0, paddingVertical: 4 }}>
              {ACTIONS.map((a, i) => (
                <Pressable
                  key={a.value}
                  onPress={() => toggleAction(a.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: actions.has(a.value) ? c.tint : c.border,
                      backgroundColor: actions.has(a.value) ? c.tint : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {actions.has(a.value) && <Feather name="check" size={14} color={c.accentForeground} />}
                  </View>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: c.foreground }}>{a.label}</Text>
                </Pressable>
              ))}
            </Card>

            <View style={{ marginTop: 16 }}>
              <LuxeButton
                label="Start my journey"
                onPress={() => submit(goal || "daily_wellness", Array.from(actions))}
                loading={complete.isPending}
                disabled={actions.size === 0}
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={() => submit("daily_wellness", RECOMMENDED["daily_wellness"])}
          style={{ marginTop: 32, alignSelf: "center", padding: 12 }}
          hitSlop={12}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.mutedForeground }}>
            Skip for now
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
