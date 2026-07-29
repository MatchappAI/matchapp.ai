# Cloud State Inventory (Read-Only Snapshot)

Snapshot of the Lovable-managed cloud state at handoff. **All users and
database rows in the current Supabase project are disposable
development/test data — do NOT migrate them.** The exit plan creates a new,
independently owned Supabase project and replays committed migrations only.

No secret values are included in this file. Where a secret was previously
stored, only the variable name is listed.

---

## 1. Supabase project (current, Lovable-managed)

| Property | Value |
|---|---|
| Region | AWS `eu-west-1` |
| Public tables | 50 (in `public` schema) |
| Applied migrations | 52 (all committed in `supabase/migrations/`) |
| Auth users | 14 — **all test accounts, disposable** |
| DB rows | dev-only seed and test data — **disposable** |

> ⚠️ Do not migrate rows or users. Start empty on the new project.

---

## 2. Supabase Storage

| Bucket | Access | Size | Notes |
|---|---|---|---|
| `avatars` | Private | ~2 MB | Recreate empty on the new project. |

Policies to recreate on the new project:
- Authenticated users can `SELECT` / `INSERT` / `UPDATE` / `DELETE` only
  objects whose path is prefixed with their own `auth.uid()`.
- Service role has full access.

---

## 3. Cron jobs (pg_cron)

Currently 5 jobs pointing at hard-coded Lovable preview URLs. Recreate on
the new deployment URL. Endpoints all live under `/api/public/*` and
verify signatures internally.

| Purpose | Schedule (UTC) | Endpoint |
|---|---|---|
| Daily digest email | `0 15 * * *` | `/api/public/cron/daily-digest` |
| Gmail reply poll | `*/10 * * * *` | `/api/public/cron/gmail-poll` |
| Qualification sweep | `*/15 * * * *` | `/api/public/cron/qualify-replies` |
| Wallet payout retry | `*/30 * * * *` | `/api/public/cron/payout-retry` |
| Autopilot tick | `*/5 * * * *` | `/api/public/cron/autopilot` |

Each job POSTs with header `x-cron-secret: <CRON_SHARED_SECRET>` which the
handler validates via `timingSafeEqual`.

---

## 4. Message queues (pgmq)

| Queue | Purpose |
|---|---|
| `q_email_outbound` | Outbound email send jobs |
| `q_email_inbound` | Parsed inbound Resend webhook payloads |
| `q_agent_tasks` | Autopilot deferred agent work |

Recreate on the new Postgres via the pgmq extension.

---

## 5. Auth configuration

- Email/password enabled. HIBP leaked-password check intentionally OFF.
- Google OAuth enabled. Recreate under the new Supabase project's
  Auth → Providers (client ID / secret must be issued fresh in Google Cloud
  Console for the new redirect URL).
- Site URL and redirect allow-list must include:
  - `https://www.matchapp.ai`
  - `https://www.matchapp.ai/auth/callback`
  - localhost dev: `http://localhost:8080` + `/auth/callback`

---

## 6. Secrets (names only — regenerate all values)

| Name | Purpose |
|---|---|
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged writes only |
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect OAuth |
| `RESEND_API_KEY` | Transactional + inbound email |
| `RESEND_WEBHOOK_SECRET` | Resend inbound HMAC |
| `GMAIL_OAUTH_CLIENT_ID` | Gmail sends |
| `GMAIL_OAUTH_CLIENT_SECRET` | Gmail sends |
| `APIFY_TOKEN` | Brand/lead scraping |
| `CRON_SHARED_SECRET` | pg_cron ↔ Worker auth |
| `LOVABLE_API_KEY` | ⚠️ Remove after AI gateway swap |

Client-side (`VITE_*`) vars are safe to commit and are already documented
in `.env.example`.

---

## 7. Migrations

- Count: 52
- Location: `supabase/migrations/`
- All committed to git — the new project is set up by running them in order
  against an empty Postgres.

---

## 8. Outstanding security findings

Three RLS findings related to financial-table privilege escalation
(`deals`, `brand_matches`, `negotiations`) are documented in
`docs/SECURITY.md`. Close on the new project before onboarding real users.

---

## 9. What still exists only inside Lovable

- **`@lovable.dev/*` runtime packages** — see LOVABLE_EXIT_CHECKLIST for
  1:1 replacements.
- **AI Gateway routing** — `LOVABLE_API_KEY` routes to Gemini today; swap
  to a direct provider.
- **Lovable-hosted OAuth consent screen** at `src/routes/[.]lovable.oauth.consent.tsx`
  (only needed if you keep the Lovable MCP flow).
- **CDN-hosted assets** — the four `.asset.json` pointers under
  `src/assets/` reference `/__l5e/assets-v1/...`. Local copies of the same
  binary files are now committed alongside them (see Section 10).
