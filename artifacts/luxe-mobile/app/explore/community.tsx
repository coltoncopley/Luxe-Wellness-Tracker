import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CommunityPost, CreateCommunityPostInputCategory } from "@workspace/api-client-react";
import type { Challenge } from "@workspace/api-client-react";
import {
  getGetChallengesQueryKey,
  getGetCommunityPostsQueryKey,
  getGetRewardsSummaryQueryKey,
  useCreateCommunityPost,
  useDeleteCommunityPost,
  useGetChallenges,
  useGetCommunityPosts,
  useJoinChallenge,
  useToggleCommunityHeart,
} from "@workspace/api-client-react";

import {
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  StackScreen,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { timeAgo } from "@/lib/luxe";

const CATEGORIES: { value: CreateCommunityPostInputCategory; label: string; emoji: string }[] = [
  { value: "weight_loss", label: "Weight loss win", emoji: "🎉" },
  { value: "glow", label: "Glow journey", emoji: "✨" },
  { value: "skin", label: "Skin progress", emoji: "🌸" },
  { value: "recipe", label: "Healthy recipe", emoji: "🥗" },
  { value: "motivation", label: "Motivation", emoji: "💪" },
  { value: "other", label: "Other", emoji: "💬" },
];

function categoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function CommunityScreen() {
  const c = useColors();
  const queryClient = useQueryClient();
  const posts = useGetCommunityPosts();

  const [shareOpen, setShareOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggleHeart = useToggleCommunityHeart();
  const deletePost = useDeleteCommunityPost();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });

  const onRefresh = async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  };

  const confirmDelete = (id: number) => {
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deletePost.mutate(
            { id },
            {
              onSuccess: () => invalidate(),
              onError: () => Alert.alert("Couldn't delete", "Please try again."),
            },
          ),
      },
    ]);
  };

  if (posts.isLoading) return <LoadingView />;
  if (posts.isError)
    return <ErrorView message="Couldn't load the wins wall." onRetry={() => posts.refetch()} />;

  const list = posts.data?.posts ?? [];

  return (
    <StackScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginBottom: 12 }}>
        Anonymous wins from LUXE members. Cheer each other on — no names, ever.
      </Text>

      <LuxeButton label="Share a win" icon="plus" onPress={() => setShareOpen(true)} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: c.secondary,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <Feather name="lock" size={14} color={c.mutedForeground} />
        <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
          Every post is anonymous. Your name is never shown to other members or staff.
        </Text>
      </View>

      <ChallengesSection />

      {list.length === 0 ? (
        <Card style={{ marginTop: 8 }}>
          <EmptyState
            icon="award"
            text="No wins shared yet. Be the first to inspire the LUXE community — share a victory from your wellness journey, big or small."
          />
        </Card>
      ) : (
        <View style={{ gap: 12, marginTop: 8 }}>
          {list.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onToggleHeart={() =>
                toggleHeart.mutate(
                  { id: post.id },
                  {
                    onSuccess: () => invalidate(),
                    onError: () => Alert.alert("Couldn't react", "Please try again."),
                  },
                )
              }
              onDelete={() => confirmDelete(post.id)}
            />
          ))}
        </View>
      )}

      <ShareModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={() => {
          setShareOpen(false);
          void invalidate();
          void queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
        }}
      />
    </StackScreen>
  );
}

const METRIC_UNITS: Record<string, string> = {
  log_days: "days",
  meals: "meals",
  glow_checkins: "check-ins",
  weigh_ins: "weigh-ins",
  active_minutes: "minutes",
};

function monthName(month: string): string {
  return new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long" });
}

