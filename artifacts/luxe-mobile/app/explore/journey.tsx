import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useGetJourney } from "@workspace/api-client-react";
import type { JourneyPhoto } from "@workspace/api-client-react";

import { Card, EmptyState, ErrorView, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { apiUrl, fmtDate } from "@/lib/luxe";

export default function JourneyScreen() {
  const c = useColors();
  const { getToken } = useAuth();
  const journey = useGetJourney();
  const [viewed, setViewed] = useState<JourneyPhoto | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getToken()
      .then((t) => {
        if (active) setToken(t);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [getToken]);

  function imageSource(objectPath: string) {
    const uri = apiUrl(`/storage${objectPath}`);
    return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
  }

  const data = journey.data;
  const days = data ? [...data.days].reverse() : [];
  const change =
    data?.startWeightLbs != null && data?.currentWeightLbs != null
      ? Math.round((data.currentWeightLbs - data.startWeightLbs) * 10) / 10
      : null;

  return (
    <StackScreen>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          color: c.mutedForeground,
          marginBottom: 12,
        }}
      >
        Your whole story in one place — weigh-ins, glow days, and progress photos.
      </Text>
      {journey.isError ? (
        <ErrorView message="Couldn't load your journey." onRetry={() => void journey.refetch()} />
      ) : days.length === 0 && !journey.isLoading ? (
        <EmptyState
          icon="map"
          text="Your journey starts today. Log a weigh-in, a glow check-in, or a progress photo and it will appear here."
        />
      ) : (
        <>
          {change != null ? (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  Started at
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: c.foreground }}>
                  {data?.startWeightLbs} lbs
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  Now
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: c.foreground }}>
                  {data?.currentWeightLbs} lbs
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather
                  name={change <= 0 ? "trending-down" : "trending-up"}
                  size={17}
                  color={change <= 0 ? c.success : c.tint}
                />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: c.foreground }}>
                  {change > 0 ? "+" : ""}
                  {change}
                </Text>
              </View>
            </Card>
          ) : null}

          <View style={{ gap: 10, marginTop: 12 }}>
            {days.map((day) => (
              <Card key={day.date}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                  {fmtDate(day.date)}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {day.weightLbs != null ? (
                    <JourneyChip icon="target" label={`${day.weightLbs} lbs`} />
                  ) : null}
                  {day.glowScore != null ? (
                    <JourneyChip icon="sun" label={`Glow ${day.glowScore}`} />
                  ) : null}
                </View>
                {day.photos.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {day.photos.map((p) => (
                      <Pressable key={p.id} onPress={() => setViewed(p)}>
                        <Image
                          source={imageSource(p.objectPath)}
                          style={{
                            width: 84,
                            height: 84,
                            borderRadius: 12,
                            backgroundColor: c.secondary,
                          }}
                          contentFit="cover"
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        </>
      )}

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: c.mutedForeground,
          marginTop: 16,
        }}
      >
        Your journey is private to you — it is never shared with LUXE staff.
      </Text>

      <Modal visible={!!viewed} transparent animationType="fade" onRequestClose={() => setViewed(null)}>
        <Pressable
          onPress={() => setViewed(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          {viewed ? (
            <View style={{ width: "100%" }}>
              <Image
                source={imageSource(viewed.objectPath)}
                style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 16 }}
                contentFit="cover"
              />
              {viewed.note ? (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: "#fff",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  {viewed.note}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </StackScreen>
  );
}

function JourneyChip({ icon, label }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: c.secondary,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      <Feather name={icon} size={12} color={c.tint} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.foreground }}>{label}</Text>
    </View>
  );
}
