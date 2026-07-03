import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import type {
  Mission,
  MissionsResponse,
  RewardEvent,
  RewardsSummary,
  TierInfo,
} from "@workspace/api-client-react";
import {
  getGetRewardsSummaryQueryKey,
  getListMissionsQueryKey,
  useGetRewardsSummary,
  useListMissions,
  useRedeemReward,
} from "@workspace/api-client-react";

import { Card, EmptyState, LuxeButton, Screen, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";

export default function RewardsScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const summary = useGetRewardsSummary();
  const missions = useListMissions();
  const redeem = useRedeemReward();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() }),
    ]);
    setRefreshing(false);
  };

  const s = summary.data;
  const tier = s?.tier;
  const tierProgress =
    tier && tier.nextMinPoints != null && s
      ? Math.min(
          100,
          Math.round(
            ((s.totalEarned - tier.minPoints) / Math.max(1, tier.nextMinPoints - tier.minPoints)) * 100,
          ),
        )
      : null;

  const handleRedeem = (rewardId: string, title: string, points: number) => {
    Alert.alert("Redeem reward?", `Spend ${points} points on "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Redeem",
        onPress: () =>
          redeem.mutate(
            { data: { rewardId } },
            {
              onSuccess: (res) => {
                void queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
                Alert.alert(
                  "Redeemed! 🎉",
                  `Show this code at the front desk:\n\n${res.code}\n\nYou can also find it in your history below.`,
                );
              },
              onError: () => {
                Alert.alert("Couldn't redeem", "Please check your balance and try again.");
              },
            },
          ),
      },
    ]);
  };

  const history = (s?.history ?? []).slice(0, 15);

  return (
    <View style={{ flex: 1 }}>
      <RewardsBody
        c={c}
        s={s}
        tier={tier}
        tierProgress={tierProgress}
        missions={missions.data}
        history={history}
        onRedeem={handleRedeem}
        redeemPending={redeem.isPending}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}

function RewardsBody({
  c,
  s,
  tier,
  tierProgress,
  missions,
  history,
  onRedeem,
  redeemPending,
  refreshing,
  onRefresh,
}: {
  c: ReturnType<typeof useColors>;
  s: RewardsSummary | undefined;
  tier: TierInfo | undefined;
  tierProgress: number | null;
  missions: MissionsResponse | undefined;
  history: RewardEvent[];
  onRedeem: (rewardId: string, title: string, points: number) => void;
  redeemPending: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Screen title="Rewards" subtitle="Earn points, unlock perks" refreshing={refreshing} onRefresh={onRefresh}>
      <Card style={{ alignItems: "center", paddingVertical: 24 }}>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
          Your balance
        </Text>
        <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 44, color: c.tint, marginTop: 4 }}>
          {s?.balance ?? 0}
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
          points
        </Text>
        {tier ? (
          <View style={{ width: "100%", marginTop: 18 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                {tier.name} tier
              </Text>
              {tier.nextName && tier.nextMinPoints != null && s ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  {Math.max(0, tier.nextMinPoints - s.totalEarned)} pts to {tier.nextName}
                </Text>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  Top tier 💎
                </Text>
              )}
            </View>
            {tierProgress != null ? (
              <View style={{ height: 6, backgroundColor: c.secondary, borderRadius: 3 }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.max(0, tierProgress)}%`,
                    backgroundColor: c.accent,
                    borderRadius: 3,
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <SectionTitle>This week's missions</SectionTitle>
      {!missions || missions.missions.length === 0 ? (
        <Card>
          <EmptyState icon="target" text="No missions this week — check back Monday." />
        </Card>
      ) : (
        <Card style={{ gap: 14 }}>
          {missions.missions.map((m: Mission) => (
            <View key={m.key}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground, flex: 1 }}>
                  {m.completed ? "✅ " : ""}
                  {m.title}
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.tint }}>
                  +{m.rewardPoints}
                </Text>
              </View>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginBottom: 6 }}>
                {m.description}
              </Text>
              <View style={{ height: 6, backgroundColor: c.secondary, borderRadius: 3 }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.round((m.progress / Math.max(1, m.target)) * 100)}%`,
                    backgroundColor: m.completed ? c.success : c.accent,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>Redeem points</SectionTitle>
      {(s?.catalog ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="gift" text="No rewards available right now." />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {(s?.catalog ?? []).map((item) => {
            const affordable = (s?.balance ?? 0) >= item.points;
            return (
              <Card key={item.id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.tint }}>
                      {item.points} pts
                    </Text>
                    <LuxeButton
                      label="Redeem"
                      small
                      disabled={!affordable || redeemPending}
                      onPress={() => onRedeem(item.id, item.title, item.points)}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <SectionTitle>Recent activity</SectionTitle>
      {history.length === 0 ? (
        <Card>
          <EmptyState icon="clock" text="No point activity yet. Start checking in!" />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {history.map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
                  {e.description}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 1 }}>
                  {fmtDate(e.date)}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: e.points >= 0 ? c.success : c.destructive,
                }}
              >
                {e.points >= 0 ? "+" : ""}
                {e.points}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
