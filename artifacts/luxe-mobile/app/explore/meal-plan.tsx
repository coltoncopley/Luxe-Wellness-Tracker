import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Share, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "@/lib/alert";

import type {
  MealPlan,
  MealPlanDay,
  MealPlanMeal,
  MealPlanPreferences,
  MealPlanResult,
  ShoppingListItem,
} from "@workspace/api-client-react";
import {
  getGetMealPlanPreferencesQueryKey,
  getGetMealPlanQueryKey,
  useApplyMeal,
  useCheckShoppingListItem,
  useEmailShoppingList,
  useGenerateMealPlan,
  useGetMealPlan,
  useGetMealPlanPreferences,
  useSetMealPlanPeople,
  useSuggestMeal,
  useUpdateMealPlanPreferences,
} from "@workspace/api-client-react";

import {
  Card,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  SectionTitle,
  Stepper,
  StackScreen,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_KEYS: { key: MealKey; label: string; emoji: string }[] = [
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

function displayLine(item: ShoppingListItem): string {
  return item.displayQuantity ? `${item.displayQuantity} ${item.name}` : item.name;
}

function shoppingListText(plan: MealPlan): string {
  const header = `LUXE shopping list — week of ${fmtDate(plan.weekStart)}–${fmtDate(plan.weekEnd)}\nServes ${plan.people}\n`;
  if (plan.shoppingList.length > 0) {
    return (
      header +
      plan.shoppingList
        .map(
          (cat) =>
            `\n${cat.category.toUpperCase()}\n` +
            cat.items.map((i) => `- ${displayLine(i)}`).join("\n"),
        )
        .join("\n")
    );
  }
  return (
    header +
    plan.grocery
      .map(
        (cat) => `\n${cat.category.toUpperCase()}\n` + cat.items.map((i) => `- ${i}`).join("\n"),
      )
      .join("\n")
  );
}

export default function MealPlanScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const query = useGetMealPlan();
  const prefsQuery = useGetMealPlanPreferences();
  const generate = useGenerateMealPlan();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [swapSlot, setSwapSlot] = useState<{
    date: string;
    mealType: MealKey;
    name: string;
  } | null>(null);

  const plan = query.data?.plan ?? null;
  const remaining = query.data?.generationsRemaining ?? 0;
  const suggestsRemaining = query.data?.suggestsRemaining ?? 0;
  const prefs = prefsQuery.data ?? null;
  const today = new Date().toLocaleDateString("en-CA");
  const canSwap = suggestsRemaining > 0;

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

  const applyResult = (result: MealPlanResult) => {
    queryClient.setQueryData(getGetMealPlanQueryKey(), result);
  };

  if (query.isLoading) return <LoadingView />;
  if (query.isError)
    return <ErrorView message="Couldn't load your meal plan." onRetry={() => void query.refetch()} />;

  return (
    <StackScreen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: c.mutedForeground,
          }}
        >
          A simple week of meals, tailored to your goals and the foods you already love.
        </Text>
        {prefs ? (
          <Pressable
            onPress={() => setPrefsOpen(true)}
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
            }}
          >
            <Feather name="sliders" size={12} color={c.foreground} />
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.foreground }}>
              Preferences
            </Text>
          </Pressable>
        ) : null}
      </View>

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
            Luxe AI will build a 7-day plan around your calorie target, preferences, and recent food
            logs — plus a shopping list you can check off, scale, and send to yourself. It takes
            about a minute.
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

          <PeopleStepper plan={plan} />

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
                canSwap={canSwap}
                onSwap={(mealType, name) => setSwapSlot({ date: day.date, mealType, name })}
                onToggle={() =>
                  setOpenDay((openDay ? openDay === day.date : day.date === today) ? "" : day.date)
                }
              />
            ))}
          </View>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: c.mutedForeground,
              marginTop: 8,
            }}
          >
            {canSwap
              ? `Tap the shuffle icon to swap any meal — ${suggestsRemaining} swap${suggestsRemaining === 1 ? "" : "s"} left today.`
              : "You've used today's meal swaps — they refresh tomorrow."}
          </Text>

          <ShoppingListSection plan={plan} />
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

      {prefs ? (
        <PreferencesModal visible={prefsOpen} onClose={() => setPrefsOpen(false)} prefs={prefs} />
      ) : null}
      <SwapModal slot={swapSlot} onClose={() => setSwapSlot(null)} onApplied={applyResult} />
    </StackScreen>
  );
}

/* ---------------- People stepper ---------------- */

function PeopleStepper({ plan }: { plan: MealPlan }) {
  const queryClient = useQueryClient();
  const setPeople = useSetMealPlanPeople();
  const [pending, setPending] = useState<number | null>(null);
  const people = pending ?? plan.people;

  const change = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), 20);
    if (clamped === plan.people || setPeople.isPending) return;
    setPending(clamped);
    setPeople.mutate(
      { data: { people: clamped } },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(getGetMealPlanQueryKey(), result);
          setPending(null);
        },
        onError: () => {
          setPending(null);
          Alert.alert("Couldn't update servings", "Please try again.");
        },
      },
    );
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <Stepper
        label="Serves (scales your shopping list)"
        value={people}
        onDecrement={() => change(people - 1)}
        onIncrement={() => change(people + 1)}
      />
    </Card>
  );
}

