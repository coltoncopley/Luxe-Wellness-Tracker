import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getGetMeQueryKey,
  getGetNotificationPrefsQueryKey,
  useGetBillingStatus,
  useGetMe,
  useGetNotificationPrefs,
  useSendTestNotification,
  useUpdateBirthday,
  useUpdateNotificationPrefs,
  type NotificationPrefs,
} from "@workspace/api-client-react";

import { Card, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { pushSupported, registerDevice, unregisterDevice } from "@/lib/push";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const TOPICS: Array<{
  key: keyof Pick<
    NotificationPrefs,
    "announcements" | "habitReminders" | "streakAlerts" | "weeklySummary" | "treatmentReminders"
  >;
  label: string;
  description: string;
}> = [
  {
    key: "announcements",
    label: "Spa news & specials",
    description: "New announcements, offers, and events from LUXE",
  },
  {
    key: "habitReminders",
    label: "Daily habit reminders",
    description: "A morning nudge to log your check-in, meals, and weigh-in",
  },
  {
    key: "streakAlerts",
    label: "Streak protection",
    description: "An evening heads-up when your streak is about to break",
  },
  {
    key: "weeklySummary",
    label: "Weekly progress summary",
    description: "Your week in review, every Sunday evening",
  },
  {
    key: "treatmentReminders",
    label: "Touch-up reminders",
    description: "A heads-up when a treatment in your Beauty Passport is due for a touch-up",
  },
];

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground }}>{label}</Text>
        {description ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: c.accent, false: c.secondary }}
        thumbColor={c.switchThumb}
      />
    </View>
  );
}

