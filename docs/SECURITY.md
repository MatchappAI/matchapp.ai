# Security

## Baselines already in place

- RLS enabled on every `public` table; every migration also emits explicit
  `GRANT` statements (Supabase does not grant default privileges on
  `public`).
- Roles stored in `public.user_roles`, checked via SECURITY DEFINER
  `public.has_role(uuid, app_role)`. `EXECUTE` on that function is
  revoked from `public` and `authenticated` (see migration
  `20260528093747_*`).
- All SECURITY DEFINER functions pin `SET search_path = public`.
- Stripe webhook signature verified with `stripe.webhooks.constructEvent`
  (`src/routes/api.public.stripe-webhook.ts`).
- Resend inbound webhook signature verified via
  `@lovable.dev/webhooks-js` HMAC.
- Cron endpoints under `/api/public/hooks/*` gate on a shared
  `CRON_SECRET` header.
- CAN-SPAM footer + `suppression_list` enforced before every outbound
  send.
- Leaked-password (HIBP) check is currently **disabled** per product
  requirement ("allow them to use any type of passwords"). Re-enable via
  `supabase` → Auth → Password HIBP check if desired.
- Autopilot has hard daily send caps and a suppression check;
  cold-outreach templates cannot be sent as replies.

## Threat-model notes

- The service-role Supabase client (`src/integrations/supabase/client.server.ts`)
  is loaded via `await import(...)` inside verified handlers only. It
  bypasses RLS — never import at module scope in code that reaches the
  browser bundle.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
- `STRIPE_SECRET_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`,
  `APIFY_TOKEN`, `GMAIL_OAUTH_CLIENT_SECRET` are server-only.
- `VITE_*` env vars are inlined into the browser bundle — only use for
  publishable/anon keys.

## Unresolved findings from the last Lovable scan

The Lovable security scanner shows **4 findings** on this project. The two
labeled `SUPA_anon_security_definer_function_executable` and
`SUPA_authenticated_security_definer_function_executable` were already
fixed in migration `20260528093747_*` (`REVOKE EXECUTE ... ON FUNCTION
public.has_role FROM anon, authenticated, public`). The remaining
findings, per the prior conversation, are three RLS
privilege-escalation issues where creators could self-modify financial
statuses (deals, escrow, wallet). Recommended fix — audit every UPDATE
policy on `deals`, `escrow_holds`, `wallet_ledger`, `payout_attempts`,
`subscriptions` and ensure:

- `USING` and `WITH CHECK` both scope to `auth.uid() = user_id`.
- No policy allows `authenticated` to `UPDATE` status/amount/state
  columns; those transitions must go through a SECURITY DEFINER function
  invoked by a verified server handler, or a service-role write.

Track these as **open** until confirmed fixed by a new migration.
Re-run the Lovable scanner (or `supabase db lint`) after any RLS change.

## Secrets checklist

Never commit real values for anything in `.env.example`. Rotate secrets
that were ever exposed to Lovable's UI clipboard, chat, or logs before
production cutover.
