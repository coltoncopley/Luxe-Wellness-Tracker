import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getListOffersQueryKey,
  useClaimOffer,
  useGetBriefing,
  useGetCurrentDoctorTip,
  useListAnnouncements,
  useListOffers,
} from "@workspace/api-client-react";

import { ScoreRing } from "@/components/ScoreRing";
import { Card, EmptyState, LuxeButton, Screen, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate, greeting } from "@/lib/luxe";

export default function HomeScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const briefing = useGetBriefing();
  const announcements = useListAnnouncements();
  const doctorTip = useGetCurrentDoctorTip();
  const offers = useListOffers();
  const claimOffer = useClaimOffer();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  const b = briefing.data;
  const y = b?.yesterday;

  const goForTodo = (href: string) => {
    if (href.startsWith("/luxe-ai")) router.push("/(tabs)/chat");
    else if (href.startsWith("/weight") || href.startsWith("/glow") || href.startsWith("/food"))
      router.push("/(tabs)/track");
    else if (href.startsWith("/rewards")) router.push("/(tabs)/rewards");
    else router.push("/(tabs)/track");
  };

  const handleClaim = (offerId: number, title: string) => {
    claimOffer.mutate(
      { id: offerId },
      {
        onSuccess: (res) => {
          void queryClient.invalidateQueries({ queryKey: getListOffersQueryKey() });
          Alert.alert("Offer claimed! ✨", `Show this code at your visit:\n\n${res.code}`);
        },
        onError: () => Alert.alert("Couldn't claim", `The "${title}" offer may have expired.`),
      },
    );
  };

  return (
    <Screen
      title={`${greeting()}${b?.firstName ? `, ${b.firstName}` : ""}`}
      subtitle="Here's your day at LUXE"
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="settings" size={18} color={c.foreground} />
        </Pressable>
      }
    >
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <ScoreRing score={b?.wellnessScore ?? 0} size={104} label="Wellness" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            Today's Wellness Score
          </Text>
          <View style={{ gap: 4, marginTop: 8 }}>
            {(b?.components ?? []).map((comp) => (
              <View key={comp.key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  {comp.label}
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.foreground }}>
                  {comp.points}/{comp.maxPoints}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {b?.aiBriefing ? (
        <Card style={{ marginTop: 12, borderColor: c.accent, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Feather name="star" size={14} color={c.tint} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.tint }}>
              Your morning briefing
            </Text>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, color: c.foreground }}>
            {b.aiBriefing}
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Today's to-dos</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {(b?.todos ?? []).length === 0 ? (
          <EmptyState icon="check-circle" text="Nothing on the list right now." />
        ) : (
          (b?.todos ?? []).map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => (t.done ? undefined : goForTodo(t.href))}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Feather
                name={t.done ? "check-circle" : "circle"}
                size={19}
                color={t.done ? c.success : c.mutedForeground}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: t.done ? c.mutedForeground : c.foreground,
                  textDecorationLine: t.done ? "line-through" : "none",
                }}
              >
                {t.label}
              </Text>
              {!t.done ? <Feather name="chevron-right" size={16} color={c.mutedForeground} /> : null}
            </Pressable>
          ))
        )}
      </Card>

      <SectionTitle>Explore</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          { label: "Skin Scan", icon: "aperture" as const, href: "/explore/skin" },
          { label: "Ingredient Scanner", icon: "search" as const, href: "/explore/ingredients" },
          { label: "Progress Photos", icon: "camera" as const, href: "/explore/photos" },
          { label: "Beauty Passport", icon: "book-open" as const, href: "/explore/passport" },
          { label: "Dining Out Guide", icon: "map-pin" as const, href: "/explore/restaurants" },
          { label: "Friends", icon: "users" as const, href: "/explore/friends" },
          { label: "Community", icon: "heart" as const, href: "/explore/community" },
          { label: "Hormone Health", icon: "activity" as const, href: "/explore/bhrt" },
        ].map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => ({
              width: "48%",
              flexGrow: 1,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c.secondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name={item.icon} size={15} color={c.tint} />
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: c.foreground,
              }}
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {y && (y.calories != null || y.glowScore != null || y.weightChangeLbs != null) ? (
        <>
          <SectionTitle>Yesterday</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {y.calories != null ? (
              <RecapChip label={`🍽 ${y.calories}${y.calorieTarget ? `/${y.calorieTarget}` : ""} cal`} />
            ) : null}
            {y.proteinGrams != null ? <RecapChip label={`💪 ${y.proteinGrams}g protein`} /> : null}
            {y.glowScore != null ? <RecapChip label={`✨ Glow ${y.glowScore}`} /> : null}
            {y.weightChangeLbs != null ? (
              <RecapChip
                label={`⚖️ ${y.weightChangeLbs > 0 ? "+" : ""}${y.weightChangeLbs.toFixed(1)} lbs`}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {b?.nextAppointment ? (
        <>
          <SectionTitle>Next appointment</SectionTitle>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="calendar" size={17} color={c.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {b.nextAppointment.serviceName}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {fmtDate(b.nextAppointment.date)}
                  {b.nextAppointment.time ? ` · ${b.nextAppointment.time}` : ""}
                </Text>
              </View>
            </View>
          </Card>
        </>
      ) : null}

      {(offers.data?.offers ?? []).length > 0 ? (
        <>
          <SectionTitle>Limited-time offers</SectionTitle>
          <View style={{ gap: 10 }}>
            {(offers.data?.offers ?? []).map((o) => (
              <Card key={o.id} style={{ borderColor: c.accent }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                  {o.title}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 3 }}>
                  {o.description}
                </Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.tint, marginTop: 6 }}>
                  Ends {fmtDate(o.endsAt.slice(0, 10))}
                </Text>
                <View style={{ marginTop: 12 }}>
                  {o.claimed && o.claimCode ? (
                    <View
                      style={{
                        backgroundColor: c.secondary,
                        borderRadius: 12,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground, letterSpacing: 1 }}>
                        {o.claimCode}
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                        Show this code at your visit
                      </Text>
                    </View>
                  ) : (
                    <LuxeButton
                      label="Claim this offer"
                      small
                      onPress={() => handleClaim(o.id, o.title)}
                      loading={claimOffer.isPending}
                    />
                  )}
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {doctorTip.data?.tip ? (
        <>
          <SectionTitle>This week from Dr. Copley</SectionTitle>
          <Card>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
              {doctorTip.data.tip.title}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                lineHeight: 21,
                color: c.mutedForeground,
                marginTop: 6,
              }}
            >
              {doctorTip.data.tip.body}
            </Text>
          </Card>
        </>
      ) : null}

      {(announcements.data?.announcements ?? []).length > 0 ? (
        <>
          <SectionTitle>From the med spa</SectionTitle>
          <View style={{ gap: 10 }}>
            {(announcements.data?.announcements ?? []).slice(0, 3).map((a) => (
              <Card key={a.id}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  {a.title}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 4 }}>
                  {a.body}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function RecapChip({ label }: { label: string }) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>{label}</Text>
    </View>
  );
}
