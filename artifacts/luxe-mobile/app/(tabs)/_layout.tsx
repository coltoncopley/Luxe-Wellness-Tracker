import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";

import {
  setAuthTokenGetter,
  useGetBillingStatus,
  useGetMe,
} from "@workspace/api-client-react";

import { MembershipGate } from "@/components/MembershipGate";
import { PrivacyAckModal } from "@/components/PrivacyAckModal";
import { ErrorView, LoadingView, LuxeButton } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

/** True when the API rejected the sign-in because this email already belongs
 *  to another account (one-email-one-account guard). The generated client
 *  throws ApiError with top-level `status` and parsed body at top-level
 *  `data` (see lib/api-client-react/src/custom-fetch.ts). */
function isDuplicateEmailError(err: unknown): boolean {
  const e = err as { status?: number; data?: { error?: string } | null } | null;
  return e?.status === 403 && e?.data?.error === "email_already_registered";
}

function DuplicateEmailView() {
  const c = useColors();
  const { signOut } = useAuth();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.background,
        padding: 32,
        gap: 16,
      }}
    >
      <Feather name="user-x" size={32} color={c.mutedForeground} />
      <Text
        style={{
          color: c.text,
          fontFamily: "Inter_600SemiBold",
          fontSize: 17,
          textAlign: "center",
        }}
      >
        This email is already registered
      </Text>
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
        }}
      >
        Your email already belongs to a LUXE account created with a different sign-in method
        (for example, once with Google and once with a password). Sign out and sign back in
        the way you originally signed up.
      </Text>
      <LuxeButton label="Sign out" onPress={() => void signOut()} variant="outline" small />
    </View>
  );
}

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="track">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <Label>Track</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Luxe AI</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rewards">
        <Icon sf={{ default: "gift", selected: "gift.fill" }} />
        <Label>Rewards</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="book">
        <Icon sf={{ default: "calendar", selected: "calendar" }} />
        <Label>Book</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={24} />
            ) : (
              <Feather name="trending-up" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Luxe AI",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="sparkles" tintColor={color} size={24} />
            ) : (
              <Feather name="message-circle" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: "Rewards",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="gift" tintColor={color} size={24} />
            ) : (
              <Feather name="gift" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "Book",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={24} />
            ) : (
              <Feather name="calendar" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

/**
 * Gate rendered once the user is signed in:
 * 1. Privacy acknowledgment (required on first sign-in)
 * 2. Membership check (staff/admin/comp exempt) — membership is managed on
 *    the LUXE website; the app never sells or links to purchases (App Store 3.1.1).
 */
function Gate({ children }: { children: React.ReactElement }) {
  const me = useGetMe();
  const billing = useGetBillingStatus();

  if (me.isLoading || billing.isLoading) return <LoadingView />;
  if (isDuplicateEmailError(me.error) || isDuplicateEmailError(billing.error)) {
    return <DuplicateEmailView />;
  }
  if (me.isError || !me.data) {
    return (
      <ErrorView
        message="We couldn't load your account. Check your connection and try again."
        onRetry={() => {
          void me.refetch();
          void billing.refetch();
        }}
      />
    );
  }

  if (!me.data.privacyAcknowledged) return <PrivacyAckModal />;

  const b = billing.data;
  const hasAccess = !!b && (b.exempt || b.status === "active" || b.status === "trialing");
  if (!hasAccess) return <MembershipGate />;

  return children;
}

export default function TabLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    // Mobile uses Bearer tokens; web (luxe-wellness) stays cookie-based.
    setAuthTokenGetter(() => getToken());
    setTokenReady(true);
  }, [isSignedIn, getToken]);

  if (!isLoaded) return <LoadingView />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!tokenReady) return <LoadingView />;

  return (
    <Gate>{isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}</Gate>
  );
}
