import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LuxeButton } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { HowToVideoPlayer } from "./HowToVideoPlayer";

/** YouTube search fallback for a proper-form demo of the given exercise. */
function searchUrl(exerciseName: string): string {
  const query = encodeURIComponent(`how to ${exerciseName} proper form technique`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * "Watch how-to" affordance for an exercise.
 *
 * With a curated `videoId` it opens an in-app embedded player; the YouTube
 * search link is always available beneath the player, and is used directly
 * when no curated video exists.
 *
 * `variant="button"` renders a pill button (library list); `variant="link"`
 * renders a compact inline link (inside a workout).
 */
export function HowToVideo({
  exerciseName,
  videoId,
  variant = "button",
}: {
  exerciseName: string;
  videoId?: string | null;
  variant?: "button" | "link";
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const openSearch = () => void Linking.openURL(searchUrl(exerciseName));
  const onPress = () => (videoId ? setOpen(true) : openSearch());

  return (
    <>
      {variant === "link" ? (
        <Pressable
          onPress={onPress}
          hitSlop={6}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Feather name="play-circle" size={13} color={c.accent} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.accent }}>
            Watch how-to
          </Text>
        </Pressable>
      ) : (
        <LuxeButton
          label="Watch how-to"
          small
          variant="outline"
          icon="play-circle"
          onPress={onPress}
        />
      )}

      {videoId ? (
        <Modal
          visible={open}
          animationType="slide"
          transparent
          onRequestClose={() => setOpen(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.75)",
              justifyContent: "center",
              paddingHorizontal: 16,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ backgroundColor: c.background, borderRadius: 20, overflow: "hidden" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: "PlayfairDisplay_600SemiBold",
                    fontSize: 17,
                    color: c.foreground,
                  }}
                >
                  {exerciseName}
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                  <Feather name="x" size={22} color={c.mutedForeground} />
                </Pressable>
              </View>
              <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}>
                {open ? (
                  <HowToVideoPlayer videoId={videoId} title={`${exerciseName} how-to video`} />
                ) : null}
              </View>
              <Pressable
                onPress={openSearch}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <Feather name="external-link" size={14} color={c.mutedForeground} />
                <Text
                  style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}
                >
                  More how-to videos on YouTube
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
