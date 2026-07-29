# Handoff Inventory — Non-Secret

Complete inventory of everything an operator needs to stand up MatchAI
independently. No secret values.

---

## Environment variables (names only)

### Client-safe (`VITE_*`, committed in `.env.example`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Server-only (set via `wrangler secret put`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `APIFY_TOKEN`
- `CRON_SHARED_SECRET`
- `AI_PROVIDER_API_KEY` (replaces `LOVABLE_API_KEY` after AI-gateway swap)

---

## External services & dashboard configuration

| Service | What to configure |
|---|---|
| Supabase | New project, replay 52 migrations, enable Email + Google auth (HIBP off), create `avatars` private bucket + policies, set Site URL and redirect allow-list |
| Stripe | Webhook endpoint `https://www.matchapp.ai/api/public/stripe-webhook`; MatchAI subscriptions / billing only; Stripe Tax optional |
| Resend | Verified sending domain for `matchapp.ai`; inbound webhook `https://www.matchapp.ai/api/public/hooks/resend-inbound` |
| Google Cloud | OAuth client for Supabase Google auth; separate Gmail OAuth client for outbound sends; redirect URIs listed below |
| Apify | Actor tokens for brand/lead scraping (if used) |
| Cloudflare | Workers project, custom domain `www.matchapp.ai`, DNS |

---

## Cron schedules and endpoints

All endpoints POST with `x-cron-secret: <CRON_SHARED_SECRET>`.

| Schedule (UTC) | Path |
|---|---|
| `0 15 * * *` | `/api/public/cron/daily-digest` |
| `*/10 * * * *` | `/api/public/cron/gmail-poll` |
| `*/15 * * * *` | `/api/public/cron/qualify-replies` |
| `*/30 * * * *` | `/api/public/cron/payout-retry` (legacy compatibility only) |
| `*/5 * * * *` | `/api/public/cron/autopilot` |

---

## Authentication redirect URLs

- `https://www.matchapp.ai`
- `https://www.matchapp.ai/auth/callback`
- `http://localhost:8080`
- `http://localhost:8080/auth/callback`

Google Cloud OAuth clients must list the same callback URLs.

---

## Storage buckets and policies

| Bucket | Access | Policies |
|---|---|---|
| `avatars` | Private | Authenticated CRUD restricted to `(storage.foldername(name))[1] = auth.uid()::text`; service_role full |

---

## AI: models, prompts, tools, workflows

- **Default model:** `google/gemini-2.5-flash` (chat + tool use).
  Model ID is set in `src/routes/api.chat.agent.ts`.
- **System prompt / personality:** `src/lib/agent-voice.server.ts` —
  "smart, supportive close friend + expert personal brand manager". Casual,
  direct, no robotic buzzwords. Warm Quicksand voice.
- **Agent tools** (registered in `src/routes/api.chat.agent.ts`):
  - `showOutreachDraft`, `showReplyDraft`
  - `openEmailInChat`, `openOutreachDraftInChat`
  - `suggestAttachments`
  - `checkDeal` (bad-offer red-flag detection)
  - `rateHelper` (rate-card suggestion)
  - `highlightUi` (agent cursor overlay)
  - Wallet / payout tools (legacy compatibility only)
  - Fastest-to-cash ranking tool
- **Workflows:**
  - Landing chat guide: `src/components/chat/LandingChatWidget.tsx`
  - Dashboard chat panel: `src/components/chat/DashboardChatPanel.tsx`
  - Autonomy levels: Manual → Suggest → Draft → Autopilot
  - Qualification classifier: `src/lib/qualification.functions.ts`
  - Fee math: `src/lib/fees.ts`
  - Ranking: `src/lib/demo-mode.ts`

---

## Remaining Lovable-specific code and required replacement

| File / package | Replacement |
|---|---|
| `@lovable.dev/mcp-js` + `src/routes/[.mcp]/*` + `src/lib/mcp/*` | `@modelcontextprotocol/sdk`, or delete if MCP not needed |
| `@lovable.dev/cloud-auth-js` + `src/integrations/lovable/*` + `appUserConnector.ts` | Direct `supabase.auth.signInWithOAuth` |
| `@lovable.dev/email-js` | Resend SDK (`import { Resend } from 'resend'`) |
| `@lovable.dev/webhooks-js` | `node:crypto` `createHmac` + `timingSafeEqual` |
| `@lovable.dev/vite-tanstack-config` | Inline into `vite.config.ts` |
| `src/lib/ai-gateway.server.ts` (routes through `LOVABLE_API_KEY`) | Direct Gemini SDK (or OpenAI-compatible endpoint) using `AI_PROVIDER_API_KEY` |
| `src/routes/[.]lovable.oauth.consent.tsx` | Delete when MCP is removed |
| Auto-generated Supabase files under `src/integrations/supabase/*` | Regenerate against new project via `supabase gen types typescript` |
| `.asset.json` pointers under `src/assets/` (route via `/__l5e/assets-v1/`) | Local binaries are now committed alongside them; delete the pointer files after any remaining consumers switch to the local imports |

---

## Assets

All UI-critical binaries are now committed locally:

| Local file | Previously CDN pointer |
|---|---|
| `src/assets/matchai-mark-transparent.png` | (already local) |
| `src/assets/matchai-wordmark.png` | `matchai-wordmark.png.asset.json` |
| `src/assets/matchai-mark.png` | `matchai-mark.png.asset.json` |
| `src/assets/matchai-mark.jpeg` | `matchai-mark.jpeg.asset.json` |
| `src/assets/logo-v2.png` | `logo-v2.png.asset.json` |
| `src/assets/logo.png` | (already local) |
| `public/favicon.png` | (already local) |

Only `matchai-wordmark.png` was actively referenced through its
`.asset.json`; the reference is now switched to the local file
(`src/components/brand/MatchAILogo.tsx`). No visual change.

**Cannot be exported / must be recreated:**
- None. All binary assets used by the UI have been downloaded and committed.
  The `.asset.json` pointer files remain in-repo for reference and can be
  deleted safely once you confirm no import still consumes them.
