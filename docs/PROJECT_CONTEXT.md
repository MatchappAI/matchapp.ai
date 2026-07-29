# MatchAI — Project Context (Claude Code / Codex Handoff)

This document is the single source of truth for continuing MatchAI development
outside of Lovable. It captures everything previously stored only in Lovable's
project-knowledge and custom-instructions surface. No secret values are included.

---

## 1. Project identity

MatchAI is a creator-first AI brand-deal manager for UGC creators and
micro-influencers. It helps them find paid brand deals, draft personalized
outreach, manage inbox threads, negotiate offers, and track external payment
status without custodying funds.

Current positioning: **"Find paid brand deals. Skip the cold DMs."**

Domain: `www.matchapp.ai`

---

## 2. Stack

- **Framework:** TanStack Start v1, React 19, Vite 7, Cloudflare Workers (`nodejs_compat`)
- **Styling:** Tailwind CSS v4, custom theme tokens in `src/styles.css`
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **AI:** OpenAI-compatible SDK, currently `google/gemini-2.5-flash` via the Lovable gateway
- **Payments:** Stripe subscriptions / billing only; creator-brand payments are external and are tracked as creator-reported status only
- **Email:** Gmail API for creator inbox / outreach sync; Resend for transactional / inbound webhooks
- **MCP:** `@lovable.dev/mcp-js` (replace on exit — see LOVABLE_EXIT_CHECKLIST)

---

## 3. Hard constraints (do not violate)

1. **TanStack Router is fixed.** No `react-router-dom`, no `src/pages`, no `App.tsx` switcher.
2. **Server functions** use `createServerFn` from `@tanstack/react-start`.
3. **Protected server functions** must NOT be called from public route loaders
   (SSR/prerender has no auth). Use `useServerFn` inside components, or place
   the loader under `src/routes/_authenticated/`.
4. **Public APIs / webhooks / cron** go under `src/routes/api/public/*` and
   MUST verify caller signatures inside the handler.
