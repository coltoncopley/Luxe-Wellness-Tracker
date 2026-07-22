import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import {
  getListRestaurantsQueryKey,
  useCreateCustomRestaurant,
  useDiscoverRestaurants,
  useDeleteCustomRestaurant,
  useListMenuItems,
  useListRestaurants,
  type MenuItem,
  type Restaurant,
} from "@workspace/api-client-react";

import {
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  Segmented,
  StackScreen,
} from "@/components/ui";
import { NutritionFactsLabel } from "@/components/NutritionFactsLabel";
import { useColors } from "@/hooks/useColors";
import { Alert } from "@/lib/alert";

function openDoorDash(name: string) {
  void Linking.openURL(`https://www.doordash.com/search/store/${encodeURIComponent(name)}`);
}

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
      <FindNearbyCard />
      <AddRestaurantCard />
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
        Curated healthy picks for eating out — or find real spots near you.
      </Text>
    </View>
  );
}

function FindNearbyCard() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const queryClient = useQueryClient();
  const discoverMutation = useDiscoverRestaurants();

  const submit = () => {
    const trimmed = location.trim();
    if (trimmed.length < 2) {
      Alert.alert("Find restaurants", "Type a city or area first (e.g. Columbus OH).");
      return;
    }
    discoverMutation.mutate(
      { data: { location: trimmed } },
      {
        onSuccess: (result) => {
          void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
          if (result.added > 0) {
            setLocation("");
            setOpen(false);
            Alert.alert(
              "Added!",
              `Added ${result.added} spot${result.added === 1 ? "" : "s"} near ${trimmed} to your dining guide.`,
            );
          } else {
            Alert.alert("Already added", "Those spots are already in your dining guide.");
          }
        },
        onError: (err) => {
          const { status, data } = err as { status?: number; data?: { error?: string } | null };
          const message =
            status === 422
              ? "We couldn't find restaurants near there — try a nearby city or a larger town."
              : status === 429
                ? (data?.error ??
                  "You've searched a few times already — try again in a little while.")
                : "Couldn't search right now. Please try again.";
          Alert.alert("Find restaurants", message);
        },
      },
    );
  };

  return (
    <Card style={{ marginTop: 14 }}>
      {open ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground }}>
            Find restaurants near you
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Traveling or eating somewhere new? Type a city or area and we'll look up real restaurants
            there and add them to your private guide with healthy picks.
          </Text>
          <LuxeInput
            placeholder="City or area (e.g. Columbus OH)"
            value={location}
            onChangeText={setLocation}
            maxLength={80}
            editable={!discoverMutation.isPending}
          />
          {discoverMutation.isPending ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              Searching the web for real restaurants near {location.trim()} — this can take up to a
              minute...
            </Text>
          ) : null}
          <LuxeButton
            label={discoverMutation.isPending ? "Searching..." : "Find restaurants near me"}
            icon="map-pin"
            onPress={submit}
            loading={discoverMutation.isPending}
          />
          {!discoverMutation.isPending ? (
            <LuxeButton label="Cancel" variant="ghost" small onPress={() => setOpen(false)} />
          ) : null}
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
            We only add real places we can find online. Nutrition is always an AI estimate — actual
            values vary by location and portion.
          </Text>
        </View>
      ) : (
        <LuxeButton
          label="Find restaurants near me"
          icon="map-pin"
          variant="outline"
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

function AddRestaurantCard() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [location, setLocation] = useState("");
  const queryClient = useQueryClient();
  const createMutation = useCreateCustomRestaurant();

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert("Add a restaurant", "Please enter a restaurant name.");
      return;
    }
    createMutation.mutate(
      {
        data: {
          name: trimmed,
          ...(cuisine.trim() ? { cuisine: cuisine.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
          setName("");
          setCuisine("");
          setLocation("");
          setOpen(false);
          Alert.alert("Added!", `${trimmed} is now in your dining guide with healthy picks.`);
        },
        onError: (err) => {
          const { status, data } = err as { status?: number; data?: { error?: string } | null };
          const message =
            status === 409
              ? "That restaurant is already in your list."
              : status === 422
                ? "That doesn't look like a restaurant name — try again."
                : status === 429
                  ? (data?.error ??
                    "You've hit today's limit for adding restaurants — try again tomorrow.")
                  : "Couldn't add that restaurant. Please try again.";
          Alert.alert("Add a restaurant", message);
        },
      },
    );
  };

  return (
    <Card style={{ marginTop: 14 }}>
      {open ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground }}>
            Add a restaurant
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Tell us where you like to eat and we'll look up their real menu online, then add
            healthy picks — just for you. Only you can see restaurants you add.
          </Text>
          <LuxeInput
            placeholder="Restaurant name (e.g. Casa Grande)"
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!createMutation.isPending}
          />
          <LuxeInput
            placeholder="Type of food (optional, e.g. Mexican)"
            value={cuisine}
            onChangeText={setCuisine}
            maxLength={40}
            editable={!createMutation.isPending}
          />
          <LuxeInput
            placeholder="City or area (optional, e.g. Huntington WV)"
            value={location}
            onChangeText={setLocation}
            maxLength={80}
            editable={!createMutation.isPending}
          />
          {createMutation.isPending ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              Finding the real menu and picking healthy options — this can take up to a minute...
            </Text>
          ) : null}
          <LuxeButton
            label={createMutation.isPending ? "Building menu..." : "Add restaurant"}
            icon="plus"
            onPress={submit}
            loading={createMutation.isPending}
          />
          {!createMutation.isPending ? (
            <LuxeButton label="Cancel" variant="ghost" small onPress={() => setOpen(false)} />
          ) : null}
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
            Dish names come from the restaurant's menu when we can find it online. Nutrition is
            always an AI estimate — actual values vary by location and portion.
          </Text>
        </View>
      ) : (
        <LuxeButton label="Add a restaurant" icon="plus" variant="outline" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteCustomRestaurant();

  const removeRestaurant = () => {
    Alert.alert("Remove restaurant", `Remove ${restaurant.name} from your list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          deleteMutation.mutate(
            { id: restaurant.id },
            {
              onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: getListRestaurantsQueryKey() });
              },
              onError: () => Alert.alert("Remove restaurant", "Couldn't remove it. Please try again."),
            },
          ),
      },
    ]);
  };

  return (
    <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ padding: 16, flexDirection: "row", alignItems: "center" }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                color: c.accentForeground,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {restaurant.cuisine}
            </Text>
            {restaurant.isMine ? (
              <View
                style={{
                  backgroundColor: c.secondary,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: c.foreground }}>
                  YOURS
                </Text>
              </View>
            ) : null}
          </View>
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
      {expanded ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
          <LuxeButton
            label="Order on DoorDash"
            icon="external-link"
            variant="outline"
            small
            onPress={() => openDoorDash(restaurant.name)}
          />
          {restaurant.isMine ? (
            <>
              {restaurant.menuSource ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
                  Dish names from {restaurant.menuSource}
                </Text>
              ) : null}
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
                Nutrition values are AI estimates — actual items vary by location.
              </Text>
              <LuxeButton
                label="Remove from my list"
                icon="trash-2"
                variant="ghost"
                small
                onPress={removeRestaurant}
                loading={deleteMutation.isPending}
              />
            </>
          ) : null}
        </View>
      ) : null}
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
  const [open, setOpen] = useState(false);
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
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}
      >
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={c.tint} />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.tint }}>
          Nutrition Facts
        </Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10 }}>
          <NutritionFactsLabel
            values={{
              calories: item.calories,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              satFatG: item.satFatG,
              fiberG: item.fiberG,
              sugarG: item.sugarG,
              sodiumMg: item.sodiumMg,
              cholesterolMg: item.cholesterolMg,
            }}
          />
        </View>
      ) : null}
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
