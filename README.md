# MatchAI

**Find paid brand deals. Skip the cold DMs.**

MatchAI is a chat-first AI agent for UGC creators and micro-influencers who
want more paid brand deals. It finds fastest-to-cash opportunities, drafts
personalized pitches, manages replies in a unified inbox, negotiates,
protects payment via Stripe-held escrow, and pays out to the creator's
bank via Stripe Connect. The agent can operate at four autonomy levels
(Manual / Suggest / Draft / Autopilot).

Live: <https://www.matchapp.ai>
Preview: <https://showcase-smith-spot.lovable.app>

## Stack

TanStack Start v1 · React 19 · Vite 7 · Tailwind CSS v4 · Cloudflare
Workers · Supabase (Postgres, Auth, Storage, RLS) · Stripe · Resend ·
Gmail API · Apify · `ai` SDK (Google Gemini via Lovable AI Gateway today).

Full architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Fresh-clone setup

```bash
git clone https://github.com/MatchappAI/showcase-smith-spot.git matchai
cd matchai
cp .env.example .env             # fill in real values (see docs/INTEGRATIONS.md)
bun install                      # or npm install / pnpm install
bun run dev                      # http://localhost:8080
```

Database:

```bash
supabase login
supabase link --project-ref YOUR-SUPABASE-REF
supabase db push                 # replay supabase/migrations/*
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Detailed setup, migration replay, and cutover from Lovable:
[`HANDOFF.md`](./HANDOFF.md), [`docs/DATABASE.md`](./docs/DATABASE.md),
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Vite dev server on `:8080` |
| `bun run build` | Production Cloudflare Worker bundle |
| `bun run build:dev` | Development-mode build (source maps, no minify) |
| `bun run preview` | Preview the built worker |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `bunx tsgo --noEmit` | Type-check only |

No test runner is currently wired into the repo.

## Deployment

Target is Cloudflare Workers (`wrangler.jsonc`, `nodejs_compat`, entry
`src/server.ts`). See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for
`wrangler deploy` steps, cron triggers, and custom-domain setup.

## Docs index

- [`HANDOFF.md`](./HANDOFF.md) — Lovable → GitHub handoff summary
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Stack, routes, request flow
- [`docs/AI_SYSTEM.md`](./docs/AI_SYSTEM.md) — Prompts, models, tools, autonomy
- [`docs/DATABASE.md`](./docs/DATABASE.md) — Schema, migrations, RLS
- [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md) — Stripe, Resend, Gmail, Apify, MCP
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — Cloudflare Workers cutover
- [`docs/SECURITY.md`](./docs/SECURITY.md) — RLS, secrets, open findings
- [`docs/LOVABLE_EXIT_CHECKLIST.md`](./docs/LOVABLE_EXIT_CHECKLIST.md) — Step-by-step exit
- [`MATCHAI_CURRENT_STATE_AUDIT.md`](./MATCHAI_CURRENT_STATE_AUDIT.md) — Feature/state audit

## Known limitations at handoff time

- Runtime still depends on `@lovable.dev/*` packages and the Lovable AI
  Gateway — see [`docs/LOVABLE_EXIT_CHECKLIST.md`](./docs/LOVABLE_EXIT_CHECKLIST.md).
- Cron work is currently invoked by Lovable; must be recreated as
  Cloudflare cron triggers before decommissioning Lovable.
- No test suite yet.
- Three financial-table RLS findings from the last security scan remain
  open — see [`docs/SECURITY.md`](./docs/SECURITY.md).
