# MatchAI — Lovable → GitHub Handoff

**Repository:** `MatchappAI/showcase-smith-spot`
**Branch:** `main`
**Handoff timestamp (UTC):** 2026-07-29 02:19Z
**Handoff author:** Lovable agent on behalf of project owner

This document is the single entry point for resuming MatchAI development
outside of Lovable (in Codex, Claude Code, or any local environment).

---

## 1. What this repo is

A production TanStack Start v1 application (React 19 + Vite 7) deployed to
Cloudflare Workers, with a Supabase Postgres/Auth/Storage backend. Product
scope, UX, agent behavior, and pricing are preserved exactly as they existed
on the Lovable preview at the handoff timestamp — this commit is a
**pure export**, not a redesign.

See `README.md` for a one-page overview and `ARCHITECTURE.md` for the full map.

## 2. What actually shipped in this handoff

- Full source tree (`src/`, `public/`, `supabase/migrations/`) is already
  committed to Lovable's git remote, which mirrors two-way to
  `MatchappAI/showcase-smith-spot`.
- Documentation added/refreshed in this commit: `README.md`, `HANDOFF.md`,
  `ARCHITECTURE.md`, `CLAUDE.md`, `docs/AI_SYSTEM.md`, `docs/DATABASE.md`,
  `docs/DEPLOYMENT.md`, `docs/INTEGRATIONS.md`, `docs/SECURITY.md`,
  `docs/LOVABLE_EXIT_CHECKLIST.md`, `.env.example`.
- No secrets, no `node_modules`, no build output, no user data.

## 3. What Lovable did that GitHub does NOT

The following state lives outside git and cannot be exported by a code push:

| State | Where it lives | Action for Codex |
|---|---|---|
| Supabase database rows (auth users, deals, wallet ledger, etc.) | Lovable-managed Supabase project | Export via Lovable Cloud → Advanced → Export data before decommissioning. |
| Supabase storage bucket contents (brand kits, portfolio uploads) | Lovable-managed Supabase Storage | Download via storage API or `supabase storage cp` with service-role key. |
| Real secret values (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `APIFY_TOKEN`, Stripe webhook secret, Gmail OAuth secret) | Lovable secrets vault | Recreate manually in the new host's env / secret manager. |
| Custom domain DNS (`www.matchapp.ai`) | Lovable Domains + registrar | Repoint DNS to the new host after cutover. |
| Cron schedules for `/api/public/hooks/*` | Lovable-invoked schedules (per-project) | Recreate as Cloudflare cron triggers or an external scheduler (see `docs/DEPLOYMENT.md`). |
| Lovable AI Gateway usage / billing | Lovable workspace | Swap `LOVABLE_API_KEY` for a direct provider key — see `docs/AI_SYSTEM.md`. |

## 4. Runtime dependencies still tied to Lovable

These npm packages ship a Lovable-hosted runtime dependency. They work today
because `LOVABLE_API_KEY` is minted by the Lovable workspace, and they must be
replaced before Lovable can be decommissioned:

- `@lovable.dev/cloud-auth-js` — OAuth broker used only by
  `src/integrations/lovable/index.ts` for the "sign in with Google/Apple/
  Microsoft" button. Direct replacement: call
  `supabase.auth.signInWithOAuth` and configure providers in Supabase.
- `@lovable.dev/mcp-js` — MCP server SDK for the `/api/mcp/*` and
  `/.well-known/oauth-protected-resource` routes. Can stay if you keep
  Lovable Cloud; otherwise swap to an OSS MCP server (e.g. `@modelcontextprotocol/sdk`).
- `@lovable.dev/email-js` — thin wrapper around Resend. Replaceable by
  calling the Resend SDK directly with `RESEND_API_KEY`.
- `@lovable.dev/webhooks-js` — HMAC verifier used by inbound Resend
  webhook. Replaceable with a ~15-line `createHmac` verifier.
- `@lovable.dev/vite-tanstack-config` — Vite preset. Can be inlined into
  `vite.config.ts` if leaving Lovable.
- `src/lib/ai-gateway.server.ts` — sends every LLM call to
  `https://ai.gateway.lovable.dev/v1`. Swap `baseURL` + auth header to
  point at OpenAI, Google, or a self-hosted gateway.

Full remediation plan: `docs/LOVABLE_EXIT_CHECKLIST.md`.

## 5. What was preserved

- All 45 routes under `src/routes/` (landing, dashboard tabs, onboarding, MCP, webhooks, public API).
- All 52 SQL migrations under `supabase/migrations/`.
- All AI prompt code (`src/lib/agent-voice.server.ts`, `src/lib/agent-context.server.ts`, chat routes under `src/routes/api.chat.*`).
- Design system in `src/styles.css` and `src/components/ui/*`.
- All product features listed in `MATCHAI_CURRENT_STATE_AUDIT.md`.

No product feature, copy string, route, migration, or component was removed
or altered in this handoff.

## 6. Fresh-clone quickstart

```bash
git clone https://github.com/MatchappAI/showcase-smith-spot.git matchai
cd matchai
cp .env.example .env                # fill in real values
bun install                         # or: npm install
bun run build                       # verify Cloudflare Workers build
bun run dev                         # http://localhost:8080
```

Full setup, including Supabase migration replay and Stripe/Resend
configuration: `README.md` → *Fresh-clone setup*.

## 7. Next step for Codex

1. Clone the repo and complete *Fresh-clone quickstart* above.
2. Work through `docs/LOVABLE_EXIT_CHECKLIST.md` top-to-bottom in a feature
   branch — every checkbox is a portability blocker.
3. Migrate the Supabase project ownership (or export the DB) before the
   Lovable workspace is decommissioned.
4. Recreate secrets in Cloudflare (or your new host) using `.env.example`
   as the canonical list.

Do not delete the Lovable project until a fresh clone of the GitHub repo
builds, deploys, and serves the app end-to-end against an independent
Supabase project.
