# MatchAI — Architecture

## Stack

| Layer      | Choice                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Framework  | TanStack Start v1 (file-based router, server functions, SSR on Cloudflare Workers)                           |
| UI         | React 19 + Tailwind CSS v4 (`src/styles.css`) + Radix UI + shadcn-derived components in `src/components/ui/` |
| State/data | TanStack Query, TanStack Router loaders, `createServerFn` for RPC                                            |
| Backend    | Supabase (Postgres, Auth, Storage, RLS)                                                                      |
| AI         | `ai` SDK + `@ai-sdk/openai-compatible` pointed at Lovable AI Gateway (`google/gemini-2.5-flash` default)     |
| Payments   | Stripe subscriptions and billing only                                                                        |
| Email      | Internal MatchAI Inbox; Resend remains product/transactional email only                                      |
| Scraping   | Apify (`src/lib/apify.*`)                                                                                    |
| MCP        | `@lovable.dev/mcp-js` mounted at `/api/mcp/*` and `/.well-known/oauth-protected-resource`                    |
| Runtime    | Cloudflare Workers (`wrangler.jsonc`, `nodejs_compat`)                                                       |

## Directory map

```
src/
  routes/                       # File-based TanStack routes (see full list below)
    __root.tsx                  # Root layout, fonts, metadata
    index.tsx                   # Landing page
    dashboard.tsx               # Dashboard shell (50/50 chat + live stage)
    dashboard.inbox.tsx         # Unified brand inbox
    dashboard.deals.tsx         # Opportunity feed + application pipeline
    dashboard.tracker.tsx       # Derived application/follow-up tracker
    dashboard.tools.tsx         # Deal Checker, Rate Helper, counter/reply helpers
    dashboard.wallet.tsx        # Legacy compatibility route, not in creator nav
    dashboard.settings.tsx      # Socials, billing, creator setup
    dashboard.brands.tsx        # (hidden from primary nav, still routable)
    dashboard.campaigns.tsx     # (hidden) brand-side briefs
    dashboard.analytics.tsx     # (hidden)
    dashboard.admin*.tsx        # (hidden)
    onboarding.step-{1,2,3}.tsx # Onboarding
    auth.tsx                    # Sign-in
    checkout.return.tsx         # Stripe return
    pay.$id.tsx                 # Public funding page for brand-paid deals
    api.chat.agent.ts           # Main dashboard agent (tool-calling)
    api.chat.landing.ts         # Landing widget agent
    api.chat.onboarding.ts      # Onboarding chat agent
    api/                        # HTTP endpoints
    api.public.*.ts             # Public endpoints (no auth) — webhooks, cron, email pixels
    [.mcp]/                     # MCP invoke-tool + list-tools handlers
    [.well-known]/              # OAuth protected-resource metadata
    [.]lovable.oauth.consent.tsx# MCP OAuth consent screen
    lovable/email/queue/process.ts # Lovable-invoked email queue processor
  components/
    hero/                       # Landing sections
    chat/                       # DashboardChatPanel, LandingChatWidget, InlineToolCard, tool cards
    dashboard/                  # FastestToCashStrip, WaysToEarn, FirstDealJourney, tabs, etc.
    onboarding/, settings/, brand/, email/, motion/, icons/, ui/
  lib/
    agent-voice.server.ts       # System prompt / personality
    agent-context.server.ts     # Per-user context injection
    agent-chat.functions.ts     # Chat history + message injection helpers
    agent-highlight.ts          # UI element pointer for AgentCursor
    ai-gateway.server.ts        # LLM provider factory (Lovable gateway)
    ai-engine.functions.ts      # Model-call wrappers
    autonomy.functions.ts       # Manual / Suggest / Draft / Autopilot enforcement
    escrow.functions.ts         # Stripe-held escrow logic
    fees.ts                     # Source of truth for 20% cap-$99 success fee math
    wallet.functions.ts         # Balance + Stripe Connect transfers
    qualification.functions.ts  # AI classifier for "qualified paid reply"
    reply-value.functions.ts    # $-value estimation for inbound replies
    journey.functions.ts        # First-deal 7-step journey state
    demo-mode.ts                # DEMO_OPPORTUNITIES + fastestToCashScore
    rate-helper.ts              # Creator pricing helper
    fees.ts, break-even.ts, ...
    mcp/                        # MCP tool definitions
    email-templates/
  integrations/
    supabase/                   # Auto-generated client (client.ts, client.server.ts, types.ts, auth-*.ts)
    lovable/                    # Auto-generated Lovable auth broker
  styles.css                    # Tailwind v4 tokens (light theme)
  router.tsx, start.ts, server.ts, routeTree.gen.ts

supabase/
  migrations/                   # 52 SQL migrations
  config.toml                   # Managed by Lovable — do not hand-edit

public/                         # Static assets
```

## Request flow

1. Browser hits Cloudflare Worker → TanStack SSR renders route.
2. Route loaders that need DB use `createServerFn` with the `requireSupabaseAuth` middleware; the client-side `attachSupabaseAuth` middleware in `src/start.ts` forwards the Supabase bearer token.
3. Chat routes (`/api/chat/agent`, `/api/chat/landing`, `/api/chat/onboarding`) stream from the AI gateway using the `ai` SDK; tools are declared inline and stream `InlineToolCard` payloads back to the chat panel.
4. Public endpoints under `/api/public/*` bypass auth by convention — every handler must verify a signature or shared secret (`STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, Resend HMAC).
5. Stripe webhooks land at `/api/public/stripe-webhook` and drive MatchAI subscription state only.
6. Creator outreach drafts and threads use the internal Inbox model. Sending and inbound synchronization remain explicitly unavailable until an approved transport and webhook are configured.

## Data model (summary)

46 tables in the `public` schema. Highlights:

- `profiles`, `user_roles` (roles kept in a separate table for privilege safety)
- `brand_matches`, `brand_contacts`, `outreach_campaigns`, `outreach_messages`
- `inbox_threads`, `inbox_messages`, `negotiations`
- `deals`, `deal_milestones` (creator-reported external payment status only)
- Legacy `escrow_holds`, `wallet_ledger`, `payout_attempts`, and Connect tables remain backend compatibility data and are not creator MVP surfaces.
- `agent_audit_log`, `analytics_events`, `error_events`, `suppression_list`
- `plans`, `subscriptions`, `usage_counters`
- `creator_setup`, `brand_kits`, `portfolio_items`

Full schema and RLS notes: `docs/DATABASE.md`.

## Auth & authorization

- Supabase Auth (email + Google) via `src/routes/auth.tsx`.
- Session token forwarded to server functions by `attachSupabaseAuth` middleware (`src/start.ts`).
- `requireSupabaseAuth` middleware guards protected server functions; the `_authenticated` route subtree gates authenticated pages.
- Roles live in `public.user_roles` and are checked via `public.has_role(uuid, app_role)` SECURITY DEFINER function (grants revoked from `public` and `authenticated` — see `docs/SECURITY.md`).

## What lives outside the repo

- Supabase project (schema is versioned in `supabase/migrations/`; data is not).
- Secrets (see `.env.example`).
- DNS, Stripe dashboard config, Resend domain, Gmail OAuth app.
- Cron schedules (currently invoked by Lovable; recreate as Cloudflare cron triggers).
