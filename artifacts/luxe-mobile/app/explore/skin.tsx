import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Alert, Platform, Text, View } from "react-native";

import {
  getGetSkinScanHistoryQueryKey,
  useAnalyzeSkinScan,
  useGetSkinScanHistory,
} from "@workspace/api-client-react";

import { ScoreRing } from "@/components/ScoreRing";
import { Card, EmptyState, ErrorView, LuxeButton, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { BOOKING_URL, fmtDate, pickImageAsset } from "@/lib/luxe";

const SCORE_LABELS: { key: "hydration" | "smoothness" | "evenness" | "clarity" | "radiance"; label: string }[] = [
  { key: "hydration", label: "Hydration" },
  { key: "smoothness", label: "Smoothness" },
  { key: "evenness", label: "Even tone" },
  { key: "clarity", label: "Clarity" },
  { key: "radiance", label: "Radiance" },
];

function scoreWord(n: number): string {
  if (n >= 85) return "Excellent";
  if (n >= 70) return "Great";
  if (n >= 55) return "Good";
  return "Needs love";
}

export default function SkinScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const history = useGetSkinScanHistory();
  const analyze = useAnalyzeSkinScan();
  const [scanning, setScanning] = useState(false);

  const scans = history.data?.scans ?? [];
  const latest = scans.length > 0 ? scans[scans.length - 1]! : null;
  const currentWeekScanned = history.data?.currentWeekScanned ?? false;

  async function scan(source: "camera" | "library") {
    setScanning(true);
    try {
      const asset = await pickImageAsset(source, { base64: true });
      if (!asset) return;
      if (!asset.base64) throw new Error("Couldn't read the photo. Please try again.");
      const imageDataUrl = `data:image/jpeg;base64,${asset.base64}`;
      await analyze.mutateAsync({ data: { imageDataUrl } });
      await queryClient.invalidateQueries({ queryKey: getGetSkinScanHistoryQueryKey() });
      Alert.alert("Scan complete", "Your skin scan for this week is ready.");
    } catch (err) {
      Alert.alert(
        "Couldn't analyze photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setScanning(false);
    }
  }

  function handleScan() {
    if (scanning) return;
    Alert.alert("Skin scan", "Take a well-lit selfie facing the camera, no makeup if possible.", [
      { text: "Take selfie", onPress: () => void scan("camera") },
      { text: "Choose from library", onPress: () => void scan("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const maxOverall = Math.max(1, ...scans.map((s) => s.overall));

  return (
    <StackScreen refreshing={history.isRefetching} onRefresh={() => void history.refetch()}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
        A weekly AI check-in on your skin — hydration, texture, tone, and glow.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 }}>
        <Feather name="lock" size={13} color={c.mutedForeground} style={{ marginTop: 2 }} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, flex: 1 }}>
          Your scans are private to you — never shared with LUXE staff. Cosmetic guidance only,
          not medical advice.
        </Text>
      </View>

      <Card style={{ marginTop: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Feather
            name={currentWeekScanned ? "check-circle" : "camera"}
            size={26}
            color={c.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
              {currentWeekScanned ? "This week's scan is done" : "Ready for this week's scan?"}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
              {currentWeekScanned
                ? "You can rescan anytime — it replaces this week's result."
                : "Take a well-lit selfie facing the camera, no makeup if possible."}
            </Text>
          </View>
        </View>
        <LuxeButton
          label={scanning ? "Analyzing…" : currentWeekScanned ? "Rescan" : "Scan my skin"}
          icon="camera"
          onPress={handleScan}
          loading={scanning}
        />
      </Card>

      {history.isLoading ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState icon="loader" text="Loading your scans…" />
        </Card>
      ) : history.isError ? (
        <ErrorView message="Couldn't load your scans." onRetry={() => history.refetch()} />
      ) : latest ? (
        <>
          <Card style={{ marginTop: 16, alignItems: "center", paddingVertical: 24 }}>
            <ScoreRing score={latest.overall} label="skin score" />
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground, marginTop: 10 }}>
              {scoreWord(latest.overall)} · scanned {fmtDate(latest.scannedOn)}
            </Text>
          </Card>

          <SectionTitle>Breakdown</SectionTitle>
          <Card style={{ gap: 12 }}>
            {SCORE_LABELS.map(({ key, label }) => {
              const val = latest[key];
              return (
                <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ width: 90, fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
                    {label}
                  </Text>
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.secondary, overflow: "hidden" }}>
                    <View style={{ width: `${Math.max(0, Math.min(100, val))}%`, height: 8, backgroundColor: c.accent }} />
                  </View>
                  <Text style={{ width: 28, textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                    {val}
                  </Text>
                </View>
              );
            })}
          </Card>

          <SectionTitle>What the AI noticed</SectionTitle>
          <Card style={{ gap: 12 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, color: c.foreground }}>
              {latest.summary}
            </Text>
            {latest.tips.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                  Tips for this week
                </Text>
                {latest.tips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: c.accent, fontFamily: "Inter_600SemiBold" }}>•</Text>
                    <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {latest.suggestion ? (
              <View
                style={{
                  borderRadius: c.radius - 4,
                  borderWidth: 1,
                  borderColor: c.accent,
                  backgroundColor: c.secondary,
                  padding: 14,
                  gap: 8,
                }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.foreground }}>
                  {latest.suggestion}
                </Text>
                <LuxeButton
                  label="Book a visit at LUXE"
                  icon="calendar"
                  variant="outline"
                  small
                  onPress={() => void WebBrowser.openBrowserAsync(BOOKING_URL)}
                />
              </View>
            ) : null}
          </Card>

          {scans.length >= 2 ? (
            <>
              <SectionTitle>Your trend</SectionTitle>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
                  {scans.slice(-8).map((s) => (
                    <View key={s.id} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                      <View
                        style={{
                          width: "100%",
                          height: Math.max(4, (s.overall / maxOverall) * 70),
                          backgroundColor: c.accent,
                          borderRadius: 4,
                          opacity: 0.5 + (s.overall / 100) * 0.5,
                        }}
                      />
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: c.mutedForeground }}>
                        {fmtDate(s.weekStart).split(" ")[1]}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            icon="camera"
            text="No scans yet. Take your first selfie scan — your weekly trend starts here."
          />
        </Card>
      )}

      {Platform.OS === "web" ? <View style={{ height: 34 }} /> : null}
    </StackScreen>
  );
}