function ChallengesSection() {
  const c = useColors();
  const queryClient = useQueryClient();
  const challengesQuery = useGetChallenges();
  const joinChallenge = useJoinChallenge();
  const challenges = challengesQuery.data?.challenges ?? [];
  if (challengesQuery.isLoading || challenges.length === 0) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const join = (ch: Challenge) => {
    joinChallenge.mutate(
      { id: ch.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetChallengesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
          Alert.alert("You're in!", `Good luck with ${ch.title}.`);
        },
        onError: () => Alert.alert("Couldn't join", "Please try again."),
      },
    );
  };

  return (
    <View style={{ gap: 12, marginBottom: 8 }}>
      {challenges.map((ch) => {
        const isCurrent = ch.month === currentMonth;
        const isUpcoming = ch.month > currentMonth;
        const unit = METRIC_UNITS[ch.metric] ?? "";
        const pct =
          ch.target > 0 ? Math.min(100, Math.round((ch.progress / ch.target) * 100)) : 0;
        return (
          <Card key={ch.id} style={{ gap: 10, borderColor: ch.completed ? c.accent : c.border, borderWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Feather name="award" size={16} color={c.tint} />
                <Text
                  style={{
                    fontFamily: "PlayfairDisplay_600SemiBold",
                    fontSize: 16,
                    color: c.foreground,
                    flexShrink: 1,
                  }}
                >
                  {ch.title}
                </Text>
              </View>
              <View style={{ backgroundColor: c.secondary, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: c.secondaryForeground }}>
                  {isUpcoming ? `Coming in ${monthName(ch.month)}` : monthName(ch.month)}
                </Text>
              </View>
            </View>

            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, color: c.mutedForeground }}>
              {ch.description}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="users" size={12} color={c.mutedForeground} />
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  {ch.participantCount} joined
                </Text>
              </View>
              {ch.completedCount > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="check-circle" size={12} color={c.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                    {ch.completedCount} completed
                  </Text>
                </View>
              ) : null}
              <Text style={{ marginLeft: "auto", fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.tint }}>
                +{ch.points} pts
              </Text>
            </View>

            {ch.completed ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: c.secondary,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Feather name="check-circle" size={15} color={c.success} />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>
                  Challenge complete — {ch.points} points earned!
                </Text>
              </View>
            ) : ch.joined ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                    Your progress (only you can see this)
                  </Text>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.foreground }}>
                    {ch.progress}/{ch.target} {unit}
                  </Text>
                </View>
                <View style={{ height: 8, backgroundColor: c.secondary, borderRadius: 999, overflow: "hidden" }}>
                  <View style={{ width: `${pct}%`, height: "100%", backgroundColor: c.tint, borderRadius: 999 }} />
                </View>
              </View>
            ) : isCurrent ? (
              <LuxeButton
                label={joinChallenge.isPending ? "Joining…" : "Join this month's challenge"}
                disabled={joinChallenge.isPending}
                onPress={() => join(ch)}
              />
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                Joins open on the 1st — get ready!
              </Text>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function PostCard({
  post,
  onToggleHeart,
  onDelete,
}: {
  post: CommunityPost;
  onToggleHeart: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const cat = categoryInfo(post.category);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
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
            <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            {post.mine ? "You (anonymous to others)" : "A LUXE member"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: c.secondary, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: c.secondaryForeground }}>
              {cat.label}
            </Text>
          </View>
          {post.mine ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Feather name="trash-2" size={16} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, color: c.foreground }}>
        {post.body}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={onToggleHeart}
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: post.heartedByMe ? c.accent : c.border,
            backgroundColor: post.heartedByMe ? c.accent : "transparent",
            borderRadius: 999,
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}
        >
          <Feather name="heart" size={14} color={post.heartedByMe ? "#0F1729" : c.mutedForeground} />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: post.heartedByMe ? "#0F1729" : c.mutedForeground,
            }}
          >
            {post.heartCount > 0 ? post.heartCount : "Cheer"}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground }}>
          {timeAgo(post.createdAt)}
        </Text>
      </View>
    </Card>
  );
}

function ShareModal({
  visible,
  onClose,
  onShared,
}: {
  visible: boolean;
  onClose: () => void;
  onShared: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CreateCommunityPostInputCategory>("weight_loss");
  const [body, setBody] = useState("");

  const createPost = useCreateCommunityPost();

  const submit = () => {
    const trimmed = body.trim();
    if (trimmed.length < 10) {
      Alert.alert("Share a little more", "Please write at least 10 characters.");
      return;
    }
    createPost.mutate(
      { data: { category, body: trimmed } },
      {
        onSuccess: () => {
          setBody("");
          setCategory("weight_loss");
          onShared();
          Alert.alert("Shared", "Thank you for inspiring others!");
        },
        onError: (err) => {
          if ((err as { status?: number })?.status === 429) {
            Alert.alert("Daily limit reached", "You can share up to 3 wins a day — come back tomorrow!");
          } else {
            Alert.alert("Couldn't share", "Please try again.");
          }
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: insets.bottom + 20,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: c.foreground }}>
              Share a win
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Posts are anonymous — your name is never shown to other members or the LUXE team.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  style={{
                    backgroundColor: active ? c.accent : c.secondary,
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                      fontSize: 13,
                      color: active ? "#0F1729" : c.secondaryForeground,
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 4 }}>
            <LuxeInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, 500))}
              placeholder="Down 12 lbs since starting my journey — the food tracker made all the difference!"
              multiline
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, textAlign: "right" }}>
              {body.length}/500
            </Text>
          </View>

          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
            Please keep it kind and supportive. Don't include your name or personal details — posts
            everyone can see should stay anonymous. You can share up to 3 wins a day.
          </Text>

          <LuxeButton
            label={createPost.isPending ? "Sharing…" : "Share anonymously"}
            disabled={createPost.isPending}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
