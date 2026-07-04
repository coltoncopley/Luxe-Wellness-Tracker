import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Pedometer } from "expo-sensors";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { Alert } from "@/lib/alert";
import {
  getGetActivitySummaryQueryKey,
  getListActivitiesQueryKey,
  getListDevicesQueryKey,
  getListSleepEntriesQueryKey,
  useConnectOura,
  useCreateActivity,
  useCreateSleepEntry,
  useDeleteActivity,
  useDeleteAppleHealthData,
  useDeleteSleepEntry,
  useDisconnectOura,
  useGetActivitySummary,
  useImportAppleHealth,
  useImportPhoneSteps,
  useListActivities,
  useListDevices,
  useListSleepEntries,
  useSyncOura,
  useUpdateOuraSettings,
} from "@workspace/api-client-react";

import type { AppleHealthImportInput } from "@workspace/api-client-react";

import { Card, Chip, EmptyState, LuxeButton, LuxeInput, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import {
  clearAppleHealthLastSync,
  collectAppleHealth,
  getAppleHealthLastSync,
  getHealthAvailability,
  setAppleHealthLastSync,
  type HealthAvailability,
} from "@/lib/healthkit";
import { fmtDate, todayStr } from "@/lib/luxe";

function appleSummaryRows(p: AppleHealthImportInput): { label: string; value: string }[] {
  const stepDays = p.activities.filter((a) => a.type === "steps").length;
  const workouts = p.activities.filter((a) => a.type !== "steps").length;
  const nights = p.sleep.length;
  const rows: { label: string; value: string }[] = [];
  if (stepDays > 0) rows.push({ label: "Daily steps", value: `${stepDays} day${stepDays === 1 ? "" : "s"}` });
  if (workouts > 0) rows.push({ label: "Workouts", value: `${workouts}` });
  if (nights > 0) rows.push({ label: "Sleep", value: `${nights} night${nights === 1 ? "" : "s"}` });
  return rows;
}

const ACTIVITY_TYPES = [
  { key: "walk", label: "Walk" },
  { key: "run", label: "Run" },
  { key: "strength", label: "Strength" },
  { key: "yoga", label: "Yoga" },
  { key: "swim", label: "Swim" },
  { key: "cycle", label: "Cycle" },
  { key: "other", label: "Other" },
] as const;

function typeLabel(type: string): string {
  if (type === "steps") return "Steps";
  const found = ACTIVITY_TYPES.find((t) => t.key === type);
  return found ? found.label : "Activity";
}

function fmtSleep(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <Card style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12 }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 18,
          color: c.foreground,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </Card>
  );
}

