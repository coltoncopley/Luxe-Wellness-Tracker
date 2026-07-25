import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React from "react";
import { Pressable } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function ExploreLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
        headerLeft: () => (
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              paddingRight: 12,
              paddingVertical: 4,
            })}
          >
            <Feather name="chevron-left" size={26} color={c.foreground} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="restaurants" options={{ title: "Dining Out Guide" }} />
      <Stack.Screen name="photos" options={{ title: "Progress Photos" }} />
      <Stack.Screen name="journey" options={{ title: "My Journey" }} />
      <Stack.Screen name="report" options={{ title: "Weekly Report" }} />
      <Stack.Screen name="meal-plan" options={{ title: "Meal Plan" }} />
      <Stack.Screen name="workouts" options={{ title: "Workouts" }} />
      <Stack.Screen name="skin" options={{ title: "Skin Scan" }} />
      <Stack.Screen name="ingredients" options={{ title: "Product Scan" }} />
      <Stack.Screen name="passport" options={{ title: "Beauty Passport" }} />
      <Stack.Screen name="friends" options={{ title: "Friends" }} />
      <Stack.Screen name="community" options={{ title: "Community" }} />
      <Stack.Screen name="bhrt" options={{ title: "Hormone Health" }} />
    </Stack>
  );
}
