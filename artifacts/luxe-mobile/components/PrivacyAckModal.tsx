import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getGetMeQueryKey, useAcknowledgePrivacyNotice } from "@workspace/api-client-react";

import { Card, LuxeButton } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

const POINTS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  {
    icon: "lock",
    text: "Your weight, food logs, habits, journal, photos, and chats are private to you. The LUXE office cannot see them.",
  },
  {
    icon: "eye-off",
    text: "Staff never see your health or tracking data — no dashboards, no reports.",
  },
  {
    icon: "gift",
    text: "The only thing staff can see is reward redemption info (your name, email, and reward codes) so they can honor your perks in person.",
  },
  {
    icon: "heart",
    text: "This app is for self-care and wellness support. It is not medical care — always talk to Dr. Copley about medical questions.",
  },
];

export function PrivacyAckModal() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const ack = useAcknowledgePrivacyNotice();

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
        <Text style={[styles.title, { color: c.foreground }]}>Your privacy comes first</Text>
        <Text style={[styles.sub, { color: c.mutedForeground }]}>
          Before you get started, here's how your information is handled.
        </Text>

        <Card style={{ gap: 18, marginTop: 24 }}>
          {POINTS.map((p) => (
            <View key={p.icon} style={{ flexDirection: "row", gap: 14 }}>
              <View style={[styles.iconWrap, { backgroundColor: c.secondary }]}>
                <Feather name={p.icon} size={16} color={c.tint} />
              </View>
              <Text style={[styles.pointText, { color: c.foreground }]}>{p.text}</Text>
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 28 }}>
          <LuxeButton
            label="I understand"
            onPress={() =>
              ack.mutate(undefined, {
                onSuccess: () => {
                  void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                },
              })
            }
            loading={ack.isPending}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 28,
    lineHeight: 36,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
});
