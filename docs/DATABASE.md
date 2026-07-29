# Database

## Where it lives

Supabase Postgres. During the Lovable era, the project is hosted inside
Lovable Cloud (project ref stored in `SUPABASE_PROJECT_ID`). After
handoff you have two options:

1. **Take ownership of the same project** — request project transfer
   through Lovable support; env vars stay the same.
2. **Migrate to a new Supabase project** — apply `supabase/migrations/`
   with the Supabase CLI, then export/import data.

## Applying migrations to a fresh project

```bash
# Install Supabase CLI (>= 1.200):  https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR-NEW-PROJECT-REF
supabase db push          # applies every file in supabase/migrations/
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

`supabase/migrations/` contains 52 timestamped SQL files. They are the
authoritative schema — never mutate the DB out-of-band. Always add a new
migration.

## Data export from Lovable

Lovable UI → **Cloud → Advanced settings → Export data**. This produces a
dump that can be restored with `psql` against the new project.
Alternatively, run `pg_dump` against the current DB using the
Lovable-provided connection string.

## Storage buckets

Buckets are declared in migrations (search `storage.create_bucket` and
`storage.buckets`). Bucket contents (user uploads) do not travel with
migrations. Mirror with:

```bash
supabase storage cp --recursive \
  supabase://OLD-PROJECT-REF/<bucket> \
  supabase://NEW-PROJECT-REF/<bucket>
```

## RLS conventions

- Every `public` table has RLS enabled.
- Every migration that creates a `public` table also issues explicit
  `GRANT` statements (default privileges are not granted on `public`).
- User-scoped tables: policies use `auth.uid() = user_id`.
- Role checks go through `public.has_role(auth.uid(), 'admin'::app_role)`
  (SECURITY DEFINER, `search_path = public`, execute revoked from
  `public` and `authenticated`).
- Legacy financial tables (`wallet_ledger`, `escrow_holds`, `payout_attempts`,
  related deal fields) remain in the schema for historical compatibility;
  the current product scope treats creator-brand payment as external and
  should not present wallet, escrow, payout, or Connect flows as active.

## Key tables

| Table                                            | Purpose                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `profiles`                                       | Creator profile, links to `auth.users`                                     |
| `user_roles`                                     | `(user_id, app_role)` — never store roles on `profiles`                    |
| `brand_matches`                                  | Ranked brand opportunities per user                                        |
| `brand_contacts`                                 | Contact discovery per brand                                                |
| `outreach_campaigns`, `outreach_messages`        | Cold outreach; unique index enforces one active campaign per (user, brand) |
| `inbox_threads`, `inbox_messages`                | Unified brand inbox                                                        |
| `negotiations`                                   | Structured negotiation events                                              |
| `deals`, `deal_milestones`                       | Deal lifecycle                                                             |
| `escrow_holds`                                   | Legacy protected-payment records                                           |
| `wallet_ledger`                                  | Legacy payment ledger                                                      |
| `payout_attempts`                                | Legacy payout attempt records                                              |
| `analytics_events`, `error_events`               | Observability                                                              |
| `agent_audit_log`                                | Every agent tool call                                                      |
| `suppression_list`                               | CAN-SPAM unsubscribes                                                      |
| `plans`, `subscriptions`, `usage_counters`       | Billing                                                                    |
| `creator_setup`, `brand_kits`, `portfolio_items` | Onboarding artifacts                                                       |

## Cron / scheduled work

Currently invoked by Lovable via HTTP. Routes:

- `/api/public/hooks/daily-digest` — nightly digest email
- `/api/public/hooks/poll-replies` — pull Gmail replies
- `/api/public/hooks/process-follow-ups` — send scheduled follow-ups
- `/api/public/hooks/auto-release-escrow` — legacy protected-payment route; keep disabled in production scope
- `/api/public/hooks/resend-inbound` — Resend inbound webhook (uses `@lovable.dev/webhooks-js` HMAC)
- `/api/public/hooks/health` — liveness

Replace Lovable's invocations with Cloudflare Workers cron triggers
(`wrangler.jsonc` → `triggers.crons`). Each handler must continue to
verify `CRON_SECRET` or its provider signature.
