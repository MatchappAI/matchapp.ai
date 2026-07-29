# External integrations

| Service | Purpose | Env vars | Code entry points | Notes |
|---|---|---|---|---|
| Supabase | Postgres, Auth, Storage, RLS | `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*` | `src/integrations/supabase/*` | Auto-generated; do not edit. |
| Lovable AI Gateway | LLM proxy (default provider today) | `LOVABLE_API_KEY` | `src/lib/ai-gateway.server.ts` | Swap `baseURL` + header to leave Lovable. |
| Stripe | Subscriptions + Connect payouts + escrow | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `VITE_STRIPE_PUBLISHABLE_KEY` | `src/lib/escrow.functions.ts`, `src/lib/wallet.functions.ts`, `src/routes/api.public.stripe-webhook.ts`, `src/routes/pay.$id.tsx` | Webhook signature verified via `stripe.webhooks.constructEvent`. |
| Resend | Transactional email + digests + inbound webhook | `RESEND_API_KEY` | `src/lib/email-templates/*`, `src/routes/api.public.hooks.resend-inbound.ts` (via `@lovable.dev/email-js` + `@lovable.dev/webhooks-js`) | Inbound HMAC verified by `@lovable.dev/webhooks-js`. |
| Gmail API | Creator send-as / reply polling | `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI` | `src/lib/gmail.functions.ts`, `src/routes/api.public.hooks.poll-replies.ts` | Requires per-creator OAuth consent. |
| Apify | Brand + contact enrichment | `APIFY_TOKEN` | `src/lib/apify.functions.ts`, `src/lib/apify.server.ts` | Called from server functions only. |
| Cloudflare Workers | Runtime host | (none) | `wrangler.jsonc`, `src/server.ts` | `nodejs_compat` enabled. |
| MCP (Lovable) | Agent tools exposed over MCP | `LOVABLE_API_KEY` | `src/routes/[.mcp]/*`, `src/lib/mcp/*` | OSS alternative: `@modelcontextprotocol/sdk`. |

## Webhook / callback URLs to configure post-cutover

- Stripe → `https://<host>/api/public/stripe-webhook`
- Resend inbound → `https://<host>/api/public/hooks/resend-inbound`
- Gmail OAuth redirect → `https://<host>/api/gmail/callback` (see `src/lib/gmail.functions.ts`)
- Supabase auth redirect → `https://<host>/auth/callback`
