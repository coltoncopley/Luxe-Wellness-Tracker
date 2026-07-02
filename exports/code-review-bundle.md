# LUXE Wellness — Code for External Review

Recent changes: Clerk authentication (patient + staff roles) and AI chat medical disclaimer.

## `artifacts/luxe-wellness/src/pages/luxe-ai.tsx`

```tsx
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
    "What helps with nausea on semaglutide?",
    "How much protein should I eat daily?",
    "What's the difference between Botox and filler?",
    "Tips for hitting a weight loss plateau?",
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
                Ask me anything about skincare, treatments, GLP-1 weight loss, nutrition, or wellness.
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
```

## `artifacts/api-server/src/routes/openai.ts`

```tsx
import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, conversations, messages, servicesTable, staffTable } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { userIdOf } from "../middlewares/auth";

const router: IRouter = Router();

const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

async function buildSystemPrompt(): Promise<string> {
  const [services, staff] = await Promise.all([
    db.select().from(servicesTable).orderBy(asc(servicesTable.id)),
    db.select().from(staffTable).orderBy(asc(staffTable.id)),
  ]);

  const serviceLines = services
    .map((s) => `- ${s.name} (${s.category}): ${s.description ?? ""}`)
    .join("\n");
  const staffLines = staff.map((s) => `- ${s.name}, ${s.title}`).join("\n");

  return `You are Luxe AI, the friendly virtual assistant for LUXE Wellness and Aesthetics, a physician-owned med spa in South Point, Ohio, led by Dr. Copley.

Your role:
- Answer questions about aesthetics, skincare, injectables, GLP-1 weight loss (semaglutide/tirzepatide), nutrition, and general wellness in a warm, knowledgeable, spa-like tone.
- Support patients on GLP-1 medications: side-effect tips (nausea, constipation, fatigue), protein targets, hydration, muscle preservation, plateau advice.
- When relevant, gently mention LUXE treatments that could help — never hard-sell. One soft suggestion max per reply.
- If someone wants to book, direct them to the booking page: ${BOOKING_URL} (or the Book tab in this app).

LUXE services:
${serviceLines}

The LUXE team:
${staffLines}

Important safety rules:
- You are not a doctor and do not diagnose. For medical concerns, dosing changes, or worrying symptoms, advise contacting the LUXE clinic or their physician promptly.
- For emergencies (chest pain, severe allergic reaction, etc.), tell them to call 911 immediately.
- Keep answers concise and skimmable — short paragraphs, occasional bullet lists. Match the patient's language.`;
}

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userIdOf(res)))
    .orderBy(desc(conversations.createdAt));
  res.json(rows);
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const body = CreateOpenaiConversationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .insert(conversations)
    .values({ title: body.data.title, userId: userIdOf(res) })
    .returning();
  res.status(201).json(row);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userIdOf(res))));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const deleted = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userIdOf(res))))
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userIdOf(res))));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = SendOpenaiMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userIdOf(res))));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  await db.insert(messages).values({ conversationId: id, role: "user", content: body.data.content });

  const systemPrompt = await buildSystemPrompt();
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    { role: "user" as const, content: body.data.content },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Luxe AI stream failed");
    res.write(`data: ${JSON.stringify({ error: "Something went wrong generating a response. Please try again." })}\n\n`);
  }
  res.end();
});

export default router;
```

## `artifacts/api-server/src/middlewares/auth.ts`

```tsx
import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const knownUserIds = new Set<string>();

async function ensureUserRow(userId: string): Promise<void> {
  if (knownUserIds.has(userId)) return;
  let email: string | null = null;
  let firstName: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    firstName = clerkUser.firstName ?? null;
  } catch {
    // Profile enrichment is best-effort; the row still gets created.
  }
  await db
    .insert(usersTable)
    .values({ id: userId, email, firstName })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, firstName },
    });
  knownUserIds.add(userId);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    await ensureUserRow(userId);
  } catch (err) {
    next(err);
    return;
  }
  res.locals.userId = userId;
  next();
}

