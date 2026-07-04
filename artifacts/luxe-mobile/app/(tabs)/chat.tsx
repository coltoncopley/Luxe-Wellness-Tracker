import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { fetch as expoFetch } from "expo/fetch";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getListOpenaiMessagesQueryKey,
  useCreateOpenaiConversation,
  useListOpenaiConversations,
  useListOpenaiMessages,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/luxe";

type Bubble = { key: string; role: "user" | "assistant"; content: string };

const STARTERS = [
  "How am I doing this week?",
  "Am I hitting my protein goal?",
  "Tips to break a weight-loss plateau?",
  "What's the difference between Botox and filler?",
];

export default function ChatScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const conversations = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const [conversationId, setConversationId] = useState<number | null>(null);

  const activeId =
    conversationId ??
    (conversations.data && conversations.data.length > 0 ? conversations.data[0].id : null);

  const messagesQuery = useListOpenaiMessages(activeId ?? 0, {
    query: {
      queryKey: getListOpenaiMessagesQueryKey(activeId ?? 0),
      enabled: activeId != null,
    },
  });

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streaming, setStreaming] = useState<{ userText: string; assistantText: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Bubble>>(null);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (activeId != null) return activeId;
    const created = await createConversation.mutateAsync({ data: { title: "New chat" } });
    setConversationId(created.id);
    return created.id;
  }, [activeId, createConversation]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isSending) return;
      setIsSending(true);
      setError(null);
      setInput("");
      setStreaming({ userText: text, assistantText: "" });

      try {
        const id = await ensureConversation();
        const token = await getToken();
        const res = await expoFetch(apiUrl(`/openai/conversations/${id}/messages`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const data = event
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            let payload: { content?: string; error?: string };
            try {
              payload = JSON.parse(data);
            } catch {
              continue;
            }
            if (payload.content) {
              const chunk = payload.content;
              setStreaming((prev) =>
                prev ? { ...prev, assistantText: prev.assistantText + chunk } : prev,
              );
            }
            if (payload.error) throw new Error(payload.error);
          }
        }

        await queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(id) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        setInput(text);
      } finally {
        setStreaming(null);
        setIsSending(false);
      }
    },
    [ensureConversation, getToken, isSending, queryClient],
  );

  const bubbles: Bubble[] = useMemo(() => {
    const fromServer: Bubble[] = (messagesQuery.data ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ key: `m-${m.id}`, role: m.role as "user" | "assistant", content: m.content }));
    const live: Bubble[] = streaming
      ? [
          { key: "live-user", role: "user", content: streaming.userText },
          ...(streaming.assistantText
            ? [{ key: "live-assistant", role: "assistant" as const, content: streaming.assistantText }]
            : []),
        ]
      : [];
    // Inverted list: newest first
    return [...fromServer, ...live].reverse();
  }, [messagesQuery.data, streaming]);

  const showWelcome = !conversations.isLoading && bubbles.length === 0 && !streaming;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: topPad + 10, paddingHorizontal: 20, paddingBottom: 10 }}>
        <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 26, color: c.foreground }}>
          Luxe AI
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
          Wellness guidance, not medical advice
        </Text>
      </View>

      {showWelcome ? (
        <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "flex-end", paddingBottom: 12 }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <View style={[styles.sparkle, { backgroundColor: c.secondary }]}>
              <Feather name="star" size={22} color={c.tint} />
            </View>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground, marginTop: 12 }}>
              Ask me anything
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: c.mutedForeground,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Weight loss coaching, treatment questions, or a check on your week.
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {STARTERS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={{
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground }}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={bubbles}
          inverted
          keyExtractor={(b) => b.key}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 10 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? { backgroundColor: c.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 }
                  : {
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.border,
                      alignSelf: "flex-start",
                      borderBottomLeftRadius: 4,
                    },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  lineHeight: 21,
                  color: item.role === "user" ? c.primaryForeground : c.foreground,
                }}
              >
                {item.content}
              </Text>
            </View>
          )}
          ListHeaderComponent={
            isSending && !streaming?.assistantText ? (
              <View style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
                <ActivityIndicator size="small" color={c.tint} />
              </View>
            ) : null
          }
        />
      )}

      {error ? (
        <Text
          style={{
            color: c.destructive,
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            paddingHorizontal: 20,
            paddingBottom: 4,
          }}
        >
          {error}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Platform.OS === "web" ? 96 : insets.bottom + 60,
          alignItems: "flex-end",
        }}
      >
        <TextInput
          style={{
            flex: 1,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.input,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 11,
            fontSize: 15,
            fontFamily: "Inter_400Regular",
            color: c.foreground,
            maxHeight: 110,
          }}
          placeholder="Message Luxe AI…"
          placeholderTextColor={c.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isSending}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={isSending || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: isSending || !input.trim() ? 0.5 : 1,
          }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#0F1729" />
          ) : (
            <Feather name="arrow-up" size={20} color="#0F1729" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "84%",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sparkle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