function NotificationsSection() {
  const c = useColors();
  const queryClient = useQueryClient();
  const prefsQuery = useGetNotificationPrefs();
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const updatePrefs = useUpdateNotificationPrefs({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetNotificationPrefsQueryKey(), data);
      },
      onError: () => Alert.alert("Couldn't save", "Could not save your preferences. Please try again."),
    },
  });

  const sendTest = useSendTestNotification({
    mutation: {
      onSuccess: (result) => {
        if (result.email || result.push) {
          Alert.alert("Test sent", "Check your enabled channels.");
        } else {
          Alert.alert("Nothing sent", "Turn on push or email notifications first.");
        }
      },
      onError: () => Alert.alert("Couldn't send", "Could not send the test. Please try again."),
    },
  });

  const prefs = prefsQuery.data;

  if (!prefs) {
    return (
      <>
        <SectionTitle>Notifications</SectionTitle>
        <Card>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Loading your preferences…
          </Text>
        </Card>
      </>
    );
  }

  const effectiveEmail = prefs.emailOverride ?? prefs.accountEmail ?? "";
  const emailValue = emailDraft ?? effectiveEmail;

  const handlePushToggle = async (checked: boolean) => {
    setPushBusy(true);
    try {
      if (checked) {
        const result = await registerDevice();
        if (result === "denied") {
          Alert.alert(
            "Notifications are off",
            "Allow notifications for LUXE in your phone's Settings, then try again.",
          );
          return;
        }
        if (result === "conflict") {
          Alert.alert(
            "Device in use",
            "This phone is registered for push by another LUXE account.",
          );
          return;
        }
        if (result === "unsupported") {
          Alert.alert(
            "Not available",
            "Push isn't available in this build. Install the App Store version to get reminders.",
          );
          return;
        }
        if (result === "failed") {
          Alert.alert("Couldn't enable push", "Something went wrong. Please try again.");
          return;
        }
        updatePrefs.mutate({ data: { pushEnabled: true } });
      } else {
        await unregisterDevice();
        updatePrefs.mutate({ data: { pushEnabled: false } });
      }
    } finally {
      setPushBusy(false);
    }
  };

  const saveEmail = () => {
    const value = emailDraft?.trim() ?? "";
    updatePrefs.mutate(
      { data: { emailOverride: value === "" ? null : value } },
      { onSuccess: () => setEmailDraft(null) },
    );
  };

  return (
    <>
      <SectionTitle>Notifications</SectionTitle>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Feather name="smartphone" size={16} color={c.tint} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            Push notifications
          </Text>
        </View>
        {pushSupported() ? (
          <>
            <ToggleRow
              label={prefs.pushEnabled ? "Push is on" : "Push is off"}
              value={prefs.pushEnabled}
              disabled={pushBusy}
              onValueChange={(checked) => void handlePushToggle(checked)}
            />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
              Habit reminders, streak alerts, and spa news, right on this phone.
            </Text>
          </>
        ) : (
          <>
            <ToggleRow label="Push is off" value={false} disabled />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
              Push isn't available in the browser preview. Use the iPhone app or the LUXE web app
              to enable push notifications.
            </Text>
          </>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Feather name="mail" size={16} color={c.tint} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            Email notifications
          </Text>
        </View>
        <ToggleRow
          label={prefs.emailEnabled ? "Email is on" : "Email is off"}
          value={prefs.emailEnabled}
          onValueChange={(checked) => updatePrefs.mutate({ data: { emailEnabled: checked } })}
        />
        {prefs.emailEnabled ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>Send to</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <LuxeInput
                style={{ flex: 1 }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={prefs.accountEmail ?? "you@example.com"}
                value={emailValue}
                onChangeText={setEmailDraft}
              />
              {emailDraft !== null && emailDraft.trim() !== effectiveEmail ? (
                <LuxeButton label="Save" onPress={saveEmail} loading={updatePrefs.isPending} small />
              ) : null}
            </View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
              {prefs.emailOverride
                ? "Using a custom email. Clear the field and save to use your account email."
                : "Using your account email. Enter a different address if you prefer."}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
          What you'll hear about
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginBottom: 6 }}>
          Applies to both push and email.
        </Text>
        {TOPICS.map((topic, i) => (
          <View
            key={topic.key}
            style={{
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
              paddingTop: i === 0 ? 6 : 10,
              marginTop: i === 0 ? 0 : 4,
            }}
          >
            <ToggleRow
              label={topic.label}
              description={topic.description}
              value={prefs[topic.key]}
              onValueChange={(checked) => updatePrefs.mutate({ data: { [topic.key]: checked } })}
            />
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
              Send a test notification
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
              Make sure everything is working on your enabled channels.
            </Text>
          </View>
          <LuxeButton
            label="Test"
            icon="send"
            variant="outline"
            small
            onPress={() => sendTest.mutate()}
            loading={sendTest.isPending}
            disabled={!prefs.emailEnabled && !prefs.pushEnabled}
          />
        </View>
      </Card>

      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 12 }}>
        Notifications never include your private health details — just friendly nudges and spa news.
        Your tracking data stays private to you.
      </Text>
    </>
  );
}

function BirthdaySection() {
  const c = useColors();
  const queryClient = useQueryClient();
  const me = useGetMe();
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const updateBirthday = useUpdateBirthday({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => Alert.alert("Couldn't save", "Couldn't save your birthday. Please try again."),
    },
  });

  const saved = me.data?.birthday ?? null;
  const savedMonth = saved ? saved.slice(0, 2) : null;
  const savedDay = saved ? saved.slice(3) : null;
  const effMonth = month ?? savedMonth;
  const effDay = day ?? savedDay;
  const maxDay = effMonth ? DAYS_IN_MONTH[Number(effMonth) - 1]! : 31;
  const dirty = effMonth !== savedMonth || effDay !== savedDay;

  const save = () => {
    if (!effMonth || !effDay) return;
    updateBirthday.mutate(
      { data: { birthday: `${effMonth}-${effDay.padStart(2, "0")}` } },
      {
        onSuccess: () => {
          setMonth(null);
          setDay(null);
          Alert.alert("Saved", "Birthday saved — a treat will be waiting for you! 🎂");
        },
      },
    );
  };

  const clear = () => {
    updateBirthday.mutate(
      { data: { birthday: null } },
      {
        onSuccess: () => {
          setMonth(null);
          setDay(null);
        },
      },
    );
  };

  return (
    <>
      <SectionTitle>Birthday treat</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Feather name="gift" size={16} color={c.tint} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            Your birthday
          </Text>
        </View>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
          Tell us your birthday (month and day only) and we'll surprise you with bonus reward points
          on your special day.
        </Text>

        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground, marginBottom: 8 }}>
          Month
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {MONTHS.map((m, i) => {
            const val = String(i + 1).padStart(2, "0");
            const active = effMonth === val;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setMonth(val);
                  if (effDay && Number(effDay) > DAYS_IN_MONTH[i]!) setDay(null);
                }}
                style={{
                  backgroundColor: active ? c.accent : c.secondary,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                }}
              >
                <Text
                  style={{
                    color: active ? "#0F1729" : c.secondaryForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                    fontSize: 13,
                  }}
                >
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground, marginTop: 14, marginBottom: 8 }}>
          Day
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {Array.from({ length: maxDay }, (_, i) => {
            const val = String(i + 1).padStart(2, "0");
            const active = effDay === val;
            return (
              <Pressable
                key={val}
                onPress={() => setDay(val)}
                style={{
                  backgroundColor: active ? c.accent : c.secondary,
                  borderRadius: 999,
                  width: 40,
                  paddingVertical: 8,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? "#0F1729" : c.secondaryForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                    fontSize: 13,
                  }}
                >
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          {dirty && effMonth && effDay ? (
            <View style={{ flex: 1 }}>
              <LuxeButton label="Save" onPress={save} loading={updateBirthday.isPending} />
            </View>
          ) : null}
          {saved ? (
            <View style={{ flex: 1 }}>
              <LuxeButton
                label="Remove"
                variant="outline"
                onPress={clear}
                loading={updateBirthday.isPending}
              />
            </View>
          ) : null}
        </View>

        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 12 }}>
          {saved
            ? "Your birthday is saved. It's only used for your in-app treat — never shared."
            : "Optional — only the month and day, never the year."}
        </Text>
      </Card>
    </>
  );
}

function DangerZone() {
  const c = useColors();
  return (
    <>
      <SectionTitle>Account</SectionTitle>
      <Card>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
          Delete account
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: c.mutedForeground,
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          Permanently delete your account and all of your data. Your membership will be canceled.
          This cannot be undone.
        </Text>
        <DeleteAccountButton />
      </Card>
    </>
  );
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
        keyboardShouldPersistTaps="handled"
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

        <NotificationsSection />

        <BirthdaySection />

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

        <DangerZone />

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
