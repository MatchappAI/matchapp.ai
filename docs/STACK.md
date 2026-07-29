# MatchAI Stack — reconciled source of truth

This document reconciles the spreadsheet stack, the repository, and the handoff
docs into one repo-backed view. It intentionally excludes secret values.

## Current active stack

| Layer                   | Service                                               |                  Status | Role in MatchAI                                           | Notes                                                                                     |
| ----------------------- | ----------------------------------------------------- | ----------------------: | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Repository              | GitHub `MatchappAI/showcase-smith-spot`               |                  Active | Canonical codebase                                        | All build and publish work should land here first.                                        |
| App builder / preview   | Lovable                                               | Active for editing only | UI builder and preview surface                            | Not the source of truth for runtime behavior.                                             |
| Backend                 | Supabase                                              |                  Active | Auth, Postgres, storage, RLS, server-side data            | Current project is development/test state; fresh ownership is the migration target.       |
| Runtime host            | Cloudflare Workers                                    |         Active / target | Live app hosting                                          | `www.matchapp.ai` should point here after cutover.                                        |
| AI routing              | Lovable AI Gateway today; direct provider later       |    Active / replaceable | Agent/chat reasoning and structured generation            | Current code routes through Lovable; exit plan is a direct provider.                      |
| Creator inbox transport | Gmail                                                 |                  Active | Creator outreach + internal inbox sync                    | Creator-facing email identity and thread model.                                           |
| Product email           | Resend                                                |                  Active | MatchAI transactional / product email                     | Not for creator outreach.                                                                 |
| Payments                | Stripe                                                |                  Active | MatchAI subscriptions / billing only                      | No Connect, escrow, wallet, payouts, or success-fee UX.                                   |
| Brand/contact ingestion | Manual entry + CSV import + internal discovery engine |                  Active | Seed brands, contacts, profiles, scores, and review items | No chosen paid discovery/enrichment provider yet.                                         |
| Optional enrichment     | Apify / Hunter-style adapters                         |            Not selected | Future-only provider integration                          | Keep behind an adapter and honest “not configured” states; not required for v1 discovery. |
| Dev tooling             | Claude Code / Codex / Lovable                         |  Active for development | Build and continue the project                            | Not runtime dependencies.                                                                 |

## Sheet reconciliation notes

The spreadsheet rows map cleanly to the following status buckets:

- Active and in use:
  - GitHub
  - Supabase
  - Cloudflare
  - Gmail
  - Resend
  - Stripe for MatchAI billing
  - Manual brand database / CSV import
- Present in repo or docs but legacy / compatibility-only:
  - wallet, escrow, payout, Connect, success-fee flows
  - protected-payment cron jobs
  - legacy wallet/payment routes
- Not selected yet:
  - company discovery / enrichment provider
  - CRM / analytics / monitoring add-ons
  - public lead-enrichment SaaS dependency

## What this means for implementation

1. Keep the product story external-payment-only.
2. Keep the inbox as the authoritative creator communication model.
3. Keep manual + CSV brand/contact workflows first-class.
4. Treat the internal discovery engine as the source of truth for match scoring and review.
5. Treat wallet / escrow / payout / Connect code paths as legacy compatibility
   surfaces only unless the product direction changes explicitly.
6. Do not introduce a new provider dependency without a product decision.

## Source files to keep aligned with this document

- `docs/PROJECT_CONTEXT.md`
- `docs/INTEGRATIONS.md`
- `docs/HANDOFF_INVENTORY.md`
- `docs/LOVABLE_EXIT_CHECKLIST.md`
- `docs/DEPLOYMENT.md`