export async function requireStaff(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.role !== "staff") {
      res.status(403).json({ error: "Staff access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function userIdOf(res: Response): string {
  const userId = res.locals.userId as string | undefined;
  if (!userId) throw new Error("userIdOf called without requireAuth");
  return userId;
}
```

## `artifacts/api-server/src/routes/me.ts`

```tsx
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import { GetMeResponse, ActivateStaffAccessBody, ActivateStaffAccessResponse } from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";

const router: IRouter = Router();

const activationHits = new Map<string, { count: number; windowStart: number }>();
const ACTIVATION_LIMIT = 5;
const ACTIVATION_WINDOW_MS = 60_000;

function rateLimitActivation(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = activationHits.get(key);
  if (!entry || now - entry.windowStart > ACTIVATION_WINDOW_MS) {
    if (activationHits.size > 1000) activationHits.clear();
    activationHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > ACTIVATION_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

router.get("/me", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      role: user.role,
    }),
  );
});

router.post("/me/staff-access", rateLimitActivation, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = ActivateStaffAccessBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "staff_access_code"));
  const submitted = body.data.code.trim().toUpperCase();
  if (!setting || submitted !== setting.value.toUpperCase()) {
    res.status(403).json({ error: "That access code is not valid" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ role: "staff" })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json(
    ActivateStaffAccessResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      role: user.role,
    }),
  );
});

export default router;
```

## `artifacts/luxe-wellness/src/App.tsx`

```tsx
import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Book from "@/pages/book";
import Weight from "@/pages/weight";
import Food from "@/pages/food";
import Restaurants from "@/pages/restaurants";
import LuxeAI from "@/pages/luxe-ai";
import Glow from "@/pages/glow";
import Rewards from "@/pages/rewards";
import StaffVerify from "@/pages/staff-verify";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Support from "@/pages/support";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(222 47% 11%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(40 25% 97%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(222 30% 30%)",
    fontFamily: "'Lexend', sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[hsl(40,15%,90%)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-[hsl(222,47%,11%)]",
    headerSubtitle: "text-[hsl(215,16%,47%)]",
    socialButtonsBlockButtonText: "text-[hsl(222,47%,11%)] font-medium",
    formFieldLabel: "text-[hsl(222,47%,11%)]",
    footerActionLink: "text-[hsl(43,60%,38%)] hover:text-[hsl(43,60%,30%)] font-medium",
    footerActionText: "text-[hsl(215,16%,47%)]",
    dividerText: "text-[hsl(215,16%,47%)]",
    identityPreviewEditButton: "text-[hsl(43,60%,38%)]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-[hsl(222,47%,11%)]",
    logoBox: "justify-center",
    logoImage: "h-10",
    socialButtonsBlockButton: "border border-[hsl(40,15%,88%)] bg-white hover:bg-[hsl(40,25%,97%)]",
    formButtonPrimary: "bg-[hsl(222,47%,11%)] hover:bg-[hsl(222,47%,18%)] text-white",
    formFieldInput: "bg-[hsl(40,25%,97%)] border-[hsl(40,15%,88%)]",
    footerAction: "justify-center",
    dividerLine: "bg-[hsl(40,15%,90%)]",
    alert: "bg-[hsl(40,25%,97%)] border border-[hsl(40,15%,88%)]",
    otpCodeFieldInput: "border-[hsl(40,15%,80%)] text-[hsl(222,47%,11%)]",
    formFieldRow: "gap-2",
    main: "gap-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Dashboard />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function PublicPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to LUXE",
            subtitle: "Sign in to your patient companion",
          },
        },
        signUp: {
          start: {
            title: "Join LUXE Wellness",
            subtitle: "Create your patient account to start tracking your journey",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/book">{() => <Protected component={Book} />}</Route>
            <Route path="/weight">{() => <Protected component={Weight} />}</Route>
            <Route path="/food">{() => <Protected component={Food} />}</Route>
            <Route path="/restaurants">{() => <Protected component={Restaurants} />}</Route>
            <Route path="/luxe-ai">{() => <Protected component={LuxeAI} />}</Route>
            <Route path="/glow">{() => <Protected component={Glow} />}</Route>
            <Route path="/rewards">{() => <Protected component={Rewards} />}</Route>
            <Route path="/staff">{() => <Protected component={StaffVerify} />}</Route>
            <Route path="/privacy">{() => <PublicPage component={Privacy} />}</Route>
            <Route path="/terms">{() => <PublicPage component={Terms} />}</Route>
            <Route path="/support">{() => <PublicPage component={Support} />}</Route>
            <Route>{() => <PublicPage component={NotFound} />}</Route>
          </Switch>
          <Toaster />
          <SonnerToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
```

