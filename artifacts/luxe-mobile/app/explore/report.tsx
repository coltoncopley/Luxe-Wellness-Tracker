import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { useGetWeeklyReport } from "@workspace/api-client-react";

import { Card, EmptyState, ErrorView, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { fmtDate } from "@/lib/luxe";

export default function WeeklyReportScreen() {
  const c = useColors();
  const query = useGetWeeklyReport();
  const report = query.data?.report ?? null;

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
        A look back at last week — written just for you.
      </Text>

      {query.isLoading ? (
        <Card>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
            Reviewing your week...
          </Text>
        </Card>
      ) : query.isError ? (
        <ErrorView
          message="Your report isn't ready yet. Please try again in a moment."
          onRetry={() => void query.refetch()}
        />
      ) : !report ? (
        <EmptyState
          icon="file-text"
          text="You didn't log anything last week, so there's no report this time. Start logging today and next Monday a full recap will be waiting here."
        />
      ) : (
        <>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground }}>
            Week of {fmtDate(report.weekStart)} – {fmtDate(report.weekEnd)}
          </Text>

          <Card style={{ marginTop: 10, borderColor: c.accent, borderWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Feather name="star" size={14} color={c.tint} />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.tint }}>
                Your week in review
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                lineHeight: 21,
                color: c.foreground,
              }}
            >
              {report.summary}
            </Text>
          </Card>

          {report.highlights.length > 0 ? (
            <>
              <SectionTitle>Wins from last week</SectionTitle>
              <Card style={{ gap: 8 }}>
                {report.highlights.map((h, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Feather name="check-circle" size={15} color={c.success} style={{ marginTop: 2 }} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        lineHeight: 19,
                        color: c.foreground,
                      }}
                    >
                      {h}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle>The numbers</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatBox
              icon="coffee"
              label="Meals logged"
              value={`${report.stats.mealsLogged}`}
              sub={report.stats.avgCalories != null ? `~${report.stats.avgCalories} cal/day` : undefined}
            />
            <StatBox
              icon="target"
              label="Weigh-ins"
              value={`${report.stats.weighIns}`}
              sub={
                report.stats.weightChangeLbs != null
                  ? `${report.stats.weightChangeLbs > 0 ? "+" : ""}${report.stats.weightChangeLbs} lbs`
                  : undefined
              }
            />
            <StatBox
              icon="sun"
              label="Glow check-ins"
              value={`${report.stats.glowCheckins}`}
              sub={report.stats.avgGlowScore != null ? `avg ${report.stats.avgGlowScore}` : undefined}
            />
            <StatBox
              icon="activity"
              label="Activity"
              value={`${report.stats.activeMinutes}m`}
              sub={report.stats.steps > 0 ? `${report.stats.steps.toLocaleString()} steps` : undefined}
            />
          </View>

          <Card style={{ marginTop: 12, backgroundColor: c.secondary, borderWidth: 0 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Feather name="sunrise" size={16} color={c.tint} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground }}>
                  Focus for this week
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    lineHeight: 19,
                    color: c.mutedForeground,
                    marginTop: 4,
                  }}
                >
                  {report.focus}
                </Text>
              </View>
            </View>
          </Card>
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
        Your weekly report is private to you — never shared with LUXE staff. General wellness
        encouragement, not medical advice.
      </Text>
    </StackScreen>
  );
}

function StatBox({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  sub?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        width: "48%",
        flexGrow: 1,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name={icon} size={13} color={c.tint} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 20,
          color: c.foreground,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
