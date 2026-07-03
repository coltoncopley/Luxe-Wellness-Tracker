import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import {
  getListProgressPhotosQueryKey,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
  useListProgressPhotos,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import type { ProgressPhoto } from "@workspace/api-client-react";

import {
  Card,
  Chip,
  EmptyState,
  ErrorView,
  LuxeButton,
  LuxeInput,
  SectionTitle,
  Segmented,
  StackScreen,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { apiUrl, fmtDate, pickImageAsset, todayStr } from "@/lib/luxe";

type Category = "weight" | "skin";
type Filter = "all" | Category;

export default function PhotosScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const photos = useListProgressPhotos();
  const requestUrl = useRequestUploadUrl();
  const createPhoto = useCreateProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();

  const [category, setCategory] = useState<Category>("weight");
  const [takenOn, setTakenOn] = useState(todayStr());
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListProgressPhotosQueryKey() });

  function imageSource(objectPath: string) {
    const uri = apiUrl(`/storage${objectPath}`);
    return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
  }

  async function upload(source: "camera" | "library") {
    setUploading(true);
    try {
      const asset = await pickImageAsset(source);
      if (!asset) return;
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      const { uploadURL, objectPath } = await requestUrl.mutateAsync({
        data: {
          name: asset.fileName || "photo.jpg",
          size: blob.size || 1,
          contentType: "image/jpeg",
        },
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      await createPhoto.mutateAsync({
        data: {
          objectPath,
          takenOn,
          category,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      await invalidate();
      setNote("");
      Alert.alert("Saved", "Photo added to your private journal.");
    } catch (err) {
      Alert.alert(
        "Couldn't save photo",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleAdd() {
    if (uploading) return;
    Alert.alert("Add photo", undefined, [
      { text: "Take photo", onPress: () => void upload("camera") },
      { text: "Choose from library", onPress: () => void upload("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleDelete(id: number) {
    Alert.alert("Delete photo?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePhoto.mutate(
            { id },
            {
              onSuccess: () => {
                setCompareIds((prev) => prev.filter((x) => x !== id));
                setViewId(null);
                void invalidate();
              },
            },
          );
        },
      },
    ]);
  }

  function toggleCompare(id: number) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  }

  const all = photos.data ?? [];
  const filtered = all.filter((p) => filter === "all" || p.category === filter);
  const comparePhotos = [...all.filter((p) => compareIds.includes(p.id))].sort((a, b) =>
    a.takenOn.localeCompare(b.takenOn),
  );
  const viewed = all.find((p) => p.id === viewId) ?? null;

  const label = (p: ProgressPhoto) =>
    `${fmtDate(p.takenOn)} · ${p.category === "weight" ? "Body" : "Skin"}${
      p.note ? ` · ${p.note}` : ""
    }`;

  return (
    <StackScreen
      refreshing={photos.isRefetching}
      onRefresh={() => void photos.refetch()}
    >
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
        A private before &amp; after journal for your journey.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
        <Feather name="lock" size={13} color={c.mutedForeground} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, flex: 1 }}>
          Only you can see these photos — never LUXE staff.
        </Text>
      </View>

      <SectionTitle>Add a photo</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Segmented
          options={[
            { key: "weight", label: "Body" },
            { key: "skin", label: "Skin" },
          ]}
          value={category}
          onChange={(k) => setCategory(k as Category)}
        />
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground }}>
            Date taken
          </Text>
          <LuxeInput
            value={takenOn}
            onChangeText={setTakenOn}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>
        <LuxeInput
          placeholder="Note (optional) — e.g. Week 4"
          value={note}
          maxLength={500}
          onChangeText={setNote}
        />
        <LuxeButton
          label={uploading ? "Saving…" : "Add photo"}
          icon="camera"
          onPress={handleAdd}
          loading={uploading}
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)}
        />
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 20, marginBottom: 4 }}>
        {(["all", "weight", "skin"] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={f === "all" ? "All" : f === "weight" ? "Body" : "Skin"}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {compareIds.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <LuxeButton
              label={`Compare ${compareIds.length}/2`}
              icon="columns"
              variant="outline"
              small
              onPress={() => setCompareOpen(true)}
              disabled={compareIds.length !== 2}
            />
          </View>
          <LuxeButton label="Clear" variant="ghost" small onPress={() => setCompareIds([])} />
        </View>
      ) : null}

      {photos.isLoading ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState icon="loader" text="Loading photos…" />
        </Card>
      ) : photos.isError ? (
        <ErrorView message="Couldn't load your photos." onRetry={() => photos.refetch()} />
      ) : filtered.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            icon="camera"
            text="No photos yet. Add your first one — future you will thank you."
          />
        </Card>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          {filtered.map((p) => {
            const selected = compareIds.includes(p.id);
            return (
              <View key={p.id} style={{ width: "47%", flexGrow: 1 }}>
                <Pressable
                  onPress={() => setViewId(p.id)}
                  style={{
                    borderRadius: c.radius,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: selected ? c.accent : "transparent",
                  }}
                >
                  <Image
                    source={imageSource(p.objectPath)}
                    style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: c.secondary }}
                    contentFit="cover"
                  />
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                      color: c.mutedForeground,
                    }}
                  >
                    {label(p)}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => toggleCompare(p.id)}>
                    <Feather
                      name={selected ? "check-square" : "square"}
                      size={16}
                      color={selected ? c.accent : c.mutedForeground}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={viewId !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setViewId(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: 20 }}>
          {viewed ? (
            <>
              <Image
                source={imageSource(viewed.objectPath)}
                style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: c.radius }}
                contentFit="contain"
              />
              <Text
                style={{
                  color: c.overlayForeground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 14,
                }}
              >
                {label(viewed)}
              </Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <LuxeButton
                    label="Delete"
                    icon="trash-2"
                    variant="destructive"
                    onPress={() => handleDelete(viewed.id)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <LuxeButton label="Close" variant="outline" onPress={() => setViewId(null)} />
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={compareOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCompareOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: 16 }}>
          <Text
            style={{
              color: c.overlayForeground,
              fontFamily: "PlayfairDisplay_600SemiBold",
              fontSize: 22,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Before &amp; after
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {comparePhotos.map((p) => (
              <View key={p.id} style={{ flex: 1 }}>
                <Image
                  source={imageSource(p.objectPath)}
                  style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: c.radius }}
                  contentFit="cover"
                />
                <Text
                  style={{
                    color: c.overlayForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  {label(p)}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 20 }}>
            <LuxeButton label="Close" variant="outline" onPress={() => setCompareOpen(false)} />
          </View>
        </View>
      </Modal>

      {Platform.OS === "web" ? <View style={{ height: 34 }} /> : null}
    </StackScreen>
  );
}
