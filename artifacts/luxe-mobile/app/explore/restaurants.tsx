import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  useListMenuItems,
  useListRestaurants,
  type MenuItem,
  type Restaurant,
} from "@workspace/api-client-react";

import { Card, EmptyState, ErrorView, LoadingView, Segmented, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function RestaurantsScreen() {
  const restaurants = useListRestaurants();

  if (restaurants.isLoading) return <LoadingView />;
  if (restaurants.isError)
    return (
      <ErrorView message="Couldn't load the dining guide." onRetry={() => restaurants.refetch()} />
    );

  return (
    <StackScreen refreshing={restaurants.isRefetching} onRefresh={() => void restaurants.refetch()}>
      <IntroCard />
      {restaurants.data && restaurants.data.length > 0 ? (
        restaurants.data.map((r) => <RestaurantCard key={r.id} restaurant={r} />)
      ) : (
        <Card style={{ marginTop: 16 }}>
          <EmptyState icon="map-pin" text="No restaurants available yet." />
        </Card>
      )}
    </StackScreen>
  );
}

function IntroCard() {
  const c = useColors();
  return (
    <View style={{ marginBottom: 4 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 24,
          color: c.foreground,
          marginBottom: 4,
        }}
      >
        Local Dining Guide
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
        Curated healthy options for dining out in South Point.
      </Text>
    </View>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ padding: 16, flexDirection: "row", alignItems: "center" }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 11,
              color: c.accentForeground,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            {restaurant.cuisine}
          </Text>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 17, color: c.foreground }}>
            {restaurant.name}
          </Text>
          {restaurant.description ? (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: c.mutedForeground,
                marginTop: 4,
              }}
            >
              {restaurant.description}
            </Text>
          ) : null}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={c.mutedForeground} />
      </Pressable>
      {expanded ? <RestaurantMenu restaurantId={restaurant.id} /> : null}
    </Card>
  );
}

function RestaurantMenu({ restaurantId }: { restaurantId: number }) {
  const c = useColors();
  const [tab, setTab] = useState<"healthy" | "all">("healthy");
  const menu = useListMenuItems(restaurantId, {
    query: { queryKey: ["listMenuItems", restaurantId] },
  });

  const items = menu.data ?? [];
  const healthyPicks = items.filter((i) => i.isHealthyPick);
  const shown = tab === "healthy" ? healthyPicks : items;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, padding: 16 }}>
      {menu.isLoading ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center", paddingVertical: 12 }}>
          Loading menu…
        </Text>
      ) : items.length === 0 ? (
        <EmptyState icon="coffee" text="No menu items listed yet." />
      ) : (
        <>
          <Segmented
            options={[
              { key: "healthy", label: `Healthy (${healthyPicks.length})` },
              { key: "all", label: `Full Menu (${items.length})` },
            ]}
            value={tab}
            onChange={(k) => setTab(k as "healthy" | "all")}
          />
          {shown.length === 0 ? (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: c.mutedForeground,
                textAlign: "center",
                paddingVertical: 12,
              }}
            >
              No healthy picks identified for this restaurant yet.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {shown.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function MenuItemRow({ item }: { item: MenuItem }) {
  const c = useColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: item.isHealthyPick ? c.accent : c.border,
        borderRadius: 12,
        padding: 12,
        backgroundColor: c.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground, flexShrink: 1 }}>
            {item.name}
          </Text>
          {item.isHealthyPick ? (
            <Feather name="check-circle" size={16} color={c.accent} />
          ) : null}
        </View>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.tint }}>
          {item.calories} kcal
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          P: {item.proteinG ?? 0}g
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          C: {item.carbsG ?? 0}g
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          F: {item.fatG ?? 0}g
        </Text>
      </View>
      {item.orderingTip ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: c.secondary,
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Feather name="info" size={14} color={c.tint} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, lineHeight: 18 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground }}>Ordering Tip: </Text>
            {item.orderingTip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