/* ---------------- Day card ---------------- */

function DayCard({
  day,
  isToday,
  expanded,
  canSwap,
  onSwap,
  onToggle,
}: {
  day: MealPlanDay;
  isToday: boolean;
  expanded: boolean;
  canSwap: boolean;
  onSwap: (mealType: MealKey, name: string) => void;
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
                <Pressable
                  onPress={() => canSwap && onSwap(m.key, meal.name)}
                  disabled={!canSwap}
                  hitSlop={8}
                  style={{ opacity: canSwap ? 1 : 0.3, paddingTop: 2 }}
                >
                  <Feather name="shuffle" size={15} color={c.tint} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

/* ---------------- Shopping list ---------------- */

function ShoppingListSection({ plan }: { plan: MealPlan }) {
  const c = useColors();
  const check = useCheckShoppingListItem();
  const email = useEmailShoppingList();
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalChecks({});
  }, [plan.generatedAt]);

  const isChecked = (item: ShoppingListItem) => localChecks[item.itemKey] ?? item.checked;

  const toggle = (item: ShoppingListItem) => {
    const next = !isChecked(item);
    setLocalChecks((m) => ({ ...m, [item.itemKey]: next }));
    check.mutate(
      { data: { itemKey: item.itemKey, checked: next } },
      {
        onError: () => {
          setLocalChecks((m) => ({ ...m, [item.itemKey]: !next }));
          Alert.alert("Couldn't save that", "Please try again.");
        },
      },
    );
  };

  const sendEmail = () => {
    email.mutate(undefined, {
      onSuccess: () => Alert.alert("Sent!", "Your shopping list is on its way to your email."),
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        Alert.alert("Couldn't email your list", e.data?.error ?? "Please try again.");
      },
    });
  };

  const share = async () => {
    try {
      await Share.share({ message: shoppingListText(plan) });
    } catch {
      Alert.alert("Couldn't share", "Please try again.");
    }
  };

  const hasScaled = plan.shoppingList.length > 0;

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
          marginBottom: 8,
          gap: 8,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_600SemiBold",
            fontSize: 17,
            color: c.foreground,
            flex: 1,
          }}
        >
          Shopping list {hasScaled ? `· serves ${plan.people}` : ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable
          onPress={share}
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 999,
            paddingVertical: 7,
            paddingHorizontal: 14,
          }}
        >
          <Feather name="share-2" size={13} color={c.foreground} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
            Share
          </Text>
        </Pressable>
        <Pressable
          onPress={sendEmail}
          disabled={email.isPending}
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 999,
            paddingVertical: 7,
            paddingHorizontal: 14,
            opacity: email.isPending ? 0.5 : 1,
          }}
        >
          <Feather name="mail" size={13} color={c.foreground} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
            {email.isPending ? "Sending…" : "Email"}
          </Text>
        </Pressable>
      </View>

      <Card style={{ gap: 16 }}>
        {hasScaled
          ? plan.shoppingList.map((cat) => (
              <View key={cat.category} style={{ gap: 8 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: c.mutedForeground,
                  }}
                >
                  {cat.category}
                </Text>
                {cat.items.map((item) => {
                  const checked = isChecked(item);
                  return (
                    <Pressable
                      key={item.itemKey}
                      onPress={() => toggle(item)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: checked ? c.accent : c.border,
                          backgroundColor: checked ? c.accent : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {checked ? <Feather name="check" size={13} color="#0F1729" /> : null}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: checked ? c.mutedForeground : c.foreground,
                          textDecorationLine: checked ? "line-through" : "none",
                        }}
                      >
                        {displayLine(item)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          : plan.grocery.map((cat) => (
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
  );
}

/* ---------------- Chip editor (modal) ---------------- */

function ChipEditor({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const c = useColors();
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v.length === 0) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v].slice(0, 40));
    }
    setDraft("");
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
        {label}
      </Text>
      {values.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {values.map((v) => (
            <Pressable
              key={v}
              onPress={() => onChange(values.filter((x) => x !== v))}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: c.secondary,
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.secondaryForeground }}>
                {v}
              </Text>
              <Feather name="x" size={13} color={c.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <LuxeInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1 }}
        />
        <Pressable
          onPress={add}
          style={{
            justifyContent: "center",
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: c.radius - 4,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- Preferences modal ---------------- */

function PreferencesModal({
  visible,
  onClose,
  prefs,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: MealPlanPreferences;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const update = useUpdateMealPlanPreferences();
  const [allergies, setAllergies] = useState<string[]>(prefs.allergies);
  const [dislikes, setDislikes] = useState<string[]>(prefs.dislikes);
  const [dietStyle, setDietStyle] = useState(prefs.dietStyle ?? "");

  useEffect(() => {
    if (visible) {
      setAllergies(prefs.allergies);
      setDislikes(prefs.dislikes);
      setDietStyle(prefs.dietStyle ?? "");
    }
  }, [visible, prefs.allergies, prefs.dislikes, prefs.dietStyle]);

  const save = () => {
    update.mutate(
      {
        data: {
          allergies,
          dislikes,
          dietStyle: dietStyle.trim() ? dietStyle.trim() : null,
          householdSize: prefs.householdSize,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMealPlanPreferencesQueryKey() });
          onClose();
          Alert.alert("Saved", "Your preferences will shape your next plan.");
        },
        onError: () => Alert.alert("Couldn't save", "Please try again."),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: insets.bottom + 20,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.foreground }}>
              Meal preferences
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Luxe AI uses these to tailor your plan. Everything here is private to you.
          </Text>

          <ChipEditor
            label="Allergies (always avoided)"
            placeholder="e.g. peanuts"
            values={allergies}
            onChange={setAllergies}
          />
          <ChipEditor
            label="Foods you dislike"
            placeholder="e.g. mushrooms"
            values={dislikes}
            onChange={setDislikes}
          />
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
              Diet style (optional)
            </Text>
            <LuxeInput
              value={dietStyle}
              onChangeText={(t) => setDietStyle(t.slice(0, 60))}
              placeholder="e.g. vegetarian, Mediterranean, low-carb"
            />
          </View>

          {prefs.avoidDishes.length > 0 ? (
            <View style={{ backgroundColor: c.secondary, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground }}>
                Learned from your swaps — dishes we won't repeat:
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: c.mutedForeground,
                  marginTop: 4,
                }}
              >
                {prefs.avoidDishes.slice(0, 8).join(", ")}
                {prefs.avoidDishes.length > 8 ? "…" : ""}
              </Text>
            </View>
          ) : null}

          <LuxeButton
            label={update.isPending ? "Saving…" : "Save preferences"}
            disabled={update.isPending}
            onPress={save}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------- Swap modal ---------------- */

function SwapModal({
  slot,
  onClose,
  onApplied,
}: {
  slot: { date: string; mealType: MealKey; name: string } | null;
  onClose: () => void;
  onApplied: (result: MealPlanResult) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const suggest = useSuggestMeal();
  const apply = useApplyMeal();
  const [choice, setChoice] = useState<number | null>(null);
  const requestedRef = useRef<string | null>(null);

  const runSuggest = (date: string, mealType: MealKey) => {
    setChoice(null);
    suggest.reset();
    suggest.mutate(
      { data: { date, mealType } },
      {
        onError: (err) => {
          const e = err as { status?: number; data?: { error?: string } };
          if (e.status === 429) {
            Alert.alert(
              "No swaps left today",
              e.data?.error ?? "You've used today's swap ideas. Try again tomorrow!",
            );
            onClose();
          }
        },
      },
    );
  };

  useEffect(() => {
    if (!slot) {
      requestedRef.current = null;
      return;
    }
    const key = `${slot.date}:${slot.mealType}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    runSuggest(slot.date, slot.mealType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.date, slot?.mealType]);

  const options: MealPlanMeal[] = suggest.data?.options ?? [];

  const doApply = () => {
    if (!slot || choice == null) return;
    apply.mutate(
      { data: { date: slot.date, mealType: slot.mealType, choiceIndex: choice } },
      {
        onSuccess: (result) => {
          onApplied(result);
          onClose();
          Alert.alert("Swapped!", "Your meal has been updated.");
        },
        onError: (err) => {
          const e = err as { status?: number };
          Alert.alert(
            "Couldn't swap",
            e.status === 409 ? "Those ideas expired — try swapping again." : "Please try again.",
          );
        },
      },
    );
  };

  return (
    <Modal visible={slot != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: insets.bottom + 20,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.foreground }}>
              Swap this meal
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>
          {slot ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              Replacing {slot.name}. Pick a fresh idea below.
            </Text>
          ) : null}

          {suggest.isPending ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
              <ActivityIndicator color={c.tint} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                Finding three fresh ideas…
              </Text>
            </View>
          ) : null}

          {suggest.isError && !suggest.isPending ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                Couldn't fetch ideas just now.
              </Text>
              <LuxeButton
                label="Try again"
                variant="outline"
                onPress={() => slot && runSuggest(slot.date, slot.mealType)}
              />
            </View>
          ) : null}

          {!suggest.isPending
            ? options.map((opt, i) => {
                const selected = choice === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setChoice(i)}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? c.accent : c.border,
                      backgroundColor: selected ? c.secondary : "transparent",
                      borderRadius: c.radius - 2,
                      padding: 14,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                          color: c.foreground,
                        }}
                      >
                        {opt.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
                          {opt.calories} cal
                        </Text>
                        {selected ? <Feather name="check" size={16} color={c.tint} /> : null}
                      </View>
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, color: c.mutedForeground }}>
                      {opt.description}
                    </Text>
                  </Pressable>
                );
              })
            : null}

          {!suggest.isPending && options.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LuxeButton
                  label="More ideas"
                  variant="outline"
                  disabled={apply.isPending}
                  onPress={() => slot && runSuggest(slot.date, slot.mealType)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <LuxeButton
                  label={apply.isPending ? "Swapping…" : "Use this meal"}
                  disabled={choice == null || apply.isPending}
                  onPress={doApply}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
