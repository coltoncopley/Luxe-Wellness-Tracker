import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, conversations, messages, servicesTable, staffTable } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

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
  const rows = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
  res.json(rows);
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const body = CreateOpenaiConversationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(conversations).values({ title: body.data.title }).returning();
  res.status(201).json(row);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
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
  const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
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

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
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
