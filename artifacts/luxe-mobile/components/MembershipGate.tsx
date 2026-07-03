import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetBillingStatusQueryKey,
  useRedeemMembershipCode,
} from "@workspace/api-client-react";

import { Card, LuxeButton, LuxeInput } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export function MembershipGate() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const redeem = useRedeemMembershipCode();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
  };

  const handleRedeem = () => {
    setCodeError(null);
    redeem.mutate(
      { data: { code: code.trim().toUpperCase() } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries();
        },
        onError: () => {
          setCodeError("That code didn't work. Double-check it and try again.");
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 48,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text style={[styles.wordmark, { color: c.tint }]}>LUXE</Text>
        <Text style={[styles.title, { color: c.foreground }]}>Membership required</Text>
        <Text style={[styles.sub, { color: c.mutedForeground }]}>
          This app is part of the LUXE Wellness membership. Your membership is managed on the LUXE
          Wellness website — once it's active, tap refresh below to continue.
        </Text>

        <View style={{ gap: 12, marginTop: 28 }}>
          <LuxeButton label="Refresh membership status" icon="refresh-cw" onPress={refresh} />

          {showCode ? (
            <Card style={{ gap: 12 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Redeem an access code
              </Text>
              <LuxeInput
                placeholder="LW-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
              />
              {codeError ? (
                <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  {codeError}
                </Text>
              ) : null}
              <LuxeButton
                label="Redeem code"
                onPress={handleRedeem}
                loading={redeem.isPending}
                disabled={code.trim().length < 4}
              />
            </Card>
          ) : (
            <LuxeButton
              label="Have an access code?"
              variant="outline"
              onPress={() => setShowCode(true)}
            />
          )}

          <LuxeButton label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 34,
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: 28,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 26,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
});