5. **Supabase client is auto-generated.** Do not edit
   `src/integrations/supabase/client.ts`, `client.server.ts`,
   `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, or the Supabase
   env vars (`VITE_SUPABASE_URL`, `_PUBLISHABLE_KEY`, `_PROJECT_ID`).
6. **RLS is enabled on all user tables.** Every `CREATE TABLE public.*`
   migration must include explicit `GRANT` statements before enabling RLS
   and adding policies. Privileged writes use service-role only inside
   handlers that have already verified the caller.
7. **Edge runtime** — avoid `child_process`, `sharp`, `canvas`, `puppeteer`,
   `fs.watch`, `os.cpus()`. Prefer pure JS or WASM.
8. **User roles** are stored in a separate `user_roles` table (not on
   profiles) and checked via a `security definer` function.
9. **Never re-add** legacy pre-v1 APIs: `vinxi/types/client`,
   `@tanstack/react-start/router-manifest`, `createStartHandler`, `StartClient`.

---

## 4. Product surface

### Primary navigation (consolidated)
- **Inbox** — authoritative creator communication threads
- **Deals** — opportunity discovery, prioritization, first-deal journey, negotiation
- **Tracker** — status/control view for follow-up, replies, and next actions
- **Tools** — deal checker, rate helper, counteroffer, reply drafting
- **Settings** — socials, billing, creator setup, rate helper, integrations

### Hidden but routable
- `/dashboard/brands`
- `/dashboard/campaigns`
- `/dashboard/analytics`
- `/dashboard/admin`

### Core user flow
1. Onboarding → connect Gmail, set rates, upload brand kit/portfolio.
2. Deals tab → AI ranks opportunities; user picks one.
3. Chat → user or agent drafts personalized pitch.
4. Inbox → brand replies flow back; agent suggests next action.
5. Negotiation → deal terms, red-flag detection, counter-offers.
6. Payments → creator-reported external payment tracking only.

---

## 5. Agent behavior

- **Chat-first.** Every action can happen entirely inside the chat panel.
  Buttons like "Generate Pitch" and "Review" inject drafts into chat history
  instead of opening tabs (see `openOutreachDraftInChat` / `openEmailInChat`).
- **Autonomy levels:** Manual → Suggest → Draft → Autopilot. Enforced in
  `src/routes/api.chat.agent.ts`.
- **Personality:** smart, supportive close friend + expert personal brand
  manager. Casual, direct, no robotic buzzwords. Warm Quicksand font at ~16.5px.
- **Context-aware.** Remembers last conversation/replies; suppresses redundant
  openers; won't spam. Re-engages with playful nudges after idle time.
- **Tool-driven.** Uses tools to open drafts, review emails, send outreach,
  flag bad offers, suggest attachments, run rate helper, etc.
- **Reply vs cold outreach are distinct.** Replies use `showReplyDraft`;
  cold outreach uses the dedicated cold-outreach tools. Never confuse them.

---

## 6. Pricing / monetization

- Creators use MatchAI free until they choose a paid plan.
  - **Free:** $0 subscription.
  - **Paid plans:** $49 / $99 / $199 subscriptions.
- MatchAI does not custody creator-brand deal funds or present any wallet,
  escrow, payout, or Connect flow as active product behavior.
- No caps on outbound sequences, follow-ups, or agent tool-loop steps.
- Free tier has a 3-thread inbound cap before plan selection.
- Fee math source of truth: `src/lib/fees.ts`. Never hardcode fee values
  elsewhere.

---

## 7. Ranking / matching

- Opportunities are ranked by a weighted `fastestToCashScore` in
  `src/lib/demo-mode.ts`. Locality is a first-class signal (~12% weight)
  because local brands ship faster and close faster.
- Categories: Quick Earnings, Matched UGC, Existing-Content Licensing,
  Sponsored Content, Repeat Brand, Monthly Retainers.
- "Top 6 fastest-to-cash" is the default Deals tab strip.

---

## 8. Important files

| File | Purpose |
|---|---|
| `src/routes/__root.tsx` | Root layout, fonts, metadata |
| `src/routes/index.tsx` | Landing page |
| `src/routes/dashboard.tsx` | Dashboard shell (50/50 chat + live stage) |
| `src/routes/dashboard.inbox.tsx` | Unified inbox |
| `src/routes/dashboard.deals.tsx` | Consolidated deals/earnings tab |
| `src/routes/dashboard.tracker.tsx` | Status/control view for follow-up and next actions |
| `src/routes/dashboard.tools.tsx` | Deal checker, rate helper, counteroffer, reply drafting |
| `src/routes/dashboard.wallet.tsx` | Legacy payment-status route; keep as compatibility surface only |
| `src/routes/dashboard.settings.tsx` | Settings |
| `src/components/chat/DashboardChatPanel.tsx` | Main chat UI |
| `src/components/chat/LandingChatWidget.tsx` | Landing chat guide |
| `src/lib/agent-chat.functions.ts` | Chat history + message injection helpers |
| `src/lib/agent-voice.server.ts` | Agent personality / system prompt |
| `src/lib/demo-mode.ts` | Demo opportunities + fastest-to-cash scoring |
| `src/lib/fees.ts` | Source of truth for subscription / commission copy |
| `src/lib/qualification.functions.ts` | Qualified-reply classifier (paywall trigger) |
| `src/lib/wallet.functions.ts` | Legacy wallet compatibility helpers |
| `src/lib/rate-helper.ts` | Rate-card suggestions from creator profile |
| `src/lib/open-email-in-chat.ts` | Routes email interactions into chat |
| `src/components/brand/MatchAILogo.tsx` | Single logo source of truth |
| `MATCHAI_CURRENT_STATE_AUDIT.md` | Full factual audit |

---

## 9. Common gotchas

- **"Snag reaching model"** errors usually mean the model ID in
  `src/routes/api.chat.agent.ts` needs updating.
- **Infinite render loops** in chat panel are usually caused by `useEffect`
  injecting messages on every render — use the `messageTrackerRef` pattern
  that is already in place.
- **Buttons that inject drafts into chat** should call
  `openOutreachDraftInChat` / `openEmailInChat`, NOT the agent model directly.
- **Text clipping/overlap:** use `break-words`, `whitespace-pre-wrap`, and
  `min-w-0`. Never `truncate` chat/brand copy.
- **No caps on sequences.** Follow-ups and actions are intentionally uncapped;
  do not re-introduce hardcoded limits.
- **Landing chat widget** auto-opens once per session, remembers engagement,
  and re-engages after idle timeouts.

---

## 10. When adding features

1. Prefer extending the chat-first experience over new tabs.
2. Keep dashboard tabs to the five primary ones; hide secondary features rather
   than deleting them.
3. Update `src/lib/fees.ts` if touching money math.
4. Add DB migrations in `supabase/migrations/` with `GRANT` + RLS policies.
5. Run `bun run build` (or `bun run build:dev`) to verify before claiming done.
6. Server-only helpers live in `*.server.ts`; client-safe server function
   wrappers live in `*.functions.ts`. Do not put server-only imports in a
   file the client bundle can reach.

---

## 11. Security posture

- All financial tables (`deals`, `brand_matches`, `negotiations`, `wallet_ledger`,
  `payout_attempts`) have explicit RLS; the wallet/payout tables are legacy compatibility surfaces only and should not be surfaced as active product capabilities.
- `SECURITY DEFINER` functions have `EXECUTE` revoked from `anon` and
  `authenticated`; only invoked via server-side helpers.
- Every `SECURITY DEFINER` function pins `search_path = public`.
- Stripe and Resend webhooks verify HMAC signatures with `timingSafeEqual`.
- CAN-SPAM footer is injected into every outbound email; suppression list is
  honored.
- Autopilot has daily send caps and audit logs in `agent_audit_log`.
- Leaked-password (HIBP) check is intentionally DISABLED — creators frequently
  reuse passwords and we don't want signup friction.
