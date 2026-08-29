# Superseded by the UGC monetization rebuild

Per the Aug 28, 2026 build packet, MatchAI is no longer a brand-deal
marketplace — it's a product that turns a creator's own content into an AI
tool they sell to their own followers, with no brands involved. That's built
on `rebuild/ugc-monetization-v1` as new `ugc_*` tables and `api.*` routes
alongside the existing code, per the packet's own instruction: **inventory
and archive the old surface, don't delete production data until the new app
is proven.**

The following are the old brand-deal-marketplace product's core surface.
They still work and are not deleted in this pass — don't extend them, and
plan to remove them once the rebuild's acceptance tests pass and this repo
fully cuts over:

- `src/routes/dashboard.deals.tsx`, `dashboard.deals.$id.tsx` — brand deal pipeline
- `src/routes/dashboard.brands.tsx` — brand-side surface
- `src/routes/dashboard.campaigns.tsx` — brand campaign briefs
- `src/routes/api.chat.agent.ts`, `api.chat.landing.ts`, `api.chat.onboarding.ts` — the old outreach/matching agent
- `src/lib/escrow.functions.ts`, `wallet.functions.ts`, `fees.ts` — brand-to-creator escrow and the 20%-cap-$99 success-fee math (a different fee model from the rebuild's flat 20% platform cut)
- The 46-table brand-deal schema in `supabase/migrations/` prior to `20260829000000_ugc_monetization_rebuild.sql`

Cutover checklist (do this only once the new product is proven, not now):
- [ ] Run both products in parallel long enough to confirm no active brand deals are mid-flight
- [ ] Export/archive brand-deal data per whatever retention policy applies
- [ ] Remove the routes/functions above
- [ ] Drop the old tables in a dedicated migration (never bundle a drop with new work)
