# Lovable Exit Checklist — Clean Migration Plan

**Migration mode: clean start.** We have no production users. Do NOT migrate
existing Supabase users, rows, or storage objects — they are development/test
data. Start a fresh, independently owned Supabase project and replay the
committed migrations.

Work top-to-bottom in a feature branch. Every item is a portability blocker.

---

## 0. Before you start

- [ ] Fresh clone builds: `bun install && bun run build`.
- [ ] `bun run lint` and `bunx tsgo` pass.
- [ ] Read `docs/PROJECT_CONTEXT.md` and `docs/CLOUD_STATE_INVENTORY.md`.

---

## 1. Create a new independently owned Supabase project

- [ ] Create a fresh Supabase project under your own org.
- [ ] Note the new URL, anon key, service-role key, and project ref.
- [ ] Do NOT import the Lovable-managed project's dump. Rows and users are
      disposable test data.
- [ ] Update local `.env` and Cloudflare Worker secrets with the new values
      (names in `docs/CLOUD_STATE_INVENTORY.md` §6).

## 2. Replay committed migrations (52 total)

- [ ] From an empty new project, run:
      `supabase link --project-ref <new-ref>` then
      `supabase db push` (or `supabase migration up`).
- [ ] Verify all 52 migrations apply cleanly.
- [ ] Confirm every `public.*` table has explicit `GRANT`s and RLS policies.
- [ ] Run `supabase db lint` and close the three financial-table RLS
      findings (see `docs/SECURITY.md`).

## 3. Recreate the `avatars` storage bucket

- [ ] Create bucket `avatars` as **private**.
- [ ] Add policies:
      - authenticated `SELECT/INSERT/UPDATE/DELETE` scoped to
        `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text`
      - `service_role` full access
- [ ] Leave the bucket empty — no objects to migrate.

## 4. Configure authentication

- [ ] Enable email/password. Leave the leaked-password (HIBP) check OFF —
      intentional product decision.
- [ ] Enable Google provider. Issue fresh OAuth client ID + secret in
      Google Cloud Console for the new redirect URL.
- [ ] Auth → URL Configuration → set Site URL to `https://www.matchapp.ai`.
- [ ] Add redirect allow-list entries (see §5).

## 5. Auth redirect URLs

- [ ] `https://www.matchapp.ai`
- [ ] `https://www.matchapp.ai/auth/callback`
- [ ] `http://localhost:8080`
- [ ] `http://localhost:8080/auth/callback`

## 6. Recreate secrets (regenerate every value)

Never copy values from the Lovable environment. Regenerate each one from
its source dashboard, then push via `wrangler secret put <NAME>`:

- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- [ ] `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`
- [ ] `APIFY_TOKEN`
- [ ] `CRON_SHARED_SECRET` (new random 32+ bytes)
- [ ] `AI_PROVIDER_API_KEY` (see §8; replaces `LOVABLE_API_KEY`)

Client-side `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID` go in `.env` (checked into `.env.example` with
placeholders).

## 7. Recreate cron jobs

Update the new deployment URL, then create the 5 pg_cron jobs listed in
`docs/CLOUD_STATE_INVENTORY.md` §3. Each cron POST must send
`x-cron-secret: <CRON_SHARED_SECRET>`.

- [ ] `/api/public/cron/daily-digest` — `0 15 * * *`
- [ ] `/api/public/cron/gmail-poll` — `*/10 * * * *`
- [ ] `/api/public/cron/qualify-replies` — `*/15 * * * *`
- [ ] `/api/public/cron/autopilot` — `*/5 * * * *`

Recreate pgmq queues: `q_email_outbound`, `q_email_inbound`, `q_agent_tasks`.

## 8. Replace every Lovable runtime dependency

- [ ] **AI Gateway** — replace `src/lib/ai-gateway.server.ts` with a direct
      provider (Google Gemini via `@google/generative-ai` or an
      OpenAI-compatible endpoint). Model stays `gemini-2.5-flash`.
      Remove `LOVABLE_API_KEY`.
- [ ] **Cloud Auth** — replace `src/integrations/lovable/*` and
      `appUserConnector.ts` with direct `supabase.auth.signInWithOAuth`.
      Remove `@lovable.dev/cloud-auth-js`.
- [ ] **Email** — swap `@lovable.dev/email-js` for the Resend SDK
      (`import { Resend } from 'resend'`) in `src/lib/email-templates/*`.
- [ ] **Webhooks HMAC** — replace `@lovable.dev/webhooks-js` in
      `src/routes/api.public.hooks.resend-inbound.ts` with
      `crypto.createHmac('sha256', RESEND_WEBHOOK_SECRET)` + `timingSafeEqual`.
- [ ] **Vite preset** — inline the exports of
      `@lovable.dev/vite-tanstack-config` into `vite.config.ts`.
- [ ] **MCP** — either port `src/routes/[.mcp]/*` + `src/lib/mcp/*` to
      `@modelcontextprotocol/sdk`, or delete the MCP routes and drop
      `@lovable.dev/mcp-js`.
- [ ] **Lovable-hosted OAuth consent** — delete
      `src/routes/[.]lovable.oauth.consent.tsx` if MCP is removed.
- [ ] **CDN assets** — the four `.asset.json` pointers under `src/assets/`
      route through `/__l5e/assets-v1/...`. Local copies of every binary are
      now committed. Post-migration, update the remaining
      `.asset.json` consumers (if any) to import the local `.png` / `.jpeg`
      directly, then delete the pointer files.

## 9. Deploy independently

- [ ] Provision Cloudflare Workers (`wrangler init` against this repo).
- [ ] Push all secrets via `wrangler secret put`.
- [ ] Move `www.matchapp.ai` DNS to Cloudflare and bind as Custom Domain.
- [ ] Update Stripe webhook URL → `https://www.matchapp.ai/api/public/stripe-webhook`.
- [ ] Update Resend inbound URL + verified sender domain.
- [ ] Update Gmail OAuth redirect URI.
- [ ] Update Apify webhook targets (if any).

## 10. End-to-end verification

- [ ] `bun run build` succeeds on a fresh clone.
- [ ] `bun run lint` succeeds.
- [ ] TypeScript check succeeds (`bunx tsgo`).
- [ ] All 52 migrations replay cleanly on a scratch Supabase project.
- [ ] Smoke test the full journey against the new deployment:
      sign up → onboarding → connect Gmail → generate pitch → send →
      receive reply → qualify reply → choose plan/free → record external
      payment status → deliver proof / track outcome externally.
- [ ] Verify Autopilot daily caps, CAN-SPAM footer, suppression list, and
      bad-offer banners still fire.
- [ ] Verify the three financial-table RLS findings are closed.

## 11. Decommission Lovable

- [ ] Only after the fresh deployment passes all smoke tests independently,
      unpublish and delete the Lovable project.
- [ ] Rotate any credential that was ever pasted into Lovable.

---

**Handoff synchronization timestamp (UTC):** 2026-07-29
