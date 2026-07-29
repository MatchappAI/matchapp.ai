# External integrations

This table is aligned with `docs/STACK.md` and separates active product
dependencies from legacy compatibility code.

| Service                     | Status         | Purpose                                                                        | Env vars                                                                                                          | Code entry points                                                                                                                                          | Notes                                                                 |
| --------------------------- | -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Supabase                    | Active         | Postgres, Auth, Storage, RLS                                                   | `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*` | `src/integrations/supabase/*`                                                                                                                              | Auto-generated; do not edit.                                          |
| Lovable AI Gateway          | Active for now | LLM proxy                                                                      | `LOVABLE_API_KEY`                                                                                                 | `src/lib/ai-gateway.server.ts`                                                                                                                             | Replace with direct provider when leaving Lovable.                    |
| Stripe                      | Active         | MatchAI subscriptions / billing only                                           | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`                                       | `src/lib/payments.functions.ts`, `src/routes/api.public.stripe-webhook.ts`, `src/routes/pay.$id.tsx`                                                       | No Connect, escrow, wallet, or creator payout flows.                  |
| Resend                      | Active         | MatchAI transactional/product email                                            | `RESEND_API_KEY`                                                                                                  | `src/lib/email-templates/*`                                                                                                                                | Not used for creator outreach.                                        |
| Creator email transport     | Not configured | Internal Inbox drafts and approval model; outbound/inbound provider pending    | `CREATOR_EMAIL_PROVIDER`                                                                                          | `src/lib/creator-email-transport.server.ts`, `src/lib/creator-email-identity.functions.ts`                                                                 | No Gmail requirement; drafts remain usable without a provider.        |
| Manual brand/contact import | Active         | Brand + contact entry, validation preview, dedupe, internal discovery analysis | (none)                                                                                                            | `src/lib/brand-contacts.functions.ts`, `src/lib/brand-library.functions.ts`, `src/lib/discovery-engine.functions.ts`, `src/lib/onboarding-v3.functions.ts` | Default path. No paid provider is required for the first-pass engine. |
| Cloudflare Workers          | Active         | Runtime host                                                                   | (none)                                                                                                            | `wrangler.jsonc`, `src/server.ts`                                                                                                                          | `nodejs_compat` enabled.                                              |
| MCP (Lovable)               | Legacy         | Agent tools exposed over MCP                                                   | `LOVABLE_API_KEY`                                                                                                 | `src/routes/[.mcp]/*`, `src/lib/mcp/*`                                                                                                                     | Keep only if still needed; otherwise replace or delete during exit.   |

## Webhook / callback URLs to configure post-cutover

- Stripe → `https://<host>/api/public/stripe-webhook`
- Creator inbound webhook → not configured in the MVP
- Supabase auth redirect → `https://<host>/auth/callback`

## Important scope note

The repository still contains legacy wallet / escrow / payout routes and helper
functions. They are compatibility surfaces only and must not be described as
active product capabilities in user-facing copy or docs.
