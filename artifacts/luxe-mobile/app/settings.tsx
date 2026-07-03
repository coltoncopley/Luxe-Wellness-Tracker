import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetBillingStatus, useGetMe } from "@workspace/api-client-react";

import { Card, LuxeButton, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { webUrl } from "@/lib/luxe";

function statusLabel(status: string, exempt: boolean): string {
  if (exempt) return "Complimentary access";
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Free trial";
    case "past_due":
      return "Payment past due";
    case "canceled":
      return "Canceled";
    default:
      return "Not active";
  }
}

export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useGetMe();
  const billing = useGetBillingStatus();

  const openLink = (path: string) => void WebBrowser.openBrowserAsync(webUrl(path));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: (Platform.OS === "web" ? 24 : insets.top ? 20 : 24) + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <Text style={{ flex: 1, fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 26, color: c.foreground }}>
            Settings
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="x" size={24} color={c.mutedForeground} />
          </Pressable>
        </View>

        <Card>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground }}>
            {me.data?.firstName ?? "LUXE member"}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>
            {me.data?.email ?? ""}
          </Text>
        </Card>

        <SectionTitle>Membership</SectionTitle>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                LUXE Membership
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>
                {billing.data ? statusLabel(billing.data.status, billing.data.exempt) : "—"}
              </Text>
            </View>
            <Feather name="award" size={20} color={c.tint} />
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 10 }}>
            Your membership is managed on the LUXE Wellness website.
          </Text>
        </Card>

        <SectionTitle>More</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {[
            { label: "Privacy policy", path: "/privacy" },
            { label: "Terms of service", path: "/terms" },
            { label: "Support", path: "/support" },
          ].map((l, i) => (
            <Pressable
              key={l.path}
              onPress={() => openLink(l.path)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground }}>
                {l.label}
              </Text>
              <Feather name="external-link" size={16} color={c.mutedForeground} />
            </Pressable>
          ))}
        </Card>

        <View style={{ marginTop: 28 }}>
          <LuxeButton
            label="Sign out"
            variant="outline"
            onPress={() =>
              Alert.alert("Sign out?", "You can sign back in anytime.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: () => void signOut() },
              ])
            }
          />
        </View>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: c.mutedForeground,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Your health and tracking data is private to you.{"\n"}The LUXE office cannot see it.
        </Text>
      </ScrollView>
    </View>
  );
}
