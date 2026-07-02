import { useEffect, useRef, useState } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Plus, Info } from "lucide-react";
import { toast } from "sonner";

interface StreamingState {
  userText: string;
  assistantText: string;
}

export default function LuxeAI() {
  const queryClient = useQueryClient();
  const { data: conversationsList, isLoading: convosLoading } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeId =
    conversationId ?? (conversationsList && conversationsList.length > 0 ? conversationsList[0].id : null);

  const { data: messages } = useListOpenaiMessages(activeId ?? 0, {
    query: {
      queryKey: getListOpenaiMessagesQueryKey(activeId ?? 0),
      enabled: activeId != null,
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function ensureConversation(): Promise<number> {
    if (activeId != null) return activeId;
    const conv = await createConversation.mutateAsync({ data: { title: "Luxe AI Chat" } });
    setConversationId(conv.id);
    await queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
    return conv.id;
  }

  async function handleNewChat() {
    const conv = await createConversation.mutateAsync({ data: { title: "Luxe AI Chat" } });
    setConversationId(conv.id);
    await queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput("");
    setStreaming({ userText: text, assistantText: "" });

    try {
      const id = await ensureConversation();
      const res = await fetch(`/api/openai/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          if (payload.error) {
            throw new Error(payload.error);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      setInput(text);
    } finally {
      setStreaming(null);
      setIsSending(false);
    }
  }

  const starterPrompts = [
    "How am I doing this week?",
    "Am I hitting my protein goal?",
    "What helps with nausea on semaglutide?",
    "What's the difference between Botox and filler?",
  ];

  const showWelcome = !convosLoading && (!messages || messages.length === 0) && !streaming;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            Luxe AI
          </h1>
          <p className="text-muted-foreground mt-1">
            Your 24/7 aesthetics & wellness assistant
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewChat} disabled={isSending}>
          <Plus className="h-4 w-4 mr-1" /> New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
        {showWelcome && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold mb-1">Hi, I'm Luxe AI</h2>
              <p className="text-muted-foreground max-w-md">
                Ask me anything about skincare, treatments, GLP-1 weight loss, nutrition, or
                wellness. I can see your own logs — weight, meals, Glow check-ins — so ask me how
                you're doing. Your data stays private to you and is never shared with LUXE staff.
              </p>
            </div>
            <div className="flex items-start gap-2 max-w-lg text-left rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-medium">Not medical advice.</span> Luxe AI provides general
                wellness information only. It is not direct medical advice and should never be a
                substitute for advice from Dr. Copley or another qualified healthcare professional.
                Always consult your provider about medications, symptoms, or health decisions.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {starterPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="text-sm text-left px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((m) => (
          <ChatBubble key={m.id} role={m.role} content={m.content} />
        ))}

        {streaming && (
          <>
            <ChatBubble role="user" content={streaming.userText} />
            {streaming.assistantText ? (
              <ChatBubble role="assistant" content={streaming.assistantText} />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm pl-2">
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                Luxe AI is thinking...
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask about treatments, GLP-1 tips, nutrition..."
          className="resize-none rounded-xl min-h-[52px] max-h-40"
          rows={1}
          disabled={isSending}
        />
        <Button
          onClick={() => void handleSend()}
          disabled={isSending || !input.trim()}
          size="icon"
          className="h-[52px] w-[52px] rounded-xl shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Luxe AI is not direct medical advice and is no substitute for professional care. For
        medical concerns, always consult Dr. Copley or your healthcare provider.
      </p>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
