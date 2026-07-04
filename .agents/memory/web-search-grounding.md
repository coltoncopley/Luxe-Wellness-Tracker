---
name: Verifying web-search grounding on the OpenAI proxy
description: How to prove an AI response actually ran a web search (anti-fabrication) via the Replit OpenAI Responses API proxy.
---

# Verifying web-search grounding

When a feature must add ONLY real, web-verified data (no-fake-data rule) and uses
`openai.responses.create({ model, tools: [{ type: "web_search" }], ... })` through the
Replit AI Integrations OpenAI proxy, you can prove a search actually happened.

**Rule:** treat a response as grounded only if `response.output` (an array) contains an
item whose `type === "web_search_call"`. When the model uses the tool, the proxy returns
`response.output` shaped like `["web_search_call", "message"]` (confirmed live on
model `gpt-5.4`). If no `web_search_call` item is present, the model answered from memory —
reject it (e.g. HTTP 422) rather than persisting possibly-fabricated results.

**Also require per-item attribution:** make the model emit a `sourceDomain` per result and
drop anything where your domain cleaner returns null. The `web_search_call` check proves a
search ran; the domain check proves each item is attributable. Neither alone is enough.

**Why:** self-reported "I searched" text is not trustworthy, and a bare model answer can
invent plausible-but-fake places. The `web_search_call` output item is the machine-checkable
signal that the tool actually fired. Some proxies could strip/rename output items, so this
was verified against the live proxy before shipping.

**How to apply:** any new "find real X near me / online" AI feature. Diverge from the older
`/restaurants/custom` "typical menu" flow, which intentionally has a non-grounded fallback —
discovery-style features must NOT fall back to ungrounded generation.
