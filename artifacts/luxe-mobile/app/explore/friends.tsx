import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Contacts from "expo-contacts";
import React, { useState } from "react";
import { Linking, Modal, Platform, Pressable, Share, Switch, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FollowEntry, FriendJourney } from "@workspace/api-client-react";
import {
  getGetCheersQueryKey,
  getGetFollowsQueryKey,
  getGetFriendJourneysQueryKey,
  getGetSharingSettingsQueryKey,
  useGetCheers,
  useGetFollows,
  useGetFriendJourneys,
  useGetReferralSummary,
  useGetSharingSettings,
  useRemoveFollow,
  useRequestFollow,
  useRespondToFollow,
  useSendCheer,
  useUpdateSharingSettings,
} from "@workspace/api-client-react";

import {
  Card,
  ErrorView,
  LoadingView,
  LuxeButton,
  LuxeInput,
  SectionTitle,
  StackScreen,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { timeAgo, webUrl } from "@/lib/luxe";

const CHEER_EMOJIS = ["👏", "💪", "🎉", "❤️", "🔥", "🌟"];

function InviteFriendsCard() {
  const c = useColors();
  const referral = useGetReferralSummary();
  const [busy, setBusy] = useState(false);

  const code = referral.data?.code;

  const inviteMessage = () => {
    const link = webUrl(code ? `/?ref=${code}` : "/");
    return `Join me on LUXE Wellness & Aesthetics! Sign up here: ${link}${
      code ? " — use my invite link and we both earn rewards points." : ""
    }`;
  };

  const shareInvite = async () => {
    const message = inviteMessage();
    try {
      await Share.share({ message });
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        Alert.alert(
          "Invite copied",
          "Sharing isn't available here, so your invite was copied instead — paste it into a text or email."
        );
      } catch {
        Alert.alert("Couldn't share", "Something went wrong — please try again.");
      }
    }
  };

  const inviteFromContacts = async () => {
    if (busy) return;
    if (Platform.OS === "web") {
      await shareInvite();
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS !== "ios") {
        const perm = await Contacts.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Contacts access needed",
            "Allow contacts access in Settings to invite friends directly, or use Share invite instead."
          );
          return;
        }
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const rawPhone = contact.phoneNumbers?.find((p) => p.number)?.number;
      const phone = rawPhone?.replace(/[^+\d]/g, "");
      if (phone) {
        const sep = Platform.OS === "ios" ? "&" : "?";
        await Linking.openURL(`sms:${phone}${sep}body=${encodeURIComponent(inviteMessage())}`);
      } else {
        await shareInvite();
      }
    } catch {
      Alert.alert("Couldn't open contacts", "Please try again, or use Share invite instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Invite friends</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
          Know someone who'd love LUXE? Send them an invite to download the app — when they join
          with your link, you both earn rewards points.
        </Text>
        {code ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Your invite code:{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: c.primary, letterSpacing: 1 }}>
              {code}
            </Text>
          </Text>
        ) : null}
        <LuxeButton
          label={busy ? "Opening contacts…" : "Invite from contacts"}
          icon="users"
          disabled={busy}
          onPress={() => void inviteFromContacts()}
        />
        <LuxeButton
          label="Share invite link"
          icon="share-2"
          variant="outline"
          onPress={() => void shareInvite()}
        />
      </Card>
    </>
  );
}

const REQUEST_ERRORS: Record<string, string> = {
  invalid_code: "We couldn't find anyone with that code — double-check it with your friend.",
  own_code: "That's your own code! Share it with a friend instead.",
  already_following: "You're already following this friend.",
  already_requested:
    "You've already sent this friend a request — they just need to accept it.",
};

