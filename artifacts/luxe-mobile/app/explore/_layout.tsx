import { Stack } from "expo-router";
import React from "react";

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
      }}
    >
      <Stack.Screen name="restaurants" options={{ title: "Dining Out Guide" }} />
      <Stack.Screen name="photos" options={{ title: "Progress Photos" }} />
      <Stack.Screen name="skin" options={{ title: "Skin Scan" }} />
      <Stack.Screen name="ingredients" options={{ title: "Ingredient Scanner" }} />
      <Stack.Screen name="passport" options={{ title: "Beauty Passport" }} />
      <Stack.Screen name="friends" options={{ title: "Friends" }} />
      <Stack.Screen name="community" options={{ title: "Community" }} />
      <Stack.Screen name="bhrt" options={{ title: "Hormone Health" }} />
    </Stack>
  );
}
