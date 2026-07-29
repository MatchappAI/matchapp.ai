# MatchAI — Claude Code / Codex Context

## Project identity

MatchAI is a chat-first AI agent for UGC creators and micro-influencers to find paid brand deals, draft personalized outreach, negotiate, and get paid. Current positioning: **"Find paid brand deals. Skip the cold DMs."**

## Stack

- **Framework**: TanStack Start v1, React 19, Vite 7, Cloudflare Workers (`nodejs_compat`)
- **Styling**: Tailwind CSS v4, custom theme tokens in `src/styles.css`
- **Backend**: Supabase (Postgres + Auth + Storage + RLS)
- **AI**: OpenAI-compatible SDK, currently using `google/gemini-2.5-flash` via gateway
- **Payments**: Stripe subscriptions + Stripe Connect payouts
- **Email**: Gmail API for outbound, Resend for transactional
- **MCP**: `@lovable.dev/mcp-js`

## Key constraints

1. **TanStack Router is fixed** — no `react-router-dom`, no `src/pages`, no `App.tsx` switcher.
2. **Server functions** use `createServerFn` from `@tanstack/react-start`.
3. **Protected server functions** must not be called from public route loaders (SSR/prerender has no auth). Use `useServerFn` inside components.
4. **Public APIs/webhooks** go under `src/routes/api/public/*` and must verify signatures.
5. **Supabase client** is auto-generated; do not edit `src/integrations/supabase/client.ts`.
6. **RLS** is enabled on all user tables. Privileged writes use service-role inside verified handlers.
7. **Edge runtime** — avoid `child_process`, `sharp`, `canvas`, `puppeteer`, `fs.watch`, `os.cpus()`.

## Product surface

### Primary navigation (consolidated)
- **Inbox** — unified brand conversation threads
- **Deals** — opportunity discovery, fastest-to-cash ranking, ways to earn, first-deal journey
- **Wallet** — balance, payouts, transfers
- **Settings** — socials, payouts, billing, creator setup, rate helper

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
6. Wallet → payment tracking, Stripe Connect transfer.

## Agent behavior

- **Chat-first**: Most actions can be done entirely within the chat panel.
- **Autonomy levels**: Manual → Suggest → Draft → Autopilot.
- **Personality**: Smart, supportive close friend + expert personal brand manager. Casual, direct, no robotic buzzwords.
- **Context-aware**: Remembers last conversation/replies; avoids spamming.
- **Tool-driven**: Agent uses tools to open drafts, review emails, send outreach, flag bad offers, etc.

## Important files

| File | Purpose |
|---|---|
| `src/routes/__root.tsx` | Root layout, fonts, metadata |
| `src/routes/index.tsx` | Landing page |
| `src/routes/dashboard.tsx` | Dashboard shell (50/50 chat + live stage) |
| `src/routes/dashboard.inbox.tsx` | Unified inbox |
| `src/routes/dashboard.deals.tsx` | Consolidated deals/earnings tab |
| `src/routes/dashboard.wallet.tsx` | Wallet & payouts |
| `src/routes/dashboard.settings.tsx` | Settings |
| `src/components/chat/DashboardChatPanel.tsx` | Main chat UI |
| `src/lib/agent-chat.functions.ts` | Chat history + message injection helpers |
| `src/lib/agent-voice.server.ts` | Agent personality / system prompt |
| `src/lib/demo-mode.ts` | Demo opportunities and fastest-to-cash scoring |
| `src/lib/fees.ts` | Source of truth for success-fee math |
| `MATCHAI_CURRENT_STATE_AUDIT.md` | Full factual audit |

## Common gotchas

- **"snag reaching model"** errors usually mean the model ID in `src/routes/api.chat.agent.ts` needs updating.
- **Infinite render loops** in chat panel are usually caused by `useEffect` injecting messages on every render; use `messageTrackerRef` pattern.
- **Buttons that inject drafts into chat** should use `openOutreachDraftInChat` / `openEmailInChat` helpers, not call the agent model directly.
- **Text clipping/overlap**: use `break-words`, `whitespace-pre-wrap`, and `min-w-0` instead of `truncate`.
- **No caps on sequences**: follow-ups and actions are intentionally uncapped.

## Pricing model

- Creators use MatchAI free until they receive a qualified paid brand reply.
- Then choose: **Stay Free** ($0 + 20% success fee, capped at $99/deal) or paid plans ($49/$99/$199 with 0% fee).
- Repeat deals with the same brand are 0% fee.

## When adding features

1. Prefer extending the chat-first experience.
2. Keep dashboard tabs to the four primary ones; hide secondary features rather than deleting.
3. Update `src/lib/fees.ts` if touching money math.
4. Add DB migrations in `supabase/migrations/` with proper GRANTs and RLS policies.
5. Run `bun run build` or `bun run build:dev` to verify before claiming done.
