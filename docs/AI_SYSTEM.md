# AI System

## Providers

All LLM calls flow through `src/lib/ai-gateway.server.ts`, which currently
targets the Lovable AI Gateway:

```ts
baseURL: "https://ai.gateway.lovable.dev/v1"
header:  "Lovable-API-Key: ${LOVABLE_API_KEY}"
```

**Default model:** `google/gemini-2.5-flash` (see `src/routes/api.chat.agent.ts`).

### Replacing Lovable AI Gateway

Swap the `createOpenAICompatible` call in `src/lib/ai-gateway.server.ts` for
one of the following, then delete the `LOVABLE_API_KEY` env var:

- **OpenAI direct:** `import { createOpenAI } from '@ai-sdk/openai'; createOpenAI({ apiKey: process.env.OPENAI_API_KEY })`.
- **Google direct:** `import { createGoogleGenerativeAI } from '@ai-sdk/google'; createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })`.
- **Any OpenAI-compatible gateway** (OpenRouter, LiteLLM, Groq): keep
  `createOpenAICompatible` and only change `baseURL` + auth header.

Model IDs used in code today:
- `google/gemini-2.5-flash` — main dashboard agent, landing chat, onboarding chat, qualification classifier.
- Update in `src/routes/api.chat.agent.ts`, `api.chat.landing.ts`, `api.chat.onboarding.ts`, `src/lib/qualification.functions.ts`, `src/lib/reply-value.functions.ts`.

## Agent personality

Source of truth: **`src/lib/agent-voice.server.ts`**.

The MatchAI agent is written as a *smart, supportive close friend who is
also an expert personal brand manager*. Casual, direct, no robotic
buzzwords. Speaks in short lines. Uses "you" and "we". Never says "As an
AI…". Distinguishes cold outreach (new brand) from replies (in-thread
follow-up) and never sends a cold-outreach template as a reply.

## Tools

The main dashboard agent (`src/routes/api.chat.agent.ts`) exposes tools that
render inline cards in `DashboardChatPanel.tsx` via `InlineToolCard`.
Current tool set (search `tools: {` in `api.chat.agent.ts` for the
authoritative list):

- `openOutreachDraft` — inject a cold-outreach draft card into chat.
- `showReplyDraft` — inject a reply draft (in-thread) card.
- `reviewInbox`, `openInboxThread` — surface inbox threads.
- `suggestAttachments` — recommend portfolio items to attach.
- `showFastestToCash`, `showWaysToEarn` — render opportunity strips.
- `showWalletBalance`, `showBreakEvenNudge` — money widgets.
- `showRateHelper` — creator pricing card.
- `showFirstDealJourney`, `showDigest` — progress + activity.
- `flagBadOffer` — inbox red-flag banner + counter-offer draft.
- `runDealChecker` — parse a pasted offer, return red-flag summary.

Tool contracts live inline; extract to `src/lib/mcp/tools/*` if you want to
share them with the MCP server.

## Autonomy levels

`src/lib/autonomy.functions.ts` enforces four levels:

| Level | Behavior |
|---|---|
| Manual | Agent suggests only; nothing sends without a click. |
| Suggest | Same as Manual, plus proactive nudges. |
| Draft | Auto-fills drafts and queues them; user hits Send. |
| Autopilot | Auto-sends within daily caps and inside guardrails. |

Guardrails: CAN-SPAM footer injection, `suppression_list` check, daily
send caps for Autopilot, red-flag block on unfavorable offers.

## MCP server

Lovable's `@lovable.dev/mcp-js` mounts an MCP endpoint. Tools live in
`src/lib/mcp/tools/*` (`get-profile`, `list-brand-matches`, `list-deals`,
`list-pending-approvals`). OAuth consent screen at
`src/routes/[.]lovable.oauth.consent.tsx`, protected-resource metadata at
`src/routes/[.well-known]/oauth-protected-resource.ts`.

To replace `@lovable.dev/mcp-js`, port these handlers to
`@modelcontextprotocol/sdk`'s HTTP transport.

## Chat context injection

- `src/lib/agent-context.server.ts` loads per-user state (recent inbox,
  active deals, wallet balance, autonomy level) into the system prompt.
- `src/lib/agent-chat.functions.ts` exposes `openOutreachDraftInChat` and
  `openEmailInChat` helpers so buttons across the app can inject cards
  without hitting the model.
- `src/lib/chat-openers.functions.ts` picks the greeting variant on
  dashboard load (suppresses openers if a recent turn exists).
