import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import type { MealPlanDay } from "@workspace/api-client-react";
import {
  getGetMealPlanQueryKey,
  useGenerateMealPlan,
  useGetMealPlan,
} from "@workspace/api-client-react";

import { Card, ErrorView, LoadingView, LuxeButton, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";

const MEAL_KEYS: { key: "breakfast" | "lunch" | "dinner" | "snack"; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "🌅" },
  { key: "lunch", label: "Lunch", emoji: "☀️" },
  { key: "dinner", label: "Dinner", emoji: "🌙" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function MealPlanScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const query = useGetMealPlan();
  const generate = useGenerateMealPlan();
  const [openDay, setOpenDay] = useState<string | null>(null);

  const plan = query.data?.plan ?? null;
  const remaining = query.data?.generationsRemaining ?? 0;
  const today = new Date().toLocaleDateString("en-CA");

  const runGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetMealPlanQueryKey() });
        Alert.alert("Ready!", "Your meal plan for the week is ready.");
      },
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 429) {
          Alert.alert(
            "Weekly limit reached",
            e.data?.error ?? "You've used this week's generations — a fresh plan unlocks Monday!",
          );
        } else {
          Alert.alert("Couldn't create your plan", "Please try again in a moment.");
        }
      },
    });
  };

  if (query.isLoading) return <LoadingView />;
  if (query.isError)
    return <ErrorView message="Couldn't load your meal plan." onRetry={() => void query.refetch()} />;

  return (
    <StackScreen>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          color: c.mutedForeground,
          marginBottom: 12,
        }}
      >
        A simple week of meals, tailored to your goals and the foods you already love.
      </Text>

      {!plan ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Feather name="coffee" size={28} color={c.tint} />
          <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: c.foreground }}>
            No plan for this week yet
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 19,
              color: c.mutedForeground,
              textAlign: "center",
            }}
          >
            Luxe AI will build a 7-day plan around your calorie target and recent food logs — plus
            a grocery list to match. It takes about a minute.
          </Text>
          <LuxeButton
            label={generate.isPending ? "Building your week…" : "Create my meal plan"}
            disabled={generate.isPending || remaining <= 0}
            onPress={runGenerate}
          />
          {generate.isPending ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
              This can take up to a minute — hang tight!
            </Text>
          ) : null}
        </Card>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground }}>
              Week of {fmtDate(plan.weekStart)} – {fmtDate(plan.weekEnd)}
            </Text>
            <Pressable
              onPress={runGenerate}
              disabled={generate.isPending || remaining <= 0}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 12,
                opacity: generate.isPending || remaining <= 0 ? 0.5 : 1,
              }}
            >
              <Feather name="refresh-cw" size={12} color={c.foreground} />
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.foreground }}>
                {generate.isPending
                  ? "Rebuilding…"
                  : remaining > 0
                    ? `Regenerate (${remaining} left)`
                    : "New plan Monday"}
              </Text>
            </Pressable>
          </View>

          {plan.notes ? (
            <Card style={{ marginTop: 12, backgroundColor: c.secondary, borderWidth: 0 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Feather name="sunrise" size={16} color={c.tint} style={{ marginTop: 2 }} />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    lineHeight: 19,
                    color: c.mutedForeground,
                  }}
                >
                  {plan.notes}
                </Text>
              </View>
            </Card>
          ) : null}

          <View style={{ gap: 10, marginTop: 12 }}>
            {plan.days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                isToday={day.date === today}
                expanded={openDay ? openDay === day.date : day.date === today}
                onToggle={() =>
                  setOpenDay(
                    (openDay ? openDay === day.date : day.date === today) ? "" : day.date,
                  )
                }
              />
            ))}
          </View>

          {plan.grocery.length > 0 ? (
            <>
              <SectionTitle>Grocery list for the week</SectionTitle>
              <Card style={{ gap: 14 }}>
                {plan.grocery.map((cat) => (
                  <View key={cat.category}>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 11,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        color: c.mutedForeground,
                        marginBottom: 4,
                      }}
                    >
                      {cat.category}
                    </Text>
                    {cat.items.map((item, i) => (
                      <Text
                        key={i}
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 13,
                          lineHeight: 20,
                          color: c.foreground,
                        }}
                      >
                        • {item}
                      </Text>
                    ))}
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: c.mutedForeground,
          marginTop: 16,
        }}
      >
        Your meal plan is private to you — never shared with LUXE staff. General wellness guidance,
        not medical or dietetic advice. Check with your doctor about any dietary needs or
        restrictions.
      </Text>
    </StackScreen>
  );
}

function DayCard({
  day,
  isToday,
  expanded,
  onToggle,
}: {
  day: MealPlanDay;
  isToday: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = useColors();
  const total = MEAL_KEYS.reduce((s, m) => s + day[m.key].calories, 0);

  return (
    <Card style={{ gap: 0, borderColor: isToday ? c.accent : c.border, borderWidth: 1 }}>
      <Pressable onPress={onToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 15, color: c.foreground }}>
              {dayLabel(day.date)}
            </Text>
            {isToday ? (
              <View style={{ backgroundColor: c.accent, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#0F1729" }}>
                  TODAY
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            ~{total} cal
          </Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ gap: 12, marginTop: 12 }}>
          {MEAL_KEYS.map((m) => {
            const meal = day[m.key];
            return (
              <View key={m.key} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Text style={{ fontSize: 16, lineHeight: 22 }}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13,
                        color: c.foreground,
                      }}
                    >
                      {meal.name}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
                      {meal.calories} cal
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      lineHeight: 18,
                      color: c.mutedForeground,
                      marginTop: 2,
                    }}
                  >
                    {meal.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
