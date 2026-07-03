import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getListAppointmentsQueryKey,
  useCreateAppointment,
  useDeleteAppointment,
  useListAppointments,
  useListServices,
  useListStaff,
} from "@workspace/api-client-react";

import { Card, Chip, EmptyState, LuxeButton, LuxeInput, Screen, SectionTitle } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { BOOKING_URL, fmtDate } from "@/lib/luxe";

export default function BookScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const services = useListServices();
  const staff = useListStaff();
  const appointments = useListAppointments();
  const createAppointment = useCreateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const [category, setCategory] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [apptService, setApptService] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const set = new Set((services.data ?? []).map((s) => s.category));
    return Array.from(set);
  }, [services.data]);

  const visibleServices = (services.data ?? []).filter(
    (s) => category == null || s.category === category,
  );

  const openBooking = (url?: string) => {
    void WebBrowser.openBrowserAsync(url || BOOKING_URL);
  };

  const invalidateAppts = () => {
    void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
  };

  const handleAddAppt = () => {
    if (!apptService.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(apptDate.trim())) {
      Alert.alert("Check the details", "Enter a service name and a date like 2026-07-15.");
      return;
    }
    createAppointment.mutate(
      {
        data: {
          serviceName: apptService.trim(),
          date: apptDate.trim(),
          ...(apptTime.trim() ? { time: apptTime.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setApptService("");
          setApptDate("");
          setApptTime("");
          invalidateAppts();
        },
      },
    );
  };

  const upcoming = (appointments.data ?? []).filter((a) => a.status !== "cancelled");

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <Screen
      title="Book"
      subtitle="Treatments & appointments"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Card style={{ backgroundColor: c.primary, borderColor: c.primary }}>
        <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: c.primaryForeground }}>
          Ready for your next visit?
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: c.primaryForeground,
            opacity: 0.75,
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          Booking opens LUXE's secure online scheduler.
        </Text>
        <LuxeButton label="Book an appointment" icon="external-link" onPress={() => openBooking()} />
      </Card>

      <SectionTitle>My appointments</SectionTitle>
      {upcoming.length === 0 ? (
        <Card>
          <EmptyState icon="calendar" text="No appointments tracked yet. Add one so Luxe AI can help you prepare." />
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {upcoming.map((a, i) => (
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
                  {a.serviceName}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {fmtDate(a.date)}
                  {a.time ? ` · ${a.time}` : ""}
                  {a.providerName ? ` · ${a.providerName}` : ""}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert("Remove appointment?", `Remove "${a.serviceName}" from your list?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        deleteAppointment.mutate({ id: a.id }, { onSuccess: invalidateAppts }),
                    },
                  ])
                }
              >
                <Feather name="trash-2" size={16} color={c.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {showAdd ? (
        <Card style={{ gap: 10, marginTop: 10 }}>
          <LuxeInput placeholder="Service (e.g. Botox touch-up)" value={apptService} onChangeText={setApptService} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <LuxeInput
              placeholder="Date (YYYY-MM-DD)"
              value={apptDate}
              onChangeText={setApptDate}
              autoCapitalize="none"
              style={{ flex: 1 }}
            />
            <LuxeInput placeholder="Time (optional)" value={apptTime} onChangeText={setApptTime} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <LuxeButton label="Cancel" variant="outline" onPress={() => setShowAdd(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <LuxeButton label="Save" onPress={handleAddAppt} loading={createAppointment.isPending} />
            </View>
          </View>
        </Card>
      ) : (
        <View style={{ marginTop: 10 }}>
          <LuxeButton label="Track an appointment" variant="outline" icon="plus" onPress={() => setShowAdd(true)} />
        </View>
      )}

      <SectionTitle>Services</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Chip label="All" active={category == null} onPress={() => setCategory(null)} />
        {categories.map((cat) => (
          <Chip key={cat} label={cat} active={category === cat} onPress={() => setCategory(cat)} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {visibleServices.map((s) => (
          <Card key={s.id}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                  {s.name}
                </Text>
                <Text
                  style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 3 }}
                  numberOfLines={2}
                >
                  {s.description}
                </Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.tint, marginTop: 5 }}>
                  {[s.priceText, s.durationMinutes ? `${s.durationMinutes} min` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <LuxeButton label="Book" small onPress={() => openBooking(s.bookingUrl)} />
            </View>
          </Card>
        ))}
      </View>

      <SectionTitle>Meet the team</SectionTitle>
      <View style={{ gap: 10 }}>
        {(staff.data ?? []).map((m) => (
          <Card key={m.id}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {m.photoUrl ? (
                <Image source={{ uri: m.photoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: c.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="user" size={22} color={c.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
                  {m.name}
                </Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.tint, marginTop: 1 }}>
                  {m.title}
                </Text>
                <Text
                  style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 4 }}
                  numberOfLines={3}
                >
                  {m.bio}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
