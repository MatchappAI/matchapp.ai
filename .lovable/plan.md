# Earnings-First Opportunity Experience

Purely additive layer on top of today's dashboard/chat/outreach. Nothing existing is removed, renamed, or restyled.

## 1. Data model (demo-mode extension)

Extend `DemoOpportunity` in `src/lib/demo-mode.ts` with the earnings-first fields the cards need. Real matches from `brand_matches` map into the same shape via a thin adapter in a new `src/lib/ways-to-earn.ts`.

New per-opportunity fields:
- `earnType`: `"quick" | "ugc_match" | "licensing" | "sponsored" | "repeat_brand" | "monthly_retainer"`
- `effort`: `"5 min" | "1 hr" | "half day" | "full day" | "recurring"`
- `deliverables`: `string[]` (e.g. `["1 raw clip, 15s"]`)
- `deadline`: ISO date + friendly "closes in 3d" label
- `usageRights`: short string (e.g. "Paid social, 90 days")
- `newContentRequired`: `boolean` (licensing/raw = false)
- `progress`: `"prepared" | "approved" | "sent" | "delivered" | "replied" | "negotiating" | "won" | "paid"` (default `"prepared"`)

Seed 4 new "smaller/faster" demo entries so the mix is visible on first load:
- Raw skincare footage license — $180
- 15-sec product-demo hook — $220
- Existing Reel licensing (90-day paid social) — $450
- Repeat launch with a previous partner — $900–$1,400

## 2. New "Ways to Earn" section

Create `src/components/dashboard/WaysToEarn.tsx`. Renders under (not replacing) the existing "Matched to your content · Top 6 fastest-to-cash" strip on `/dashboard/brands` and `/dashboard/index`.

Layout:
- Section header: "Ways to Earn" + one-line explainer.
- Category chips (filter, not tabs, so nothing else moves): All · Quick earnings · Matched UGC · Licensing · Sponsored · Repeat brand · Monthly retainer.
- 2-column card grid (matches current dashboard 2x2 rhythm).

Each `OpportunityCard` shows in order:
1. Category pill + source pill + match-confidence pill
2. Brand + one-line why-match
3. Pay range (large) · Effort · Deadline countdown
4. Deliverables list (bulleted, `break-words`)
5. Usage rights line
6. "New content required" / "Uses content you already have" line
7. Progress bar (8 steps, current step highlighted)
8. Single primary action: **Pursue** (`Sparkles` icon)

`Pursue` calls the existing `askAgentInChat(...)` helper with an earn-type-specific prompt so MatchAI runs the existing pipeline (portfolio pick → offer → price → outreach → approval request). No new backend workflow.

## 3. Progress bar component

`src/components/dashboard/OpportunityProgress.tsx` — 8 pips labeled Prepared → Paid, current step filled, completed steps solid, future steps ghosted. Reused by cards and by the inbox thread header (small variant).

## 4. Proactive notifications

New `src/components/dashboard/EarningsNudges.tsx` — small stacked banner above Ways to Earn. Derives 1–3 nudges from the opportunity list using deterministic rules (no new AI call):
- Count of new opps this week → "You have N new ways to earn."
- Any `ugc_match` with recent-content tie → "Your recent {matchedContent} matches a ${min}–${max} opportunity."
- Any `licensing` → "This brand may license content you already created."
- Any `repeat_brand` → "A previous partner has a new product launch."
- Any deadline < 48h → "This opportunity closes soon. Want me to pursue it?"

Each nudge has a `Pursue` button that opens the matching opportunity in chat via `askAgentInChat`.

Also emit a browser Notification (with permission prompt gated behind a one-time "Turn on alerts" pill) for the same messages, and push to the existing chat panel as an agent message when the tab is focused — reusing `askAgentInChat` / existing agent-injected message path. No push infra, no service worker — this is opt-in Web Notifications only, which is the correct mobile-friendly primitive today.

## 5. Chat-first bias

- Existing `FastestToCashStrip` stays untouched.
- WaysToEarn cards do not open modals or new tabs; every action funnels into the current chat panel exactly like existing "Pursue opportunity".
- Inbox thread header (`src/routes/dashboard.inbox.tsx`) gets the small `OpportunityProgress` bar so the same 8-step model is visible wherever a deal lives.

## Files touched

New:
- `src/lib/ways-to-earn.ts` — adapter + nudge derivation
- `src/components/dashboard/WaysToEarn.tsx`
- `src/components/dashboard/OpportunityProgress.tsx`
- `src/components/dashboard/EarningsNudges.tsx`

Edited (additive only):
- `src/lib/demo-mode.ts` — extend type, add 4 seed rows, backfill new fields on existing rows
- `src/routes/dashboard.brands.tsx` — mount `<EarningsNudges />` + `<WaysToEarn />` under the existing strip
- `src/routes/dashboard.index.tsx` — mount `<WaysToEarn />` below current content
- `src/routes/dashboard.inbox.tsx` — small progress bar in thread header

## Not doing

- No schema migration (uses existing `brand_matches` + demo data; progress derives from existing status columns via the adapter).
- No changes to pricing, agent voice, landing page, outreach sender, or auth.
- Not touching the 3 security findings shown in current view — they're unrelated to this request.