export function MoveTab() {
  const c = useColors();
  const queryClient = useQueryClient();

  const summary = useGetActivitySummary({ days: 7 });
  const activities = useListActivities();
  const sleepEntries = useListSleepEntries();
  const devices = useListDevices();

  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const createSleep = useCreateSleepEntry();
  const deleteSleep = useDeleteSleepEntry();
  const connectOura = useConnectOura();
  const syncOura = useSyncOura();
  const updateOura = useUpdateOuraSettings();
  const disconnectOura = useDisconnectOura();
  const importPhoneSteps = useImportPhoneSteps();
  const importApple = useImportAppleHealth();
  const deleteApple = useDeleteAppleHealthData();

  const [actType, setActType] = useState<string>("walk");
  const [actMinutes, setActMinutes] = useState("");
  const [actSteps, setActSteps] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [ouraToken, setOuraToken] = useState("");
  const [phonePreview, setPhonePreview] = useState<{ date: string; steps: number }[] | null>(null);
  const [readingSteps, setReadingSteps] = useState(false);
  const [healthAvail, setHealthAvail] = useState<HealthAvailability | null>(null);
  const [applePreview, setApplePreview] = useState<AppleHealthImportInput | null>(null);
  const [readingApple, setReadingApple] = useState(false);
  const [appleLastSync, setAppleLastSync] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [avail, last] = await Promise.all([getHealthAvailability(), getAppleHealthLastSync()]);
      if (!alive) return;
      setHealthAvail(avail);
      setAppleLastSync(last);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetActivitySummaryQueryKey({ days: 7 }) });
    void queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListSleepEntriesQueryKey() });
  };
  const invalidateDevices = () => {
    void queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
  };

  const s = summary.data;
  const oura = devices.data?.devices.find((d) => d.provider === "oura") ?? null;
  const recentActivities = (activities.data ?? []).slice(0, 10);
  const recentSleep = (sleepEntries.data ?? []).slice(0, 7);

  const handleLogActivity = () => {
    const mins = parseInt(actMinutes, 10);
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      Alert.alert("Log activity", "Enter how many minutes you moved (1-1440).");
      return;
    }
    const steps = actSteps.trim() ? parseInt(actSteps, 10) : null;
    if (steps != null && (!Number.isInteger(steps) || steps < 0 || steps > 200000)) {
      Alert.alert("Log activity", "Steps must be a whole number.");
      return;
    }
    createActivity.mutate(
      { data: { date: todayStr(), type: actType as never, durationMin: mins, steps } },
      {
        onSuccess: () => {
          setActMinutes("");
          setActSteps("");
          invalidate();
        },
        onError: () => Alert.alert("Log activity", "Couldn't save that. Please try again."),
      },
    );
  };

  const handleLogSleep = () => {
    const hours = parseFloat(sleepHours);
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) {
      Alert.alert("Log sleep", "Enter how many hours you slept (0.5-24).");
      return;
    }
    createSleep.mutate(
      {
        data: {
          date: todayStr(),
          durationMin: Math.round(hours * 60),
          quality: sleepQuality,
        },
      },
      {
        onSuccess: () => {
          setSleepHours("");
          setSleepQuality(null);
          invalidate();
        },
        onError: () => Alert.alert("Log sleep", "Couldn't save that. Please try again."),
      },
    );
  };

  const readPhoneSteps = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert(
        "Phone steps",
        Platform.OS === "android"
          ? "Reading past step history isn't available on Android yet — you can log steps manually above."
          : "Step import works in the LUXE mobile app on your phone.",
      );
      return;
    }
    setReadingSteps(true);
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        Alert.alert("Phone steps", "This phone doesn't provide step counts.");
        return;
      }
      const perm = await Pedometer.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Phone steps",
          "LUXE needs motion access to read your steps. You can allow it in Settings.",
        );
        return;
      }
      const found: { date: string; steps: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const end = i === 0 ? new Date() : dayEnd;
        try {
          const r = await Pedometer.getStepCountAsync(dayStart, end);
          if (r.steps > 0) found.push({ date: toDateStr(dayStart), steps: Math.round(r.steps) });
        } catch {
          // Some days may be unavailable; skip them.
        }
      }
      if (found.length === 0) {
        Alert.alert("Phone steps", "No steps found for the past 7 days.");
        return;
      }
      setPhonePreview(found);
    } finally {
      setReadingSteps(false);
    }
  };

  const handleImportPhoneSteps = () => {
    if (!phonePreview || phonePreview.length === 0) return;
    importPhoneSteps.mutate(
      { data: { entries: phonePreview } },
      {
        onSuccess: (r) => {
          setPhonePreview(null);
          invalidate();
          Alert.alert("Phone steps", `Imported steps for ${r.imported} day${r.imported === 1 ? "" : "s"}.`);
        },
        onError: () => Alert.alert("Phone steps", "Import failed. Please try again."),
      },
    );
  };

  const readAppleHealth = async () => {
    setReadingApple(true);
    try {
      const res = await collectAppleHealth();
      if (!res.ok) {
        Alert.alert(
          "Apple Health",
          res.reason === "unsupported-platform"
            ? "Apple Health is only available on iPhone."
            : res.reason === "unavailable-build"
              ? "Apple Health syncing works in the App Store version of LUXE."
              : "Couldn't read Apple Health. Please try again.",
        );
        return;
      }
      const total = res.payload.activities.length + res.payload.sleep.length;
      if (total === 0) {
        Alert.alert(
          "Apple Health",
          "No steps, workouts, or sleep found for the last 14 days — or access wasn't granted. You can turn it on in Settings › Privacy & Security › Health › LUXE.",
        );
        return;
      }
      setApplePreview(res.payload);
    } finally {
      setReadingApple(false);
    }
  };

  const handleImportAppleHealth = () => {
    if (!applePreview) return;
    importApple.mutate(
      { data: applePreview },
      {
        onSuccess: (r) => {
          setApplePreview(null);
          const now = new Date().toISOString();
          void setAppleHealthLastSync(now);
          setAppleLastSync(now);
          invalidate();
          Alert.alert(
            "Apple Health",
            `Synced ${r.activitiesImported} activity day(s) and ${r.sleepImported} night(s).`,
          );
        },
        onError: () => Alert.alert("Apple Health", "Sync failed. Please try again."),
      },
    );
  };

  const handleRemoveAppleHealth = () => {
    Alert.alert(
      "Remove Apple Health data?",
      "This deletes everything LUXE imported from Apple Health. Your data stays safe in Apple Health.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            deleteApple.mutate(undefined, {
              onSuccess: () => {
                void clearAppleHealthLastSync();
                setAppleLastSync(null);
                setApplePreview(null);
                invalidate();
                Alert.alert("Apple Health", "Removed the data LUXE imported.");
              },
              onError: () => Alert.alert("Apple Health", "Couldn't remove it. Please try again."),
            }),
        },
      ],
    );
  };

  const handleConnectOura = () => {
    const token = ouraToken.trim();
    if (token.length < 8) {
      Alert.alert("Oura", "Paste the personal access token from your Oura account.");
      return;
    }
    connectOura.mutate(
      { data: { token, importActivity: true, importSleep: true } },
      {
        onSuccess: () => {
          setOuraToken("");
          invalidateDevices();
          invalidate();
          Alert.alert("Oura connected", "Your ring's sleep and activity now sync automatically each morning.");
        },
        onError: (err) => {
          const { status, data } = err as { status?: number; data?: { error?: string } | null };
          Alert.alert(
            "Oura",
            data?.error ??
              (status === 429
                ? "Too many attempts — try again in a bit."
                : "Couldn't connect. Double-check the token and try again."),
          );
        },
      },
    );
  };

  const handleSyncNow = () => {
    syncOura.mutate(undefined, {
      onSuccess: (r) => {
        invalidate();
        invalidateDevices();
        Alert.alert("Oura", `Synced ${r.activitiesImported} activity day(s) and ${r.sleepImported} night(s).`);
      },
      onError: (err) => {
        const { data } = err as { data?: { error?: string } | null };
        Alert.alert("Oura", data?.error ?? "Sync failed — try again later.");
      },
    });
  };

  const handleToggleOura = (field: "importActivity" | "importSleep") => {
    if (!oura) return;
    updateOura.mutate(
      {
        data: {
          importActivity: field === "importActivity" ? !oura.importActivity : oura.importActivity,
          importSleep: field === "importSleep" ? !oura.importSleep : oura.importSleep,
        },
      },
      { onSuccess: invalidateDevices },
    );
  };

  const handleDisconnectOura = () => {
    Alert.alert("Disconnect Oura?", "Do you also want to remove the data it synced?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Keep data",
        onPress: () =>
          disconnectOura.mutate(
            { params: {} },
            {
              onSuccess: () => {
                invalidateDevices();
                invalidate();
              },
            },
          ),
      },
      {
        text: "Remove data",
        style: "destructive",
        onPress: () =>
          disconnectOura.mutate(
            { params: { removeData: true } },
            {
              onSuccess: () => {
                invalidateDevices();
                invalidate();
              },
            },
          ),
      },
    ]);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Active min (7d)" value={s ? String(s.totalMinutes) : "—"} />
        <Stat label="Steps (7d)" value={s ? s.totalSteps.toLocaleString() : "—"} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Stat label="Avg sleep" value={s?.avgSleepMin != null ? fmtSleep(s.avgSleepMin) : "—"} />
        <Stat label="Streak" value={s ? `${s.streak} day${s.streak === 1 ? "" : "s"}` : "—"} />
      </View>

      <SectionTitle>Log a workout or walk</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ACTIVITY_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} active={actType === t.key} onPress={() => setActType(t.key)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <LuxeInput
            placeholder="Minutes"
            keyboardType="number-pad"
            value={actMinutes}
            onChangeText={setActMinutes}
            style={{ flex: 1 }}
          />
          <LuxeInput
            placeholder="Steps (optional)"
            keyboardType="number-pad"
            value={actSteps}
            onChangeText={setActSteps}
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ marginTop: 12 }}>
          <LuxeButton
            label="Save activity"
            onPress={handleLogActivity}
            loading={createActivity.isPending}
            disabled={!actMinutes.trim()}
          />
        </View>
      </Card>

      <SectionTitle>Log last night's sleep</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <LuxeInput
            placeholder="Hours (e.g. 7.5)"
            keyboardType="decimal-pad"
            value={sleepHours}
            onChangeText={setSleepHours}
            style={{ flex: 1 }}
          />
          <LuxeButton
            label="Save"
            onPress={handleLogSleep}
            loading={createSleep.isPending}
            disabled={!sleepHours.trim()}
            small
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            How did you feel?
          </Text>
          {[1, 2, 3, 4, 5].map((q) => (
            <Chip
              key={q}
              label={String(q)}
              active={sleepQuality === q}
              onPress={() => setSleepQuality(sleepQuality === q ? null : q)}
            />
          ))}
        </View>
      </Card>

      <SectionTitle>Connect a tracker</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="smartphone" size={16} color={c.tint} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
            Steps from this phone
          </Text>
        </View>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
          Reads the last 7 days of steps from your phone's motion sensor — only when you tap, and
          only after you approve.
        </Text>
        {phonePreview ? (
          <View style={{ marginTop: 10 }}>
            {phonePreview.map((d) => (
              <View key={d.date} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                  {fmtDate(d.date)}
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                  {d.steps.toLocaleString()} steps
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <LuxeButton
                  label="Add to my log"
                  onPress={handleImportPhoneSteps}
                  loading={importPhoneSteps.isPending}
                />
              </View>
              <LuxeButton label="Cancel" variant="outline" onPress={() => setPhonePreview(null)} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            <LuxeButton
              label="Read my steps"
              variant="outline"
              onPress={() => void readPhoneSteps()}
              loading={readingSteps}
            />
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="circle" size={16} color={c.tint} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
            Oura Ring
          </Text>
        </View>
        {oura ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
              Connected (token ••••{oura.tokenLast4}) ·{" "}
              {oura.lastSyncedAt
                ? `last synced ${new Date(oura.lastSyncedAt).toLocaleString()}`
                : "not synced yet"}
              {oura.lastSyncStatus === "error" ? " · last sync failed" : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Chip
                label={`Activity ${oura.importActivity ? "on" : "off"}`}
                active={oura.importActivity}
                onPress={() => handleToggleOura("importActivity")}
              />
              <Chip
                label={`Sleep ${oura.importSleep ? "on" : "off"}`}
                active={oura.importSleep}
                onPress={() => handleToggleOura("importSleep")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <LuxeButton label="Sync now" onPress={handleSyncNow} loading={syncOura.isPending} />
              </View>
              <LuxeButton label="Disconnect" variant="outline" onPress={handleDisconnectOura} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
              In the Oura app or at cloud.ouraring.com, create a Personal Access Token and paste it
              here. Your sleep and activity then sync automatically each morning — visible only to
              you, never the med spa.
            </Text>
            <LuxeInput
              placeholder="Paste Oura token"
              autoCapitalize="none"
              autoCorrect={false}
              value={ouraToken}
              onChangeText={setOuraToken}
              style={{ marginTop: 10 }}
            />
            <View style={{ marginTop: 10 }}>
              <LuxeButton
                label="Connect Oura"
                onPress={handleConnectOura}
                loading={connectOura.isPending}
                disabled={!ouraToken.trim()}
              />
            </View>
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather
            name="heart"
            size={16}
            color={healthAvail === "available" ? c.tint : c.mutedForeground}
          />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
            Apple Health
          </Text>
        </View>

        {healthAvail === null ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
            Checking Apple Health…
          </Text>
        ) : healthAvail === "available" ? (
          <View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
              Pulls your last 14 days of steps, workouts, and sleep from Apple Health — only when you
              tap, and only after you approve. Visible only to you, never the med spa.
            </Text>
            {appleLastSync ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
                Last synced {new Date(appleLastSync).toLocaleString()}
              </Text>
            ) : null}
            {applePreview ? (
              <View style={{ marginTop: 10 }}>
                {appleSummaryRows(applePreview).map((row) => (
                  <View
                    key={row.label}
                    style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                      {row.label}
                    </Text>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                      {row.value}
                    </Text>
                  </View>
                ))}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <LuxeButton
                      label="Add to my log"
                      onPress={handleImportAppleHealth}
                      loading={importApple.isPending}
                    />
                  </View>
                  <LuxeButton label="Cancel" variant="outline" onPress={() => setApplePreview(null)} />
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                <LuxeButton
                  label="Sync Apple Health"
                  variant="outline"
                  onPress={() => void readAppleHealth()}
                  loading={readingApple}
                />
              </View>
            )}
            {appleLastSync && !applePreview ? (
              <View style={{ marginTop: 10 }}>
                <LuxeButton
                  label="Remove synced data"
                  variant="outline"
                  onPress={handleRemoveAppleHealth}
                />
              </View>
            ) : null}
          </View>
        ) : healthAvail === "unavailable-build" ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
            Apple Health syncing works in the App Store version of LUXE. For now, phone steps and Oura
            cover automatic tracking.
          </Text>
        ) : (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 6 }}>
            Apple Health is available on iPhone. On this device, use phone steps or Oura for automatic
            tracking.
          </Text>
        )}
      </Card>

      <SectionTitle>Recent activity</SectionTitle>
      {recentActivities.length === 0 ? (
        <Card>
          <EmptyState icon="activity" text="Nothing logged yet. Add a workout above." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {recentActivities.map((a, i) => (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {typeLabel(a.type)}
                  {a.source !== "manual" ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.tint }}>
                      {"  "}
                      {a.source === "oura" ? "OURA" : "PHONE"}
                    </Text>
                  ) : null}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {fmtDate(a.date)}
                  {a.durationMin > 0 ? ` · ${a.durationMin} min` : ""}
                  {a.steps != null ? ` · ${a.steps.toLocaleString()} steps` : ""}
                  {a.calories != null ? ` · ${a.calories} cal` : ""}
                </Text>
              </View>
              {a.source === "manual" ? (
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert("Delete activity?", `Remove the ${fmtDate(a.date)} entry?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteActivity.mutate({ id: a.id }, { onSuccess: invalidate }),
                      },
                    ])
                  }
                >
                  <Feather name="trash-2" size={16} color={c.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>Recent sleep</SectionTitle>
      {recentSleep.length === 0 ? (
        <Card>
          <EmptyState icon="moon" text="No sleep logged yet. Add last night above." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {recentSleep.map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {fmtSleep(e.durationMin)}
                  {e.source === "oura" ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.tint }}>
                      {"  "}OURA
                    </Text>
                  ) : null}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {fmtDate(e.date)}
                  {e.score != null ? ` · score ${e.score}` : ""}
                  {e.quality != null ? ` · felt ${e.quality}/5` : ""}
                </Text>
              </View>
              {e.source === "manual" ? (
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert("Delete sleep entry?", `Remove the ${fmtDate(e.date)} entry?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteSleep.mutate({ id: e.id }, { onSuccess: invalidate }),
                      },
                    ])
                  }
                >
                  <Feather name="trash-2" size={16} color={c.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: c.mutedForeground,
          marginTop: 16,
          textAlign: "center",
        }}
      >
        Device numbers are estimates from your tracker. This data is private to you — the med spa
        never sees it.
      </Text>
    </View>
  );
}
