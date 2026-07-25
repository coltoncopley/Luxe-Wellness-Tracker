import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Switch, Text, View, TextInput } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getGetRoutineQueryKey,
  useGetRoutine,
  useUpdateRoutine,
  useUpdateRoutineCheckin,
} from "@workspace/api-client-react";

import { Card, LuxeButton, SectionTitle, StackScreen } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function RoutineScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const routine = useGetRoutine();
  const updateRoutine = useUpdateRoutine();
  const updateCheckin = useUpdateRoutineCheckin();

  const data = routine.data;
  const amList = data?.items.filter((i) => i.period === "am") || [];
  const pmList = data?.items.filter((i) => i.period === "pm") || [];
  const amDone = data?.today.amDone || false;
  const pmDone = data?.today.pmDone || false;
  const sunscreenUsed = data?.today.sunscreenUsed || false;
  const photoDue = data?.photoDue || false;

  const [amEdit, setAmEdit] = useState(false);
  const [pmEdit, setPmEdit] = useState(false);
  type DraftItem = { id?: number; productName: string; ingredientScanId?: number | null };
  const [amDraft, setAmDraft] = useState<DraftItem[]>([]);
  const [pmDraft, setPmDraft] = useState<DraftItem[]>([]);

  const startAmEdit = () => {
    setAmDraft(
      amList.map((i) => ({ id: i.id, productName: i.productName, ingredientScanId: i.ingredientScanId })),
    );
    setAmEdit(true);
  };
  const startPmEdit = () => {
    setPmDraft(
      pmList.map((i) => ({ id: i.id, productName: i.productName, ingredientScanId: i.ingredientScanId })),
    );
    setPmEdit(true);
  };

  const toInput = (items: DraftItem[]) =>
    items
      .filter((i) => i.productName.trim().length > 0)
      .map((i) => ({ productName: i.productName.trim(), ingredientScanId: i.ingredientScanId ?? null }));

  const saveAmEdit = () => {
    updateRoutine.mutate(
      {
        data: {
          am: toInput(amDraft),
          pm: pmList.map((i) => ({ productName: i.productName, ingredientScanId: i.ingredientScanId })),
        },
      },
      {
        onSuccess: () => {
          setAmEdit(false);
          void queryClient.invalidateQueries({ queryKey: getGetRoutineQueryKey() });
        },
      }
    );
  };

  const savePmEdit = () => {
    updateRoutine.mutate(
      {
        data: {
          am: amList.map((i) => ({ productName: i.productName, ingredientScanId: i.ingredientScanId })),
          pm: toInput(pmDraft),
        },
      },
      {
        onSuccess: () => {
          setPmEdit(false);
          void queryClient.invalidateQueries({ queryKey: getGetRoutineQueryKey() });
        },
      }
    );
  };

  const toggleCheckin = (field: "amDone" | "pmDone" | "sunscreenUsed", current: boolean) => {
    updateCheckin.mutate(
      { data: { [field]: !current } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetRoutineQueryKey() });
        },
      }
    );
  };

  return (
    <StackScreen refreshing={routine.isRefetching} onRefresh={() => void routine.refetch()}>
      {photoDue && (
        <Pressable
          onPress={() => router.push("/explore/photos")}
          style={{ backgroundColor: c.accent, padding: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}
        >
          <Feather name="camera" size={20} color={c.accentForeground} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.accentForeground }}>Time for a progress photo</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.accentForeground }}>It's been a while since your last one.</Text>
          </View>
        </Pressable>
      )}

      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginBottom: 16 }}>
        Checking off your morning or evening routine automatically completes your Glow skincare habit.
      </Text>

      <SectionTitle>Morning Routine</SectionTitle>
      <Card style={{ marginBottom: 24 }}>
        {!amEdit ? (
          <View>
            {amList.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, paddingBottom: 16 }}>No products added yet.</Text>
            ) : (
              <View style={{ gap: 12, marginBottom: 16 }}>
                {amList.map((item, i) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: i < amList.length - 1 ? 12 : 0, borderBottomWidth: i < amList.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.mutedForeground }}>{i + 1}</Text>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: c.foreground }}>{item.productName}</Text>
                  </View>
                ))}
              </View>
            )}
            <LuxeButton label="Edit AM Routine" variant="outline" small onPress={startAmEdit} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>Morning done</Text>
              <Switch
                value={amDone}
                onValueChange={() => toggleCheckin("amDone", amDone)}
                trackColor={{ true: c.accent, false: c.secondary }}
                thumbColor={c.switchThumb}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>SPF applied</Text>
              <Switch
                value={sunscreenUsed}
                onValueChange={() => toggleCheckin("sunscreenUsed", sunscreenUsed)}
                trackColor={{ true: c.accent, false: c.secondary }}
                thumbColor={c.switchThumb}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {amDraft.map((item, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={item.productName}
                  onChangeText={(val) => {
                    const next = [...amDraft];
                    next[idx].productName = val;
                    setAmDraft(next);
                  }}
                  placeholder="Product name"
                  placeholderTextColor={c.mutedForeground}
                  style={{ flex: 1, backgroundColor: c.secondary, borderRadius: 8, padding: 12, color: c.foreground, fontFamily: "Inter_400Regular" }}
                />
                <Pressable onPress={() => setAmDraft(amDraft.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                  <Feather name="trash-2" size={18} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
            {amDraft.length < 10 && (
              <Pressable onPress={() => setAmDraft([...amDraft, { productName: "" }])} style={{ paddingVertical: 8 }}>
                <Text style={{ fontFamily: "Inter_500Medium", color: c.primary }}>+ Add product</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}><LuxeButton label="Save" onPress={saveAmEdit} loading={updateRoutine.isPending} small /></View>
              <View style={{ flex: 1 }}><LuxeButton label="Cancel" variant="outline" onPress={() => setAmEdit(false)} small /></View>
            </View>
          </View>
        )}
      </Card>

      <SectionTitle>Evening Routine</SectionTitle>
      <Card style={{ marginBottom: 24 }}>
        {!pmEdit ? (
          <View>
            {pmList.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, paddingBottom: 16 }}>No products added yet.</Text>
            ) : (
              <View style={{ gap: 12, marginBottom: 16 }}>
                {pmList.map((item, i) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: i < pmList.length - 1 ? 12 : 0, borderBottomWidth: i < pmList.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.mutedForeground }}>{i + 1}</Text>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: c.foreground }}>{item.productName}</Text>
                  </View>
                ))}
              </View>
            )}
            <LuxeButton label="Edit PM Routine" variant="outline" small onPress={startPmEdit} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>Evening done</Text>
              <Switch
                value={pmDone}
                onValueChange={() => toggleCheckin("pmDone", pmDone)}
                trackColor={{ true: c.accent, false: c.secondary }}
                thumbColor={c.switchThumb}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {pmDraft.map((item, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={item.productName}
                  onChangeText={(val) => {
                    const next = [...pmDraft];
                    next[idx].productName = val;
                    setPmDraft(next);
                  }}
                  placeholder="Product name"
                  placeholderTextColor={c.mutedForeground}
                  style={{ flex: 1, backgroundColor: c.secondary, borderRadius: 8, padding: 12, color: c.foreground, fontFamily: "Inter_400Regular" }}
                />
                <Pressable onPress={() => setPmDraft(pmDraft.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                  <Feather name="trash-2" size={18} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
            {pmDraft.length < 10 && (
              <Pressable onPress={() => setPmDraft([...pmDraft, { productName: "" }])} style={{ paddingVertical: 8 }}>
                <Text style={{ fontFamily: "Inter_500Medium", color: c.primary }}>+ Add product</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}><LuxeButton label="Save" onPress={savePmEdit} loading={updateRoutine.isPending} small /></View>
              <View style={{ flex: 1 }}><LuxeButton label="Cancel" variant="outline" onPress={() => setPmEdit(false)} small /></View>
            </View>
          </View>
        )}
      </Card>
    </StackScreen>
  );
}
