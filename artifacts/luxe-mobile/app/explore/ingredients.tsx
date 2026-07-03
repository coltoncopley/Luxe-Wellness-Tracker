import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getListIngredientScansQueryKey,
  useAnalyzeIngredients,
  useDeleteIngredientScan,
  useListIngredientScans,
} from "@workspace/api-client-react";
import type { IngredientScanResult } from "@workspace/api-client-react";

import { Card, EmptyState, ErrorView, LuxeButton, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { BOOKING_URL, fmtDate, pickImageAsset } from "@/lib/luxe";

const VERDICT_LABELS: Record<string, string> = {
  great: "Great pick",
  good: "Good",
  mixed: "Mixed bag",
  caution: "Use caution",
};

function useVerdictColors(): Record<string, string> {
  const c = useColors();
  return {
    great: c.success,
    good: c.info,
    mixed: c.warning,
    caution: c.destructive,
  };
}

const PREGNANCY_LABELS: Record<string, string> = {
  generally_ok: "Generally considered OK in pregnancy",
  use_caution: "Use caution in pregnancy",
  avoid: "Often avoided in pregnancy",
  unknown: "Pregnancy safety unclear",
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const verdictColors = useVerdictColors();
  const color = verdictColors[verdict] ?? verdictColors.mixed!;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
        {VERDICT_LABELS[verdict] ?? VERDICT_LABELS.mixed}
      </Text>
    </View>
  );
}

function ScanDetails({ scan }: { scan: IngredientScanResult }) {
  const c = useColors();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, color: c.foreground }}>
        {scan.summary}
      </Text>
      {scan.goodIngredients.length > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="check" size={14} color={c.success} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
              The good stuff
            </Text>
          </View>
          {scan.goodIngredients.map((g, i) => (
            <Text key={i} style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              {g}
            </Text>
          ))}
        </View>
      ) : null}
      {scan.concerns.length > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="alert-triangle" size={14} color={c.warning} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
              Worth knowing
            </Text>
          </View>
          {scan.concerns.map((cc, i) => (
            <Text key={i} style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              {cc}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={{ borderRadius: c.radius - 6, backgroundColor: c.secondary, padding: 12, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="alert-circle" size={14} color={c.accent} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground, flex: 1 }}>
            {PREGNANCY_LABELS[scan.pregnancySafety] ?? PREGNANCY_LABELS.unknown}
          </Text>
        </View>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          {scan.pregnancyNote}
        </Text>
      </View>
      {scan.suggestion ? (
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
            {scan.suggestion}
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
    </View>
  );
}

export default function IngredientsScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const list = useListIngredientScans();
  const analyze = useAnalyzeIngredients();
  const deleteScan = useDeleteIngredientScan();

  const [scanning, setScanning] = useState(false);
  const [latest, setLatest] = useState<IngredientScanResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const scans = list.data?.scans ?? [];
  const past = latest ? scans.filter((s) => s.id !== latest.id) : scans;

  async function scan(source: "camera" | "library") {
    setScanning(true);
    try {
      const asset = await pickImageAsset(source, { base64: true });
      if (!asset) return;
      if (!asset.base64) throw new Error("Couldn't read the photo. Please try again.");
      const imageDataUrl = `data:image/jpeg;base64,${asset.base64}`;
      const result = await analyze.mutateAsync({ data: { imageDataUrl } });
      setLatest(result);
      await queryClient.invalidateQueries({ queryKey: getListIngredientScansQueryKey() });
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
    Alert.alert("Scan a label", "Take a clear, close-up photo of the ingredient list.", [
      { text: "Take photo", onPress: () => void scan("camera") },
      { text: "Choose from library", onPress: () => void scan("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleDelete(id: number) {
    Alert.alert("Delete scan?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteScan.mutate(
            { id },
            {
              onSuccess: () => {
                if (latest?.id === id) setLatest(null);
                if (expanded === id) setExpanded(null);
                void queryClient.invalidateQueries({ queryKey: getListIngredientScansQueryKey() });
              },
            },
          );
        },
      },
    ]);
  }

  return (
    <StackScreen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
        Snap a product's ingredient label — the AI tells you what's great, what to watch, and
        whether it's worth it.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 }}>
        <Feather name="lock" size={13} color={c.mutedForeground} style={{ marginTop: 2 }} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, flex: 1 }}>
          Your scans are private to you. Educational info only — not medical advice; check with
          your own doctor about pregnancy and sensitivities.
        </Text>
      </View>

      <Card style={{ marginTop: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Feather name="camera" size={26} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
              Check a product
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
              Take a clear, close-up photo of the ingredient list.
            </Text>
          </View>
        </View>
        <LuxeButton
          label={scanning ? "Analyzing…" : "Scan a label"}
          icon="camera"
          onPress={handleScan}
          loading={scanning}
        />
      </Card>

      {latest ? (
        <>
          <SectionTitle>Latest result</SectionTitle>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground }}>
                {latest.productName}
              </Text>
              <VerdictBadge verdict={latest.verdict} />
            </View>
            <ScanDetails scan={latest} />
          </Card>
        </>
      ) : null}

      <SectionTitle>Past scans</SectionTitle>
      {list.isLoading ? (
        <Card>
          <EmptyState icon="loader" text="Loading…" />
        </Card>
      ) : list.isError ? (
        <ErrorView message="Couldn't load your scans." onRetry={() => list.refetch()} />
      ) : past.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            text={
              latest
                ? "Your earlier scans will show up here."
                : "No scans yet. Grab a product from your bathroom shelf and check it!"
            }
          />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {past.map((s) => {
            const open = expanded === s.id;
            return (
              <Card key={s.id} style={{ gap: open ? 12 : 0 }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : s.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                      {s.productName}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                      {fmtDate(s.scannedOn)}
                    </Text>
                  </View>
                  <VerdictBadge verdict={s.verdict} />
                  <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
                </Pressable>
                {open ? (
                  <>
                    <ScanDetails scan={s} />
                    <LuxeButton
                      label="Delete"
                      icon="trash-2"
                      variant="ghost"
                      small
                      onPress={() => handleDelete(s.id)}
                    />
                  </>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {Platform.OS === "web" ? <View style={{ height: 34 }} /> : null}
    </StackScreen>
  );
}
