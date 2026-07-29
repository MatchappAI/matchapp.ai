# Deployment (off Lovable)

Target runtime: **Cloudflare Workers** (`wrangler.jsonc`,
`compatibility_flags: ["nodejs_compat"]`, main entry `src/server.ts`).

## Prerequisites

- Cloudflare account + `wrangler` CLI (`npm i -g wrangler`).
- Supabase project you own (see `docs/DATABASE.md`).
- Stripe account for MatchAI subscriptions / billing.
- Resend account with a verified sending domain.
- (Optional) Gmail OAuth app for creator send-as.
- (Optional) Apify account for enrichment.
- (Optional) OpenAI / Google Generative AI key if leaving Lovable AI.

## One-time setup

```bash
git clone https://github.com/MatchappAI/showcase-smith-spot.git matchai
cd matchai
cp .env.example .env
bun install
wrangler login
```

Push every secret in `.env.example` to the Worker:

```bash
# Repeat for each secret name in .env.example (skip VITE_* — those are inlined at build)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put LOVABLE_API_KEY        # or OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
wrangler secret put APIFY_TOKEN
wrangler secret put CRON_SECRET
wrangler secret put GMAIL_OAUTH_CLIENT_SECRET
```

`VITE_*` values must be set in your CI/build environment (they are inlined
by Vite at build time, not read at runtime).

## Build & deploy

```bash
bun run build            # Vite → Cloudflare Worker bundle in dist/
wrangler deploy          # ships to *.workers.dev
```

## Cron triggers

Add to `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": [
    "0 13 * * *"     // daily-digest at 13:00 UTC (~9am ET)
    ,"*/10 * * * *"  // poll-replies every 10 min
    ,"*/15 * * * *"  // process-follow-ups every 15 min
    // No wallet / payout / Connect cron jobs in current product scope
  ]
}
```

Then add a `scheduled` handler in `src/server.ts` (see the Cloudflare
Workers docs) that dispatches each cron to the matching `/api/public/hooks/*`
handler using `CRON_SECRET`.

## Custom domain

1. Add `www.matchapp.ai` as a Custom Domain to the Worker in the
   Cloudflare dashboard.
2. Update DNS at the registrar to point the domain to Cloudflare.
3. Update Stripe webhook URL, Resend inbound URL, Gmail OAuth redirect
   URI, and Supabase auth redirect URL to the new host.

## Environment-specific tweaks

- `LOVABLE_API_KEY` is only needed if you keep using the Lovable AI
  Gateway. Otherwise replace the provider in `src/lib/ai-gateway.server.ts`.
- Lovable-hosted `@lovable.dev/email-js` calls Resend under the hood — no
  Lovable runtime dependency, but rerouting to the Resend SDK directly is
  a one-file change.
- MCP endpoints (`/api/mcp/*`, `/.well-known/oauth-protected-resource`)
  continue to work off Lovable, but the OAuth consent screen and token
  broker live under `@lovable.dev/mcp-js`. If you decommission Lovable,
  swap to `@modelcontextprotocol/sdk`.