export default function FriendsScreen() {
  const c = useColors();
  const queryClient = useQueryClient();

  const follows = useGetFollows();
  const journeysQuery = useGetFriendJourneys();
  const cheersQuery = useGetCheers();

  const [code, setCode] = useState("");
  const [cheerTarget, setCheerTarget] = useState<FriendJourney | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const invalidateFollows = () => {
    void queryClient.invalidateQueries({ queryKey: getGetFollowsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetFriendJourneysQueryKey() });
  };

  const requestFollow = useRequestFollow({
    mutation: {
      onSuccess: (result) => {
        if (result.requested) {
          setCode("");
          invalidateFollows();
          Alert.alert("Request sent", "Your friend will need to approve it.");
        } else {
          Alert.alert(
            "Couldn't send request",
            REQUEST_ERRORS[result.reason ?? ""] ?? "Couldn't send that request.",
          );
        }
      },
      onError: () => Alert.alert("Something went wrong", "Please try again."),
    },
  });

  const respond = useRespondToFollow({
    mutation: {
      onSuccess: (result) => {
        invalidateFollows();
        Alert.alert(
          result.status === "accepted" ? "Request accepted" : "Request declined",
          "",
        );
      },
      onError: () => Alert.alert("Couldn't update", "Please try again."),
    },
  });

  const remove = useRemoveFollow({
    mutation: {
      onSuccess: () => invalidateFollows(),
      onError: () => Alert.alert("Couldn't remove", "Please try again."),
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetFollowsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetFriendJourneysQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCheersQueryKey() }),
    ]);
    setRefreshing(false);
  };

  const confirmRemove = (entry: FollowEntry, label: string) => {
    Alert.alert(`${label} ${entry.name}?`, "", [
      { text: "Cancel", style: "cancel" },
      { text: label, style: "destructive", onPress: () => remove.mutate({ id: entry.id }) },
    ]);
  };

  if (follows.isLoading) return <LoadingView />;
  if (follows.isError) {
    return (
      <ErrorView message="Couldn't load your friends." onRetry={() => follows.refetch()} />
    );
  }

  const data = follows.data;
  const journeys = journeysQuery.data?.journeys ?? [];
  const cheers = cheersQuery.data?.cheers ?? [];
  const incoming = data?.incomingRequests ?? [];
  const following = data?.following ?? [];
  const followers = data?.followers ?? [];
  const outgoing = data?.outgoingRequests ?? [];

  return (
    <StackScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginBottom: 4 }}>
        Follow friends (with their permission), track their journey highlights, and cheer each
        other on.
      </Text>

      <InviteFriendsCard />

      {incoming.length > 0 ? (
        <>
          <SectionTitle>Follow requests</SectionTitle>
          <Card style={{ gap: 12, borderColor: c.accent }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
              These friends want to follow your journey. Only approve people you know — they'll see
              whatever you've enabled in your sharing settings.
            </Text>
            {incoming.map((req) => (
              <View
                key={req.id}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground, flex: 1 }}>
                  {req.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <LuxeButton
                    label="Accept"
                    small
                    icon="check"
                    disabled={respond.isPending}
                    onPress={() => respond.mutate({ id: req.id, data: { accept: true } })}
                  />
                  <LuxeButton
                    label="Decline"
                    small
                    variant="outline"
                    disabled={respond.isPending}
                    onPress={() => respond.mutate({ id: req.id, data: { accept: false } })}
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {cheers.length > 0 ? (
        <>
          <SectionTitle>Cheers for you</SectionTitle>
          <Card style={{ gap: 12 }}>
            {cheers.slice(0, 5).map((cheer) => (
              <View key={cheer.id} style={{ flexDirection: "row", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{cheer.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold" }}>{cheer.fromName}</Text>
                    {cheer.message ? ` — "${cheer.message}"` : " cheered you on"}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                    {timeAgo(cheer.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Journeys you follow</SectionTitle>
      {journeys.length === 0 ? (
        <Card>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground }}>
            You're not following anyone yet. Ask a friend for their invite code to get started.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {journeys.map((journey) => (
            <JourneyCard key={journey.userId} journey={journey} onCheer={() => setCheerTarget(journey)} />
          ))}
        </View>
      )}

      <SectionTitle>Follow a friend</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
          Ask a friend for their invite code (on their Rewards page), then send a follow request.
          They choose what to share with you.
        </Text>
        <LuxeInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Friend's invite code"
          autoCapitalize="characters"
          maxLength={12}
          style={{ fontFamily: "Inter_500Medium", letterSpacing: 1 }}
        />
        <LuxeButton
          label={requestFollow.isPending ? "Sending…" : "Send request"}
          icon="user-plus"
          disabled={!code.trim() || requestFollow.isPending}
          onPress={() => {
            if (code.trim()) requestFollow.mutate({ data: { code: code.trim() } });
          }}
        />
      </Card>

      <SharingSettingsCard />

      <SectionTitle>Your connections</SectionTitle>
      <Card style={{ gap: 18 }}>
        <PeopleList
          title={`Following (${following.length})`}
          entries={following}
          emptyText="Not following anyone yet."
          removeLabel="Unfollow"
          onRemove={(e) => confirmRemove(e, "Unfollow")}
        />
        <PeopleList
          title={`Your followers (${followers.length})`}
          entries={followers}
          emptyText="No followers yet — share your invite code!"
          removeLabel="Remove"
          onRemove={(e) => confirmRemove(e, "Remove")}
        />
        {outgoing.length > 0 ? (
          <PeopleList
            title={`Pending requests you sent (${outgoing.length})`}
            entries={outgoing}
            emptyText=""
            removeLabel="Cancel"
            onRemove={(e) => confirmRemove(e, "Cancel")}
          />
        ) : null}
      </Card>

      <CheerModal
        friend={cheerTarget}
        onClose={() => setCheerTarget(null)}
        onSent={() => {
          setCheerTarget(null);
          void queryClient.invalidateQueries({ queryKey: getGetCheersQueryKey() });
        }}
      />
    </StackScreen>
  );
}

function JourneyCard({ journey, onCheer }: { journey: FriendJourney; onCheer: () => void }) {
  const c = useColors();
  const nothingShared =
    journey.streakDays == null &&
    journey.glowScoreToday == null &&
    journey.checkinsLast7Days == null &&
    journey.weightProgressPct == null;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground }}>
            {journey.name}
          </Text>
          {journey.lastActiveDate ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 1 }}>
              Last check-in {journey.lastActiveDate}
            </Text>
          ) : null}
        </View>
        <LuxeButton label="Cheer" small variant="outline" icon="heart" onPress={onCheer} />
      </View>

      {nothingShared ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
          {journey.name} isn't sharing journey details right now — you can still cheer them on!
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {journey.streakDays != null ? (
              <Badge icon="zap" text={`${journey.streakDays}-day streak`} />
            ) : null}
            {journey.glowScoreToday != null ? (
              <Badge icon="sun" text={`Glow ${journey.glowScoreToday} today`} />
            ) : null}
            {journey.checkinsLast7Days != null ? (
              <Badge icon="check" text={`${journey.checkinsLast7Days}/7 check-ins`} />
            ) : null}
          </View>
          {journey.weightProgressPct != null ? (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground }}>
                  Progress toward goal
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.foreground }}>
                  {journey.weightProgressPct}%
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: c.secondary, borderRadius: 3 }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.max(0, Math.min(100, journey.weightProgressPct))}%`,
                    backgroundColor: c.accent,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Badge({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: c.secondary,
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 10,
      }}
    >
      <Feather name={icon} size={12} color={c.tint} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.secondaryForeground }}>
        {text}
      </Text>
    </View>
  );
}

function PeopleList({
  title,
  entries,
  emptyText,
  removeLabel,
  onRemove,
}: {
  title: string;
  entries: FollowEntry[];
  emptyText: string;
  removeLabel: string;
  onRemove: (entry: FollowEntry) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground }}>{title}</Text>
      {entries.length === 0 ? (
        emptyText ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            {emptyText}
          </Text>
        ) : null
      ) : (
        entries.map((entry) => (
          <View
            key={entry.id}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground, flex: 1 }}>
              {entry.name}
            </Text>
            <Pressable onPress={() => onRemove(entry)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="user-minus" size={14} color={c.mutedForeground} />
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground }}>
                {removeLabel}
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

function SharingSettingsCard() {
  const c = useColors();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSharingSettings();
  const update = useUpdateSharingSettings({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetSharingSettingsQueryKey() }),
      onError: () => Alert.alert("Couldn't save", "Please try again."),
    },
  });

  if (!settings) return null;

  const toggle = (key: "shareGlow" | "shareWeightProgress" | "shareStreak", value: boolean) => {
    update.mutate({ data: { ...settings, [key]: value } });
  };

  const Row = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground, flex: 1, paddingRight: 12 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.secondary }}
        thumbColor={c.switchThumb}
      />
    </View>
  );

  return (
    <>
      <SectionTitle>What your followers can see</SectionTitle>
      <Card style={{ gap: 16 }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
          Only friends you've approved can see any of this. Your actual weight, meals, and check-in
          details are never shared — only the summaries you allow below.
        </Text>
        <Row label="Check-in streak" value={settings.shareStreak} onChange={(v) => toggle("shareStreak", v)} />
        <Row
          label="Glow Score & weekly check-ins"
          value={settings.shareGlow}
          onChange={(v) => toggle("shareGlow", v)}
        />
        <Row
          label="Weight progress (% toward goal only)"
          value={settings.shareWeightProgress}
          onChange={(v) => toggle("shareWeightProgress", v)}
        />
      </Card>
    </>
  );
}

function CheerModal({
  friend,
  onClose,
  onSent,
}: {
  friend: FriendJourney | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [emoji, setEmoji] = useState(CHEER_EMOJIS[0]);
  const [message, setMessage] = useState("");

  const sendCheer = useSendCheer({
    mutation: {
      onSuccess: () => {
        setMessage("");
        onSent();
        Alert.alert("Cheer sent", `${friend?.name} will see it on their Friends page.`);
      },
      onError: () => Alert.alert("Couldn't send", "Please try again."),
    },
  });

  return (
    <Modal
      visible={friend !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
              Cheer on {friend?.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground }}>
            Send a little encouragement — they'll see it on their Friends page.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            {CHEER_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={{
                  padding: 8,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: emoji === e ? c.accent : "transparent",
                  backgroundColor: emoji === e ? c.secondary : "transparent",
                }}
              >
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <LuxeInput
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 200))}
            placeholder="Add a note (optional)"
            multiline
            style={{ minHeight: 64, textAlignVertical: "top" }}
          />
          <LuxeButton
            label={sendCheer.isPending ? "Sending…" : `Send ${emoji}`}
            disabled={sendCheer.isPending || !friend}
            onPress={() => {
              if (!friend) return;
              sendCheer.mutate({
                data: { toUserId: friend.userId, emoji, message: message.trim() || null },
              });
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
