# MatchAI — Current State Audit
_Read-only, factual snapshot as built. Nothing was changed to produce this document._

> **Legend**
> ✅ Fully functional · 🟡 Partially functional · 🎨 UI-only / mocked · 🧷 Hardcoded ·
> 🔌 Connected to real data · 🐛 Broken · ⛔ Missing · ❓ Unclear / unable to verify

---

## 1. Product overview

- **What it does today.** MatchAI is a chat-first web app for solo creators. A resident AI "agent" (Lovable AI Gateway → `google/gemini-2.5-pro` for drafting, `google/gemini-2.5-flash` for chat, `google/gemini-3-flash-preview` for the landing chat, `google/gemini-3.6-flash` for reply classification/reply-value) generates:
  - a ranked list of brand matches for the creator's niche/audience,
  - AI outreach drafts (with a signals-used JSON schema and a quality-check block),
  - reply classification (qualified paid interest, gifted-only, rejection, etc.),
  - rate/negotiation guidance,
  - a "protected payment" (escrow) link via Stripe Checkout,
  - and payouts through Stripe Connect Express + an internal wallet ledger.
- **Apparent target customer.** Solo micro/nano creators (~1K–100K followers) in fashion, beauty, skincare, fitness, food, lifestyle. Landing calls out "For creators doing this solo — no manager, no agency, no monthly retainer." Onboarding presets niches to `Fitness, Beauty, Tech, Gaming, Food, Travel, Fashion, Finance, Lifestyle, Education, Comedy, Music`.
- **Value proposition.** "Find brands, draft outreach in your voice, follow up, handle replies, price deals, get paid — with one personal agent." Emphasized as chat-first with a live "AgentCursor" that moves around the right-hand stage.
- **Primary user journey.** Landing → sign up (email/password + Google OAuth) → single-screen onboarding (name, niche, platform handles) → dashboard (50/50 chat + stage) → brand matches populate (background AI + Apify + Hunter) → agent drafts pitch → creator taps Send now on the inline chat card → outreach sent via Resend from `outreach@notify.www.matchapp.ai` → reply arrives via `api.public.hooks.resend-inbound.ts`, is classified, surfaces in Approvals → agent drafts reply / negotiates → creator marks the opportunity as a deal → creator issues a `/pay/$id` Stripe Checkout link → brand funds escrow → creator marks delivered → release → 3 % platform fee, remainder credits `wallet_ledger` → Stripe Connect transfer (auto or manual).
- **Business model.** "Outcome-based": Free forever with 20 % success fee (capped $99/deal, waived on repeat deals with the same brand). Paid plans: **Starter $49** (10 % fee), **Growth $99** (0 % fee), **Pro $199** (0 % fee). Every plan is monthly; annual is not offered. Success fee is locked on the deal at acceptance and never changes retroactively (`src/lib/pricing-config.ts`). There is also a hard-coded **3 %** "platform fee" on escrow releases (`escrow.functions.ts` / `agent-chat` `requestBrandPayment`) that is inconsistent with the pricing page — see §12.
- **Before/after payment.** Before: nothing gates outreach or matches on Free — quotas are 100 pitches/mo (via `PLANS.free.monthlyPitchQuota = 25` in `plans.ts` but the landing/pricing UI says 100; see inconsistency §12). After a "qualified paid reply" arrives, `qualification.functions.ts` flips `profiles.free_access_status` from `unrestricted` → `pricing_decision_required` and shows the `QualifiedOpportunityScreen` where the creator picks Stay Free (20 %) vs a subscription (0/10 %).
- **What "free until a brand wants to pay you" means.** The `classifyReply` function runs on every inbound; if class ∈ {`qualified_paid_interest`, `negotiation_started`, `request_for_rates`} with confidence ≥ 0.7 (or gifted_only when the creator opted in), the profile is flipped and `agent_activity` writes a "Qualified brand reply — choose how to proceed" row. This lock is enforced at the profile flag; success-fee charging itself is **not automated** — see §12.
- **What it currently is.** A hybrid: AI assistant (chat-first) + lightweight CRM (deals, approvals, wallet) + outreach automation (Resend + follow-up cron) + payments rail (Stripe Checkout escrow + Connect payouts). It is **not** a marketplace (brands never log in), **not** an agency (no human in the loop), and **not** a full inbox/IMAP client.

---

## 2. Complete screen and route inventory

**Public**
| Route | Purpose | Data | Auth | Notes |
|---|---|---|---|---|
| `/` | Marketing landing | Static + LandingAgentChat (LLM streaming) | no | ✅ live |
| `/trust` | Trust/security page | Static | no | ✅ live |
| `/auth` | Sign in / sign up | Supabase Auth + Google OAuth | no | ✅ live, honors `?tab=`, `?plan=`, `?next=` |
| `/reset-password` | Password reset | Supabase | no | ✅ |
| `/unsubscribe` + `/email/unsubscribe` | Unsub token → `suppression_list` | 🔌 | no | ✅ |
| `/pay/$id` | Brand-facing escrow funding page | Stripe Checkout link | no | ✅ (`public-pay.functions.ts`) |
| `/checkout/return` | Post-Stripe subscription return | `finalizeCheckout` | signed in | ✅ |
| `/home` | Placeholder | 9 lines | no | 🎨 near-empty |

**Onboarding**
| `/onboarding` | Single-screen: name, niche, handles | writes `profiles`, `creator_profiles`, kicks Apify + AI in bg | ✅ | Files `onboarding.step-1.tsx` / `-2` / `-3` exist but are 7–9-line **stubs** — legacy multi-step is dead code. |

**Dashboard (all `_authenticated`-style gated in `dashboard.tsx` `beforeLoad`)**
| Route | Purpose | Real data? | Status |
|---|---|---|---|
| `/dashboard` | 50/50 chat + stage shell (DashboardChatPanel + AgentCursor + DemoBanner) | 🔌 | ✅ |
| `/dashboard/index` | Default landing (redirects to /brands via link) | 8-line stub | 🎨 stub |
| `/dashboard/brands` (845 LOC) | Brand matches list + First Deal Journey + Overnight Digest + FastestToCash strip | mix: real matches from `brand_matches` + `DEMO_OPPORTUNITIES` hardcoded when `DEMO_MODE=true` (which is `true` project-wide) | 🟡 |
| `/dashboard/approvals` (697 LOC) | Pending approvals: outreach drafts, reply drafts, dispute/release cards | 🔌 real | ✅ |
| `/dashboard/deals` (487 LOC) + `/dashboard/deals/$id` (568) | Deal pipeline + detail (deliverables, escrow, contract) | 🔌 real | ✅ |
| `/dashboard/campaigns` (424 LOC) | Brand-side style briefs (`outreach_campaigns.brief` JSONB) | 🔌 | 🟡 minimal UI |
| `/dashboard/wallet` (287 LOC) | Ledger + manual payout + Stripe Connect + break-even nudge | 🔌 | ✅ |
| `/dashboard/analytics` (138 LOC) | Basic charts | pulls `analytics.functions.ts`; mostly counts, no event pipeline | 🟡 |
| `/dashboard/settings` (1171 LOC) | Profile, socials, payouts, billing, notif prefs, agent personalization, compliance, creator setup | 🔌 | ✅ (dense) |
| `/dashboard/admin` + `/admin/index` | Staff-only; role check via `getMyRoles` | 🔌 (limited) | 🟡 minimal |

**Server / API / webhooks**
- `/api/chat/agent` — streaming agent chat (Bearer-validated raw route). ✅
- `/api/chat/landing` — public landing chat. ✅
- `/api/chat/onboarding` — chat during onboarding. ✅
- `/api/landing-chat.ts` — duplicate scaffold. ❓ (looks like an unused alt)
- `/api/public/hooks/health` ✅
- `/api/public/hooks/poll-replies` — placeholder 36 LOC (mostly a no-op — Gmail poll only). 🟡
- `/api/public/hooks/process-follow-ups` — sends `+2d/+5d/+9d` follow-ups (`follow_up_sequences`). ✅
- `/api/public/hooks/auto-release-escrow` — cron auto-release. ✅
- `/api/public/hooks/daily-digest` — daily digest via Resend. ✅
- `/api/public/hooks/resend-inbound` — Resend inbound webhook → `outreach_emails.brand_reply_text` + `replied=true`. ✅
- `/api/public/email/open/$tid.gif` + `.click/$tid` — open/click pixel and redirect. ✅
- `/api/public/stripe-webhook` — Stripe webhook, HMAC-verified, idempotent via `stripe_processed_events` table, handles checkout, subscription lifecycle, disputes. ✅
- `/[.mcp]/list-tools` + `/[.mcp]/invoke-tool/$tool` + `/[.]lovable.oauth.consent` + `/.well-known/oauth-protected-resource` — MCP server exposing 4 tools (`list-brand-matches`, `list-deals`, `list-pending-approvals`, `get-profile`). ✅
- `/mcp` — MCP handshake alias. ✅
- `/lovable/email/queue/process`, `/lovable/email/transactional/send`, `/lovable/email/transactional/preview`, `/lovable/email/suppression` — auth email + queue-driven transactional sending. ✅

**Hidden/unfinished**
- `onboarding.step-1|2|3.tsx` — dead stubs kept for legacy links.
- `dashboard.index.tsx` — 8-line stub (does not use the landing message compose).
- `home.tsx` — 9-line stub.
- `api/landing-chat.ts` under a nested `/api/` dir — appears superseded by the flat `api.chat.landing.ts`.

Mobile: single mobile chat button + slide-over drawer on dashboard (not a mobile-optimized layout).

---

## 3. Landing page audit (verbatim copy)

**Navigation (`Navbar.tsx`)**: "MatchAI" wordmark + logo, links to `#pricing`, `#faq`, and CTA `Sign in` / `Start free`.

**Hero (`Hero.tsx`)**
- H1: **"Land paid brand deals. Skip the cold DMs."**
- Sub: "Your AI manager finds the right brands, writes the pitch in your voice, negotiates, and tracks and helps secure your payment so you actually get paid. You just tap **Approve**."
- CTAs: "Start free — first match in 2 min →" and "See how it works".
- Under-CTA: "Start free. On the Free plan, we only get paid when you do."
- Trust ping: "Free to start · No credit card · 100 personalized pitches · Pay only when a MatchAI-sourced deal is completed and paid".
- Stat cards: `2 min · To go from sign-up to first match`, `100–500 · Personalized pitches sent each month`, `Real deals · Built to turn outreach into paid conversations`.
- Footer strip: "REAL BRANDS ONLY · YOU APPROVE EVERY SEND · PROTECTED PAYMENTS".

**HeroCallout**: "Free until there's a real paid opportunity." + 20 % success-fee explainer.

**BrandLogoStrip**: (logos incl. Sephora, Lululemon, etc.) — decorative, no partnership implied.

**ProductShowcase**: multi-card demo of the agent doing brand match / draft / reply. Chat pretends to run; no live data.

**HowItWorks (`ui/how-it-works.tsx`)**: three numbered steps — "Paste your social links", "See who to pitch first", "Approve. I send." Each card has 2–3 sub-bullets.

**PersonalizationSignals**: claims **38 signals** feed the AI (audience, geo, engagement, content themes, recent posts, brand freshness, contact seniority, etc.).

**Features**: bento cards (AI negotiation, brand fit, payment tracking, follow-up automation, etc.).

**InboxConnect**: "MatchAI's own inbox — no Gmail connect required."

**OutcomePricingCallout**: repeats the free-until-qualified messaging.

**Pricing** (`Pricing.tsx`, verbatim in §12).

**Faq** (verbatim, 7 items):
1. What does MatchAI actually do?
2. Will this work with a small following?
3. Is this just AI templates?
4. What if I don't know what to charge?
5. Is the free plan a trick?
6. When do I pay MatchAI?
7. Can I cancel anytime?

**FinalCta** + **TrustBar** ("SOC-style claims", security posture snippet) + **SiteFooter** (legal links to `/trust`, no Privacy/Terms distinct pages).

**Message hierarchy**: outcome pricing > product demo > social proof > pricing > FAQ.
**Main promise**: "one AI agent finds real brands, writes pitches in your voice, tracks payments — free until you get paid."
**Perceived target**: solo micro-creator without a manager.
**Strongest supported claims**: chat drafting, follow-up scheduling, Stripe escrow.
**Weakest / unsupported claims**:
- **"100 personalized pitches"** in hero: `plans.ts` sets Free = 25, but pricing page + hero say 100 (see §12 inconsistency).
- **"Real deals · Built to turn outreach into paid conversations"** — no completed deals exist in seed data.
- **"38 signals"** — the AI system prompts reference a handful (top themes, engagement, geography, etc.); "38" is a marketing count with no direct 1:1 field list in code.
- **"PROTECTED PAYMENTS"** — real (Stripe), but auto-release default is 3 days in code (`escrow_transactions.auto_release_days ?? 3`) vs "7 days" in the agent FAQ prompt.
- **BrandLogoStrip** — logos are decorative; no brand relationships.
**Inconsistent terminology**: "escrow" vs "protected payment" (both appear); "AI manager" vs "agent" vs "friend"; "MatchAI-sourced" vs "matchai_sourced".

---

## 4. Authentication & onboarding

**Auth**
- Provider: Supabase Auth (email + password + Google OAuth).
- Google OAuth is routed via the Lovable broker: `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- Reset password: `/reset-password`.
- Session hydration: `supabase.auth.onAuthStateChange` in `__root.tsx`.
- Route gating: `beforeLoad` on `/dashboard` and `/onboarding` (not the managed `_authenticated/` layout — uses ad-hoc `getUser` checks; SSR risk noted §23).

**Onboarding (single screen, `/onboarding` — 250 LOC)**

Fields collected:
| Field | Storage | Used in AI? | Editable later? |
|---|---|---|---|
| `full_name` | `profiles.full_name` + `creator_profiles.full_name` | yes (context) | yes (Settings) |
| `niche` | `creator_profiles.niche` | yes | yes |
| Platform handles (tiktok/instagram/youtube/linkedin/twitch/podcast) | `platform_stats.platform/handle` (stub row) + `profiles.connected_platforms` + `creator_profiles.platforms` | yes | yes (`addSocialHandle`) |

Not asked in the visible screen but supported by schema (unused unless the creator opens Settings):
- `min_deal_value`, `market_scope`, `location`, `blocked_categories` (default `0`, `both`, `null`, `null`)
- `tone`, `content_style`, `target_audience`, `audience_age_band`, `content_themes`, `bio`, `deal_type_preference`, `gifted_products_accepted`, `growth_stage`, `confidence_level`, `voice_formality`, `voice_length`, `voice_warmth`, `explanation_level`, `autonomy_level`, `pricing_aggressiveness`, `cta_style`
- `preferred_categories`, `values_to_avoid`, `dream_brands`, `brand_size_preference`, `additional_notes`
- `physical_address`, `unsubscribe_footer_enabled`, `payout_mode`, `autopilot_daily_send_cap`, `stripe_connect_account_id`, `stripe_connect_onboarded`

After submit:
1. `saveStep1` → writes profile + `creator_profiles`.
2. `saveStep2` → writes defaults (`min_deal_value: 0`, `market_scope: 'both'`).
3. `startScrapeAll` (fire-and-forget) → Apify actor per platform → fills `platform_stats.follower_count`, `avg_views`, `engagement_rate`, `top_content_categories`, `posting_cadence`, `recent_post_snapshot`.
4. `runCreatorAnalysis` (fire-and-forget) → Gemini 2.5-pro → `ai_analysis` + first 10 `brand_matches` + `pricing_rules.rate_floor`.
5. `completeQuickOnboarding` → `profiles.onboarding_complete = true`.
6. Navigate to `/dashboard/brands` immediately.

⚠️ Race: dashboard can render before Apify/AI finish → empty brand list on first paint. There is a "profile-completeness gate" in `generateBrandMatches` that returns `Profile incomplete` when ≥ 3 signals are missing.

---

## 5. Chat agent

**Endpoint**: `/api/chat/agent` (`src/routes/api.chat.agent.ts`, 786 LOC). Raw route, Bearer-validated via `chat-auth.server.ts` (`supabase.auth.getClaims`).
**Model**: `gateway("google/gemini-2.5-flash")` via Lovable AI Gateway. Landing uses `google/gemini-3-flash-preview`; onboarding uses its own file; classifier + reply-value use `google/gemini-3.6-flash`.
**System prompt**: composed of `AGENT_VOICE_PRINCIPLES` + `AGENT_EXPERTISE` + `REDDIT_AUTHENTICITY_PRINCIPLES` + `personalizedVoiceGuide(profile)` + autonomy block + `summarizeContext(ctx)` + a large in-prompt FAQ (see file lines 59–132). All text is in `src/lib/agent-voice.server.ts` (432 LOC — verbatim available in that file).
**Context provided per turn** (via `loadAgentContext`, `agent-context.server.ts`): creator profile, platform stats, `agent_rules`, `pricing_rules`, top 20 brand matches, non-completed deals, pending approvals, last 10 outreach rows, connected accounts, brand prefs, last 8 applied learning insights. Personalization knobs (growth_stage, voice_*, autonomy_level, pricing_aggressiveness, cta_style) are surfaced when present.
**Memory**: `agent_memory` (key/value per user) is a table; the "propose_remember_preference" tool creates approval-gated writes there. Prior chat: `agent_messages` (persisted role/content + inline_card_type/data; approval status).
**Autonomy levels** (0–3): Manual / Suggest / Draft (default 2) / Autopilot.

**Tools exposed** (all defined in the same file):
- `navigateView(view)` — switches right pane (brands/approvals/deals/analytics/campaigns/settings).
- `showBrandCard(brandMatchId)` — inline card, RLS-scoped.
- `showDealCard(dealId)` — inline card.
- `showEmailDraft(outreachId, subject, body, ...)` — cold outreach draft; guards against calling on already-replied threads.
- `showReplyDraft(outreachId, brandName, body, ...)` — reply draft; guards against no-reply threads.
- `suggestAttachments({outreachId, kind, names[], reason})` — proposes portfolio files.
- `showEmailThread(outreachId|brandMatchId, brandName)` — inline sent email + reply.
- `proposeSendOutreach` — **marked DEPRECATED** in code.
- `proposeReleasePayment(dealId, brandName, amount)` — approval card.
- `proposeRequestEscrow(dealId, brandName, amount)` — approval card.
- `requestBrandPayment(dealId, amount)` — **immediate** escrow row creation + `/pay/{id}` link.
- `proposeApplyInsight(insightId)` — from `learning_insights`.
- `proposeRememberPreference(text, reason)` — approval → writes to `agent_memory`.
- `showBrandList(limit, status)`, `showReplyList(limit)`, `showEarnings()` — read-only.
- `proposeMarkDelivered`, `proposeFileDispute`, `proposePauseCampaign`, `proposeResumeCampaign`, `proposeUpdateRate` — approval-gated.

**What the agent actually can do** ✅:
- Read all creator data (via `supabaseAdmin` scoped to the user) and surface cards.
- Draft outreach and replies via the linked `matchai.functions.draftOutreachForBrand` server fn.
- Push approval cards, which the UI (`InlineToolCard`) executes on click.
- Emit rate/pricing recommendations.
- Compose reply threads and negotiations.

**What it claims but does not directly do**:
- ❌ Cannot literally "send" from a text acknowledgment ("go ahead"): sending only fires from the Send-now button (`sendOutreachFromChat`). This is by design and explicit in the prompt.
- ❌ Cannot analyze contracts inside chat — contract tables exist (`contracts`) but there is **no contract-analysis tool** wired in the agent. See §14.
- 🟡 "Negotiation" — the agent can draft counter-offers as reply drafts but no negotiation engine exists beyond that.
- 🟡 "Find contacts" — `findContactForBrand` server fn exists (Hunter + AI cascade) but is not exposed as a chat tool; UI-triggered.

**Streaming**: `streamText` + `toUIMessageStreamResponse`, `stepCountIs` for multi-step tool loops. No hard cap on tool loops (per user request removing caps).

**Approval semantics**: every irreversible action returns `{ requiresApproval: true, action, params, card }`; the client renders it as an `InlineToolCard` with per-action buttons. Real execution happens in `agent-chat.functions.ts` (e.g. `executeApproval`, `sendOutreachFromChat`, `releaseProtectedPayment`, etc.).

**Error handling**: the raw route returns 401/500 as `new Response(...)` strings; client shows the "snag reaching the model" fallback if streaming throws. There is no dedicated observability beyond `console.error`.

**Landing chat prompt (public)**: verbatim in `src/routes/api.chat.landing.ts` (see §2). Uses `[SUGGEST: ... | ... | ...]` inline sentinel to render 2–4 chip suggestions.

---

## 6. Brand discovery & matching

- **Source of brands**: `generateBrandMatches` in `src/lib/matchai.functions.ts` — the AI (`google/gemini-2.5-pro`) is asked to return **12** real companies per run, tailored to niche + platform + location + market scope. No external brand database.
- **Storage**: `brand_matches` table (name, industry, score_breakdown JSONB, fit_score, fit_quality_score, match_label, estimated_deal_min/max, suggested_package, outreach_angle, market_type, my_take, partnership_angle, potential_risk, recommended_next_move, why_creator_fits, why_brand_cares, top_reasons[], suggested_deliverables[], best_outreach_channel, contact_path, what_to_avoid).
- **Demo overlay**: `DEMO_MODE = true` (hardcoded in `src/lib/demo-mode.ts`). `FastestToCashStrip` shows 6 **hardcoded** brands (Glossy Beauty Co., Studio Linen, Nolabel Skincare, Maison Ivy, Bloom Haircare, Ceramic Skin Lab). These appear alongside real brand matches. `isDemoId(id)` and `blockRealActionOnDemo(action)` prevent sending/funding on demo rows.
- **Scoring**:
  - Primary: LLM returns a 10-dimensional `score_breakdown` (audience_fit, category_fit, sponsorship_likelihood, conversion_potential, deal_value_potential, brand_credibility_fit, outreach_timing, relationship_path, competitive_white_space, creator_leverage).
  - Weighted total → `fit_score` (0-100): `0.20/0.15/0.15/0.15/0.10/0.10/0.05/0.05/0.03/0.02` respectively.
  - Match labels: 90+ Strong, 80+ Good, 70+ Worth Testing, 60+ Low Priority, else Do Not Recommend.
  - Secondary code heuristic → `fit_quality_score`: audienceAlignment (0/15/30) + deal-value bucket (0/10/25) + preference match (+25 / -100) + engagement bucket (0/10/20), clamped 0–100.
- **Locality**: `market_scope` = `local` / `international` / `both`. `both` prioritizes physical proximity: same city > region > country > ships > international, aiming for ≥ 5/12 same-city/region/country.
- **Duplicates**: only clears stale rows in status `new`/`queued`, then dedupes by lowercased brand name against existing rows (`taken` set). "One funnel per brand" is enforced.
- **Contacts**: on new insert, `backgroundDiscoverContacts` fires (see §8) — Hunter.io cascade + AI department guess + pattern fallback (`partnerships@{domain}`).
- **Usage tracking**: `usage_tracking` incremented per `match_brands` call.
- **Percentages**: real, not decorative — computed as above.

---

## 7. Opportunity & proposal system

- **Opportunity** = a `brand_matches` row (score, take, packages). It's not a formal "proposal" record until outreach exists.
- **Proposal creation**: `draftOutreachForBrand` (see §5). Uses `AGENT_VOICE_PRINCIPLES` + `OUTREACH_QUALITY_STANDARD` + `personalizedVoiceGuide(profile)` + `categoryStyleGuide(category)` + a full JSON schema requiring subject (4–9 words), 2 subject_variants, body (70–140 words), `signals_used[]` (4–10 entries, each cited verbatim from context), `send_time_suggestion`, and an 8-boolean `quality_check`. Model: `google/gemini-2.5-pro`.
- **Storage**: `outreach_emails` (subject, body, ai_generated, ai_reason, personalization_used, category_style, quality_check JSONB). One outreach per (`user_id`, `brand_match_id`) enforced via partial unique index (referenced in prior migrations).
- **Approvals**: an `approvals` row (approval_type=`outreach_draft`, related_id, ai_recommendation, what_happens_next) + an `agent_messages` row with `inline_card_type='outreach_review'` payload. Nothing sends automatically.
- **Send**: `sendOutreachFromChat` — checks that (a) contact confidence ≠ 'low' if `send` mode, (b) plan quota not exceeded (`profiles.plan` → `PLANS[slug].monthlyPitchQuota`, counted in `usage_tracking`).
- **Follow-ups**: `follow_up_sequences` scheduled at +2/+5/+9 days, dispatched by `api.public.hooks.process-follow-ups.ts`. Auto-cancelled the moment `replied=true`.
- **Reply detection**: Resend inbound webhook (`api.public.hooks.resend-inbound.ts`) matches by `In-Reply-To` / `References` → sets `outreach_emails.brand_reply_text` + `replied=true` + creates `approvals` row of type `reply_received`.
- **Templates**: exactly one email template component (`src/lib/email-templates/brand-outreach.tsx` — React Email) used for transactional preview + queue. The **outreach itself** is model-generated per brand, no fixed template.

---

## 8. Contacts & lead data

- Discovery cascade (in order):
  1. **AI guess** (`google/gemini-2.5-flash`) — returns `{ domain, primary_email, alternate_emails[], confidence, source, notes }`.
  2. **Hunter.io** (`HUNTER_API_KEY` present) — `/v2/domain-search` with `seniority=executive` first, then general. Scores results by C-suite regex, PARTNER_ROLE regex, seniority, personal type, hunter confidence. Returns best contact + up to 2 alternates.
  3. **Pattern fallback**: `partnerships@{domain}`, `marketing@{domain}`, `hello@{domain}` with confidence `low`.
- Apollo / Clay / PDL / LinkedIn: **not integrated**. Env vars for them are absent.
- Storage: `brand_contacts` (email, contact_name, contact_title, domain, source ∈ {`department`,`ai_guess`,`pattern`}, confidence ∈ {`low`,`medium`,`high`}, alternate_emails[], notes).
- Verification: no live SMTP/MX ping; confidence is the sole signal.
- Multiple contacts per brand: supported; `getBestContactEmail` picks by confidence desc.
- Wrong contacts: creator-facing "Find contact" button re-runs the cascade; low-confidence contacts are blocked from `send` mode.

---

## 9. Gmail & email system

- **Gmail OAuth**: fully implemented (`src/lib/gmail.functions.ts`, 398 LOC). Scopes: `gmail.send`, `gmail.readonly`, `gmail.modify`, `openid email profile`. HMAC-signed OAuth state (uses `GOOGLE_OAUTH_CLIENT_SECRET`). Refresh-token flow with 60 s expiry buffer. Tokens stored in `connected_accounts.account_metadata` JSONB.
- **Sending helpers**: `sendGmailFor` and `fetchThreadRepliesFor` exist and are functional, but the **live outreach path does NOT use Gmail** — it uses Resend from `outreach@notify.www.matchapp.ai` (`src/lib/outreach-sender.server.ts`). Gmail integration is effectively dormant in the shipping flow. The system prompt explicitly says: "Never reference Gmail, SMTP, or 'connect your email.' MatchAI's internal sender handles it."
- **Send provider**: Resend (`RESEND_API_KEY`), verified sender `outreach@notify.www.matchapp.ai`.
- **Deliverability controls**: `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers; per-recipient suppression via `suppression_list` (per user); CAN-SPAM footer with `physical_address` from profile; open-pixel + click-through URL rewriting.
- **Bounce handling**: none in code — Resend bounces don't route back to a webhook here.
- **Spam / rate limits**: autopilot daily cap (`profiles.autopilot_daily_send_cap`, default 25) enforced only when `autonomyLevel === 3`.
- **Open/click tracking**: `outreach_emails.tracking_id` → `/api/public/email/open/$tid.gif` + `/click/$tid` routes update `email_send_log`.
- **Reply detection & thread association**: Resend inbound webhook uses `In-Reply-To`/`References` to match. If it can't, the reply is dropped/logged.
- **Auto follow-ups**: +2d / +5d / +9d (`process-follow-ups`), stop-conditions: `replied=true` or `cancelled=true`.
- **Human approval**: Every send requires an explicit inline card click.
- **From-address**: always `Display Name via MatchAI <outreach@notify.www.matchapp.ai>`. Reply-to same. Real Gmail send is unused in shipping path.

---

## 10. Inbox & reply classification

`classifyReply` in `src/lib/qualification.functions.ts` runs a rule-based pass first (fast) then an LLM classifier.

Classes covered:
- `qualified_paid_interest`, `negotiation_started`, `request_for_rates`, `request_for_information`, `gifted_only`, `affiliate_only`, `rejection`, `auto_reply`, `unsubscribe`, `spam`, `unclear`

Rule-based:
- `unsubscribe|opt-out|remove me` → `unsubscribe` (0.95).
- `out of office|auto-reply|automatic reply|vacation` → `auto_reply` (0.9).
- `not interested|no thanks|not a fit|pass on this` → `rejection` (0.85).
- Gifted-only detection (unless "paid|budget|$" present) → `gifted_only` (0.8).
- Affiliate-only (unless paid/flat-fee/budget) → `affiliate_only` (0.8).

LLM prompt (`google/gemini-3.6-flash`, JSON output). Confidence 0–1.

Qualifying set (flips profile to `pricing_decision_required` if conf ≥ 0.7): `qualified_paid_interest`, `negotiation_started`, `request_for_rates` (+ `gifted_only` when creator opted in).

Missing: `wrong contact`, `contracts`, `follow-up needed`, `spam` are not distinct labeled outcomes with dedicated next-actions. There's a `REPLY_INTERPRETATION_RULES` in the voice guide but no separate structured classifier for those.

Next-action per class: not codified — the agent surface an approval card of type `reply_received`; the human agent (LLM) then recommends a response.

---

## 11. Deal pipeline & CRM

- Table: `deals` (id, user_id, brand_name, status, deal_value, contract_status, escrow_status, invoice_status, created_at, etc.).
- Stage source of truth is a mix of `status` + `contract_status` + `escrow_status` + `invoice_status`. There is **no formal enum-controlled pipeline** with explicit stage transitions.
- Common stages observed in code strings: `active`, `completed`, `cancelled`, `disputed`. Escrow: `awaiting` → `funded` → `released`. Invoice: `pending` → `paid`.
- **Movement**: mostly manual + agent tool calls (`proposeMarkDelivered`, `proposeRequestEscrow`, `proposeReleasePayment`, `proposeFileDispute`). Webhook auto-updates: `checkout.session.completed` flips escrow_status to `funded`; release fn flips deal `status='completed'`, `invoice_status='paid'`, `escrow_status='released'`.
- **Expected revenue / probability**: not tracked as a field. `showEarnings` computes month/YTD/pending/in-flight sums live.
- **Stalled deals / reminders / tasks**: no dedicated tasks table. `agent_activity` + digest give ambient nudges.
- **Chat can update stages**: yes (via approval-gated tools).
- **Deliverables**: `deliverables` table (deal_id, status) — release blocks if any deliverable ≠ `approved`/`posted`.

---

## 12. Pricing & rate recommendations

**Plans** (`src/lib/plans.ts`):

| Slug | $/mo | Cents | Monthly pitch quota | Match quota |
|---|---|---|---|---|
| free | 0 | 0 | **25** ⚠️ | 50 |
| starter | 49 | 4900 | 100 | 300 |
| growth | 99 | 9900 | 250 | 750 |
| pro | 199 | 19900 | 500 | 1500 |

**Pricing marketing (`Pricing.tsx`)** advertises Free = **100 pitches/mo**, Starter = 100, Growth = 250, Pro = 500.
🐛 **Inconsistency**: `plans.ts` (enforcement) says Free = 25 pitches/mo but the landing page and hero say 100. Enforcement kicks in at 25.

**Success-fee model (`pricing-config.ts`)**:
- `stay_free_success_fee`: 20 %
- `starter_subscription`: 10 %
- `growth_subscription` / `pro_subscription`: 0 %
- Fair Deal cap: **$99 per deal**.
- Repeat-brand waiver: same brand + `matchai_sourced` → 0 %.
- Locked at deal acceptance (`lockedRate`).
- Stripe processing: 2.9 % + $0.30 (disclosed, not MatchAI revenue).

🐛 **Inconsistency**: the agent tools (`proposeReleasePayment`, `proposeRequestEscrow`, `requestBrandPayment`) hardcode a **3 % "Fee (3%)"** on the payment link — this is the escrow platform fee logic. The 20 % success fee logic (`computeFeeBreakdown`) is separate and lives in `pricing-config.ts`. There is **no unified charge path** — success fees are computed for display, and the 3 % is deducted directly from `net_payout` at escrow-row creation. Success fees are **not actually invoiced or debited** anywhere in code (see §17 gap).

**Break-even math**: `computeBreakEvenSuggestion` — if Free-tier commission ≥ plan price threshold ($98 Starter / $99 Growth / $199 Pro), nudge to upgrade.

**Rate recommendations** (`pricing_rules` per user): `rate_floor`, `target_rate`, `walk_away_rate`, `exclusivity_fee`, `usage_rights_fee`, `rush_fee`, `configured`. Initial `rate_floor` is set by `runCreatorAnalysis`. The agent has a tool `proposeUpdateRate`.

**Reply-value estimator** (`reply-value.functions.ts`): extracts deliverables from a brand reply (LLM) and deterministically prices each using the creator's own rules. Returns `insufficient_info` if the creator hasn't priced yet.

**Upgrade triggers**:
- Qualified reply → forces "Stay Free vs Plan" screen.
- Break-even nudge in Wallet.
- Quota exhaustion → per-plan block message.

**Trial / free plan**: Free is forever; no separate trial.

**Attribution**: `deals.deal_source` (from `pricing-config.ts` type `DealSource`) tracks `matchai_sourced` vs `creator_sourced` vs `existing_relationship` vs `manual`. Only `matchai_sourced` deals earn the success fee.

---

## 13. Negotiation

- Everything sits inside the chat. `NEGOTIATION_PROTECTION_RULES` + `REPLY_INTERPRETATION_RULES` are text guides in `agent-voice.server.ts`.
- Recommend opening rate: yes (via `pricing_rules`).
- Detect lowball: yes (text rules).
- Suggest counters: yes (chat draft; not a structured negotiation record).
- Usage rights / exclusivity / revisions / payment terms: covered as prompt guidance, no structured field capture per negotiation round.
- Auto-send: never — always approval-gated.
- Requires approval: yes.
- Remembers creator minimums: yes via `pricing_rules` and `agent_memory`.
- Learns from prior deals: `learning_insights` table exists, populated by `insights.functions.ts`; agent references applied insights in system context.

`negotiation_messages` table exists but is not wired to a UI. `ai_replies` table exists.

---

## 14. Contracts

- Table: `contracts` (per user_id). Referenced from `deals.contract_status`.
- **No AI contract-analysis code exists** in the repo. No pdf parsing, no clause detection, no risk categorization, no FTC disclosure detection. The word "contract" appears in prompts and in `dispute.functions.ts` but no functional analyzer.
- No file-upload path dedicated to contracts. `avatars` storage bucket is the only bucket configured.
- No disclaimers surfaced.
- **Legal risk**: agent prompts include lines like "Get the deliverables in writing before agreeing" — no explicit "not legal advice" disclaimer anywhere.

⛔ Major gap.

---

## 15. Media kit / brand kit / creator profile

- Upload capability is in `CreatorSetupSection.tsx` — supports moodboards, portfolio images, PPT/DOC files. Stored via `AttachmentPicker` and referenced from `MediaUploader` (component present).
- **No media-kit generation** (no exportable PDF/PPTX). "brand kit" upload exists; generation does not.
- Social profile analysis: Apify (`apify.functions.ts` / `apify.server.ts`) scrapes TikTok/IG/YT/etc. and writes `platform_stats`. Editable in Settings.
- Attached to outreach: portfolio filenames can be suggested by the `suggestAttachments` agent tool and attached via `AttachmentPicker` on the compose card.
- Creator profile fields: see §4 unused-fields list — the full schema in `creator_profiles` and `profiles` supports far more than the onboarding collects.

---

## 16. Campaign types

Referenced across the app: `Paid post`, `UGC`, `Affiliate + post`, `Gifting + fee` (demo data), and in schemas: `deal_type_preference[]`, `deliverables` types.

Actual dedicated workflow per type: **no** — all outreach uses one generic model prompt with a category-style guide (`BRAND_CATEGORY_STYLES` covers local-business, saas-tool, vc-startup, beauty-wellness, fitness, fashion, restaurant, hotel-travel, education-productivity, podcast-newsletter, event, ugc-content, affiliate, national-brand).

Not distinctly modeled: Instagram Reels vs Stories vs Posts, TikTok, YouTube (long vs short), whitelisting, licensing, events, press, long-term partnerships, sync licensing, NIL, endorsements — even though `AGENT_EXPERTISE` claims coverage.

---

## 17. Payments & billing

- **Stripe SDK**: dynamic `await import("stripe")` inside handlers. API version pinned to `2026-05-27.dahlia`.
- **Products / price IDs**: none — checkout uses inline `price_data` from `PLANS[slug].monthlyCents`.
- **Subscriptions checkout** (`createCheckoutSession`): `mode='subscription'`, `automatic_tax=true`, `customer_update.address='auto'`, `billing_address_collection='required'`, `tax_id_collection=true`, `tax_code='txcd_10000000'`. Success `/checkout/return?session_id=…`, cancel `/#pricing`.
- **Escrow checkout** (`createEscrowFundingLink`): `mode='payment'` with escrow metadata; success/cancel `/escrow/funded` / `/escrow/cancelled` (⚠️ those routes are not in the route table — probably 404).
- **Webhook** (`api.public.stripe-webhook.ts`): HMAC-verified, idempotent via `stripe_processed_events`, handles `checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.*`, `invoice.paid`, `charge.dispute.*`. Rolls the idempotency row back on handler error for Stripe retries.
- **Failed payment / cancel / resume**: `cancelSubscription`, `resumeSubscription` implemented. Cancel = `cancel_at_period_end=true`.
- **Refunds**: not implemented.
- **Success fee charging**: 🐛 The 20 %/10 % success fee is **computed** (`computeFeeBreakdown`) and displayed but there is no code that invoices, debits, or transfers the fee to MatchAI on release. The only fee that actually leaves the deal is the 3 % escrow platform fee baked into `net_payout` at row creation. This is a material gap — the primary revenue mechanism advertised on the landing is unimplemented.
- **Payouts**: Stripe Connect Express (`createConnectOnboardingLink`). `payout_mode`: `manual` (default) credits the internal `wallet_ledger`; `auto` fires `stripe.transfers.create` on release. Manual withdrawal via `requestPayout`. Retry logs in `payout_attempts`.
- **Escrow flow**: `escrow_transactions` (gross, platform_fee, net_payout, status, dispute_status, release_scheduled_at, auto_release_days default 3). Release blocked by disputes and unapproved deliverables.
- **Deal-based invoicing**: none (only escrow via Stripe Checkout).
- **Taxes**: Stripe Tax for subscriptions. Escrow does not run Tax.
- **Currency**: USD hardcoded (`row.currency ?? "usd"`, `getSuccessFeeRate` in USD, `PLAN_PRICE_USD`).

---

## 18. Database

45 tables in `public`. High-level map (all with RLS enabled — the security migration referenced revoked EXECUTE from security-definer fns; RLS policies exist per-table).

**Core creator**
- `profiles` — auth mirror + plan, onboarding flags, monetization_choice, free_access_status, physical_address, unsubscribe_footer_enabled, payout_mode, stripe_connect_*, autopilot_daily_send_cap, avatar_url.
- `creator_profiles` — full_name, primary_platform, handle, niche, platforms[], min_deal_value, market_scope, location, tone, content_style, target_audience, audience_age_band, content_themes[], bio, deal_type_preference[], gifted_products_accepted, personalization knobs.
- `platform_stats` — one per (user, platform): follower_count, avg_views, engagement_rate, top_content_categories[], posting_cadence, recent_post_snapshot, fetched_at.
- `platform_verifications` — verification handshake artefacts.
- `apify_runs` — Apify job tracking.
- `connected_accounts` — service ∈ {gmail}, tokens JSONB.

**Brand + outreach**
- `brand_matches` — see §6.
- `brand_contacts` — see §8.
- `brand_preferences` — preferred_categories, blocked_categories, values_to_avoid, dream_brands, brand_size_preference, additional_notes.
- `outreach_campaigns` — brief JSONB, name.
- `outreach_emails` — subject, body, sent, replied, brand_reply_text, tracking_id, reply_classification, qualification_confidence, ai_reason, personalization_used, quality_check.
- `follow_up_sequences` — schedule + status.
- `ai_replies` — reply drafts scratchpad.
- `email_send_log`, `email_send_state` — send provenance + rate state.
- `email_unsubscribe_tokens` — one-click unsub.
- `suppression_list` + `suppressed_emails` — per-user + system-wide suppression.

**Deal + money**
- `deals`, `deliverables`, `contracts` (empty logic), `escrow_transactions`, `wallet_ledger`, `payout_attempts`, `payment_accounts`.
- `subscriptions`, `stripe_processed_events`.
- `usage_events`, `usage_tracking`, `pricing_rules`, `pricing_signals`, `ai_analysis`, `learning_insights`.

**Agent**
- `agent_messages`, `agent_activity`, `agent_memory`, `agent_rules`, `agent_audit_log`, `chat_pending_actions`, `onboarding_messages`, `negotiation_messages`, `notifications`, `approvals`, `product_feedback`, `cron_secret`, `user_roles`.

Unused / near-empty in the app: `negotiation_messages`, `ai_replies`, `contracts` (no writes), `payment_accounts` (Stripe Connect data is on `profiles`), `pricing_signals`, `product_feedback`, `chat_pending_actions` (referenced only in agent-chat but seldom persisted).

Security definer functions: all pin `search_path`. `EXECUTE` granted only to `service_role` / expected roles per the recent security migration. `is_admin()` = has_role owner OR admin. `handle_new_user` seeds profile from `auth.users`. `trg_*` triggers write into `agent_activity` on outreach/escrow/deal transitions. Email queue functions: `enqueue_email` / `email_queue_wake` / `email_queue_dispatch` / `read_email_batch` / `delete_email` / `move_to_dlq` (pgmq-backed).

---

## 19. Backend & architecture

- **Frontend**: React 19, TanStack Start v1 (Vite 7), TanStack Router, TanStack Query, Tailwind v4, Radix UI, framer-motion, react-email, recharts, lucide-react, react-hook-form + zod resolvers, react-markdown.
- **Backend runtime**: Cloudflare Workers (`wrangler.jsonc`, `nodejs_compat`), `src/server.ts` entry. All backend logic is `createServerFn` or raw file routes.
- **Database**: Supabase Postgres (project ref present in config). RLS on user tables. pgmq for email queue.
- **Auth**: Supabase Auth (email + Google OAuth via Lovable broker). Gmail OAuth is separate.
- **AI provider**: Lovable AI Gateway (`ai.gateway.lovable.dev/v1`, `LOVABLE_API_KEY`). Vercel AI SDK `ai` v6 (`streamText`, `generateText`, `convertToModelMessages`, `stepCountIs`, `tool`).
- **Email**: Resend for outreach + transactional; internal queue via pgmq + pg_cron.
- **Payments**: Stripe SDK (dynamic import), Stripe Tax + Managed Payments, Stripe Connect Express.
- **File storage**: Supabase Storage bucket `avatars` (private). No other buckets.
- **Analytics**: `usePageViewTracking` hook + `analytics.functions.ts` (`usage_events`, `usage_tracking`, `pricing_signals`). No PostHog / GA / Segment / Mixpanel integration.
- **Background jobs**: pg_cron (`email_queue_dispatch` every 5s while queue non-empty), Resend webhook, Stripe webhook, `/api/public/hooks/*` (daily-digest, auto-release-escrow, process-follow-ups, poll-replies, resend-inbound).
- **Hosting**: Lovable Cloud (Cloudflare Workers backend + static frontend).
- **Monitoring**: `error-capture.ts` logs to console; no Sentry.
- **External APIs**: Apify (creator scraping), Hunter.io (contact discovery), Resend, Stripe, Google OAuth (Gmail).

Text diagram:
```
Browser (React 19 / Tanstack)
  │  ├─ /api/chat/agent  (raw route, Bearer)      → Lovable AI Gateway (Gemini 2.5 flash)
  │  ├─ createServerFn (matchai.*, escrow.*, wallet.*, ...) → Supabase (RLS or admin) + Stripe + Resend + Hunter + Apify
  │  └─ Supabase JS SDK (client)                   → Supabase Postgres
  ▼
Cloudflare Worker (TanStack Start / Vite)
  ├─ /api/public/stripe-webhook       ← Stripe → escrow / subs / disputes
  ├─ /api/public/hooks/resend-inbound ← Resend inbound → outreach_emails.reply
  ├─ /api/public/hooks/*              ← pg_cron via pg_net → auto-release, digest, follow-ups
  └─ /[.mcp]/*                        ← MCP OAuth + tools
```

---

## 20. External services & env vars

Secrets present (names only): `RESEND_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `GOOGLE_OAUTH_CLIENT_SECRET`, `LOVABLE_API_KEY`, `STRIPE_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APIFY_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `HUNTER_API_KEY`.

Referenced but optional / conditional: `APP_BASE_URL`, `PREVIEW_APP_BASE_URL`, `PUBLIC_SITE_URL`, `VITE_PUBLIC_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

| Provider | Purpose | Connected | Production use | Fallback |
|---|---|---|---|---|
| Supabase | Auth + DB + Storage + realtime | ✅ | ✅ | none |
| Lovable AI Gateway | All AI calls | ✅ | ✅ | returns "AI not configured" |
| Resend | Outreach + transactional + inbound webhook | ✅ | ✅ | `Email sending is not configured yet` |
| Stripe | Subs + escrow + Connect + Tax | ✅ | ✅ | `stripe not configured` |
| Google OAuth (Gmail) | Optional Gmail connect | ✅ (creds present) | ⚠️ code path unused for outreach | disconnect gracefully |
| Apify | TikTok/IG/YT scrapes | ✅ | ✅ (best-effort) | `saveManualPlatformStats` fallback |
| Hunter.io | Contact discovery | ✅ | ✅ | AI + pattern fallback |
| PostHog / GA / Sentry | Analytics / errors | ⛔ | ⛔ | — |
| Apollo / Clay / PDL / LinkedIn | Contacts / signals | ⛔ | ⛔ | — |

---

## 21. Analytics

- `analytics.functions.ts` writes to `usage_events` and reads aggregates for the `/dashboard/analytics` page.
- `use-track.ts` hook adds page-view + custom events (best-effort in-house).
- Events tracked in code (via `use-track` calls sprinkled): dashboard page views, some send/approve buttons. **No end-to-end event map** — not all funnel events are instrumented.
- No PostHog / Segment / GA / Amplitude.
- No conversion-rate reporting on landing.

---

## 22. Admin capabilities

- `/dashboard/admin` + `/dashboard/admin/index.tsx` gated by `getMyRoles({isStaff})` (checks `user_roles.role in ('owner','admin')` via `has_role`).
- Real capabilities in code are limited: viewing feedback (`product_feedback`), scanning users, and a few utility actions. There is no admin CRUD for brands/contacts/outreach/deals/subscriptions.
- The AI cannot be "corrected" by an admin from the UI — only via `learning_insights` writes.

---

## 23. Security, privacy, legal

- **Auth**: Supabase JWT; `chat-auth.server.ts` validates via `getClaims`. Server fns use `requireSupabaseAuth`. Admin ops use `supabaseAdmin` inside handlers.
- **RLS**: enabled on public tables; policies scoped to `auth.uid()`. `service_role` bypass for admin work. `user_roles` grants `select` to authenticated only (correct).
- **Cross-user isolation**: server fns filter by `context.userId` explicitly on admin queries — good.
- **Gmail-token protection**: stored in `connected_accounts.account_metadata` JSONB, accessible only via `supabaseAdmin`. Token is not exposed to the client.
- **File access**: bucket `avatars` is private.
- **API-key protection**: all keys read from `process.env` inside handlers.
- **Input validation**: Zod on every server fn. Good.
- **Rate limiting**: only the autopilot daily-send cap. No general rate limit on chat, brand-match generation, or webhooks.
- **Prompt injection**: no dedicated sanitization; reply bodies are passed straight to the classifier and to `reply-value` extractor. Since these LLMs return structured JSON, blast radius is limited, but a hostile reply could steer classification.
- **Email abuse**: `suppression_list` + CAN-SPAM footer + one-click unsub headers. No auto-added system-wide suppression for bounces.
- **PII storage**: name, email, physical_address, social handles, follower counts. No SSN / financial detail.
- **Privacy policy / Terms**: none in the repo as dedicated routes (only `/trust`). `MONETIZATION_COPY.agreementVersion` = `"2026-07-27.v1"` stamped on the profile at monetization choice — but no actual agreement text file.
- **FTC #ad disclosure**: mentioned in `AGENT_EXPERTISE` prompt only; no automated enforcement.
- **CAN-SPAM**: footer + physical_address + unsub — ✅ mechanical compliance requires the creator to have filled in `physical_address`; there's no gate that prevents sending without it.
- **GDPR / CCPA**: "Delete my data" is mentioned in the agent FAQ but there is no code path.
- **Contract analysis** = none, so no legal-advice exposure yet, but there is also no disclaimer for the general "negotiate for you" rhetoric.
- **Talent-agency positioning**: the agent says "as a modern brand-deals agent" and "you ALWAYS protect the creator" — arguably represents itself as an agent/manager. No disclaimer.
- **Automatic negotiation risks**: send is always approval-gated; no risk of silent commitment.

Critical/high:
1. Success fee not actually charged — revenue lost + inaccurate accounting shown to creator (H).
2. Landing quota (100) ≠ enforcement quota (25) → user-facing false claim (H).
3. `/escrow/funded` and `/escrow/cancelled` routes referenced in Checkout do not exist as file routes (H, functional).
4. No Sentry / observability — production silent failures likely (M).
5. No formal Privacy / Terms pages (M — depending on target jurisdictions).
6. `DEMO_MODE = true` project-wide — real users see hardcoded brand rows mixed with real matches (M — trust).

---

## 24. UI & design system

- Tailwind v4 + shadcn/ui components (accordion, dialog, dropdown, popover, etc.).
- Fonts: standardized to Quicksand (chat) + Inter/Cal Sans-style for headings via `src/styles.css`.
- Colors: theme tokens (`--background`, `--foreground`, `--primary`, `--muted-foreground`, etc.), currently light-mode with Midnight Indigo / Violet accents.
- Buttons: `Button` variants, `btn-sheen` glossy variant used in hero/pricing CTAs.
- Cards: `glass` + `glass-hover` utilities.
- Chat components: `DashboardChatPanel`, `LandingChatWidget`, `HomeChatStream`, `InlineToolCard`, `ApprovalCard`, `AgentActivityStep`, `AgentCursor`, `HomeAgentChat`.
- Nav: `DashboardTabs`, `DashboardTopBar`, `DashboardSidebar` (present but not the primary layout).
- Loading states: `PageLoader.FullScreenLoader`, `sonner` toasts for busy/error.
- Empty states: `EmptyState` component + specialized "profile-incomplete" empty state for brands.
- Error states: agent chat "snag reaching the model" fallback; escrow release throws Errors surfaced via toast.
- Success states: toasts on subscription cancel/resume/checkout etc.
- Accessibility: aria-labels on icon buttons; no formal audit; no skip-link.
- Responsive: chat + stage collapse to a mobile slide-over drawer with a FAB. Some cards are dense on tablet.
- Landing-vs-app parity: landing shows a polished, scripted demo chat; the real dashboard chat is much more austere and requires user typing to see anything happen (no auto-scripted "watch the agent" flow).

---

## 25. Current functional user journey

1. **Land on `/`** — ✅ landing chat auto-opens with the AI greeting.
2. **Sign up** at `/auth` — email/password or Google. Redirects to `/onboarding` (if incomplete) or `/dashboard`.
3. **Onboarding** — one screen, name + niche + handles → save + kick Apify + AI in background → land on `/dashboard/brands`.
4. **Connect Gmail** — **skipped**. The app sends via Resend from `outreach@notify.www.matchapp.ai`. Gmail connect UI exists but is not required or emphasized.
5. **Dashboard** — chat left, stage right. Brand matches populate as AI + scrape finish. Demo brands appear alongside real ones due to `DEMO_MODE=true`.
6. **Chat** — creator asks for a pitch. Agent calls `navigateView('brands')` and `showEmailDraft(...)`. Card renders inline with subject/body.
7. **Brand recommendations** — real (from `brand_matches`) + demo (from `demo-mode.ts`).
8. **Reviews proposals** — inline chat card + `/dashboard/approvals` list.
9. **Approves outreach** — click "Send now" → `sendOutreachFromChat` → Resend → `outreach_emails.sent=true` + tracking pixel/click URLs applied. ✅.
10. **Receives a reply** — Resend inbound webhook → `outreach_emails.brand_reply_text` + `replied=true` → classifier flips `free_access_status` if qualifying → `approvals` row of type `reply_received`.
11. **Negotiates** — agent drafts reply via `showReplyDraft`, creator sends manually (`mark_sent`) or via internal reply flow.
12. **Reviews a contract** — ⛔ not implemented. Creator can upload a file to the deal but there's no analysis.
13. **Closes a deal** — creator marks delivered, agent proposes release, escrow status → `funded` → creator confirms → release fn transfers or credits wallet.
14. **Pays MatchAI** — 🐛 **success fee is only displayed, not actually invoiced/debited**. The 3 % escrow platform fee is baked into `net_payout`. Subscription payment happens separately at plan-selection time via Stripe Checkout.

---

## 26. Mocked vs operational matrix

| Feature | UI | Backend | Real integration | E2E | Real data | Status | Main blocker |
|---|---|---|---|---|---|---|---|
| Landing chat | ✅ | ✅ | ✅ Gemini 3-flash-preview | ✅ | live | ✅ | — |
| Sign up / sign in | ✅ | ✅ | ✅ Supabase | ✅ | live | ✅ | — |
| Onboarding (1-screen) | ✅ | ✅ | ✅ | ✅ | live | ✅ | — |
| Apify scrape | ✅ | ✅ | ✅ | 🟡 | live | 🟡 | Actor availability per platform |
| Brand matching | ✅ | ✅ | ✅ Gemini 2.5-pro | ✅ | live | ✅ | Fresh generation each time |
| Demo brands overlay | ✅ | n/a | 🧷 | ✅ | mocked | 🎨 | `DEMO_MODE=true` project-wide |
| Contact discovery | ✅ | ✅ | ✅ Hunter + AI + pattern | ✅ | live | ✅ | Coverage varies |
| Outreach drafting | ✅ | ✅ | ✅ Gemini 2.5-pro | ✅ | live | ✅ | — |
| Outreach sending | ✅ | ✅ | ✅ Resend | ✅ | live | ✅ | Domain reputation |
| Open/click tracking | ✅ | ✅ | ✅ | ✅ | live | ✅ | — |
| Follow-up sequences | ✅ | ✅ | ✅ pg_cron | ✅ | live | ✅ | — |
| Inbound reply webhook | 🟡 | ✅ | ✅ Resend | ✅ | live | ✅ | — |
| Reply classification | ✅ | ✅ | ✅ Gemini 3.6-flash | ✅ | live | ✅ | LLM confidence |
| Gmail send / read | 🎨 (Settings) | ✅ | ✅ Google OAuth | ⛔ | dormant | 🟡 | Not used in shipping flow |
| Deal pipeline | ✅ | ✅ | ✅ | ✅ | live | ✅ | Loose stages |
| Deliverable proof gate | ✅ | ✅ | ✅ | ✅ | live | ✅ | — |
| Contract analysis | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | Not built |
| Rate recommendations | ✅ | ✅ | ✅ | ✅ | live | ✅ | Depends on `pricing_rules` filled |
| Negotiation | 🟡 | 🟡 | ✅ (chat) | 🟡 | live | 🟡 | No structured record |
| Escrow funding | ✅ | ✅ | ✅ Stripe Checkout | ✅ | live | ✅ | `/escrow/funded` route missing |
| Escrow release | ✅ | ✅ | ✅ Stripe transfer | ✅ | live | ✅ | — |
| Wallet ledger | ✅ | ✅ | ✅ | ✅ | live | ✅ | — |
| Stripe Connect payouts | ✅ | ✅ | ✅ | ✅ | live | ✅ | Needs creator onboarding |
| Subscription checkout | ✅ | ✅ | ✅ Stripe Tax | ✅ | live | ✅ | — |
| Success-fee charging | ✅ display | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | Not implemented |
| Analytics (external) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | Not integrated |
| MCP server | n/a | ✅ | ✅ | ✅ | live | ✅ | 4 read-only tools |
| Admin console | 🟡 | 🟡 | 🔌 | 🟡 | live | 🟡 | Minimal |
| Media kit generation | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | Not built |

---

## 27. Bugs & incomplete work

**Critical**
- 🐛 **Success fee is never charged.** `computeFeeBreakdown` and Fair-Deal Guarantee are UI/marketing only. No Stripe invoice item, no PaymentIntent capture, no ledger debit. The primary revenue mechanism is inoperative.
- 🐛 **Free plan quota mismatch** — landing/pricing says 100 pitches/mo; `plans.ts` enforces 25. Users hit a block at 25 with an "Upgrade to Starter for 100" message that reads like the Starter plan is worse than advertised.
- 🐛 **Escrow post-checkout routes missing** — `/escrow/funded` and `/escrow/cancelled` are Stripe success/cancel URLs but no file route exists → 404 or blank after fund/cancel.

**High**
- 🐛 **`DEMO_MODE = true` is a hardcoded constant** applied in production. Real users see the six demo brand cards mixed into their real matches with no visual distinction beyond the `demo-` id prefix.
- 🐛 **Two different fee models coexist** (20 %/10 %/0 % success fee vs 3 % escrow platform fee). The 3 % fee is charged on releases regardless of plan; the marketed 0 % on paid plans is not truly 0 %.
- 🐛 **Agent auto-release default = 3 days** in schema, but the FAQ prompt says 7 days. Contradictory statements to creators.
- 🐛 **Onboarding legacy stubs** (`onboarding.step-1|2|3.tsx`) — dead but reachable if any link points to them.
- 🐛 **`agent-chat.functions.openOutreachDraftInChat` and streamed messages** occasionally double-render; earlier reliability work reduced but didn't remove root cause (mismatch between `initialUIMessages`, `seenIdsRef`, and websocket dedupe).
- 🐛 **Gmail connect UI is present but path is dormant** — confusing.

**Medium**
- 🐛 `qualifiation.functions.ts` still references `google/gemini-3.6-flash` — a model that reportedly returned Forbidden earlier for some projects. Chat agent has already been moved off it.
- 🐛 `reply-value.functions.ts` also uses `google/gemini-3.6-flash` — same risk.
- 🐛 No fallback if Hunter rate-limits or 500s.
- 🐛 No dead-letter for Resend inbound webhook failures beyond console.error.
- 🐛 `showEarnings` treats `deals.deal_value` as USD without currency check.
- 🐛 `poll-replies` hook is a near-stub (36 LOC); relies on Resend inbound webhook exclusively.
- 🐛 Announcement `agent_messages.insert` post-`generateBrandMatches` can spam if triggered repeatedly ("Found N new brand matches…").
- 🐛 `matchai.functions.ts` is 1886 LOC — one file mixes matches, drafting, sending, and utilities.

**Low**
- 🐛 `home.tsx`, `dashboard.index.tsx` stubs.
- 🐛 `api/landing-chat.ts` duplicate.
- 🐛 `analyzeContract` promises not delivered by any code.
- 🐛 `product_feedback` table exists with no UI to write.
- 🐛 `negotiation_messages`, `ai_replies`, `chat_pending_actions` mostly unused.
- 🐛 No `Privacy` / `Terms` routes.
- 🐛 `TrustBar` claims are copy-only.

---

## 28. Product gaps against the core promise

_"MatchAI helps emerging creators find brands, send personalized outreach, manage replies, negotiate deals, and get paid."_

1. **Getting paid — success fee is not actually charged.** Every plan advertises a fee (20 %/10 %/0 %); nothing in code deducts it. Any dollar the creator receives goes to them minus 3 % escrow processing. Consequence: MatchAI can't sustain the free-tier bet.
2. **Contracts** — Promised on the landing FAQ and in agent expertise; no analyzer, no upload flow, no clause detection. Creators cannot "review a contract" inside the product.
3. **Media kit generation** — Referenced in messaging; only upload exists.
4. **Structured negotiation record** — Every negotiation lives in free-text messages. There's no `deliverables_negotiated`, `usage_rights`, `exclusivity_window`, or round-by-round history — so the agent can't learn from a completed negotiation.
5. **Reply-driven pricing recall** — `reply-value` estimator returns `insufficient_info` unless `pricing_rules.configured=true`. Onboarding never asks the creator to price. Most users will hit `insufficient_info` on their first qualified reply — exactly the moment they most need help.
6. **Contact quality** — Hunter cascade is best-effort. Many low-confidence rows will block sending (`send` blocked when confidence='low'), leaving creators stuck.
7. **Real Gmail reply thread** — With outreach going through Resend, threading depends on Resend's inbound webhook. Any brand whose reply hits the creator's own inbox (because they forwarded, cc'd, or the brand replied to a footer address) never enters MatchAI.
8. **Analytics / observability** — No PostHog / Sentry. Founders/operators can't see conversion, drop-off, or errors.
9. **Admin tooling** — Almost nothing. Cannot review AI outputs, correct bad matches, or fix a user's stuck deal.
10. **Legal posture** — No Terms/Privacy, no "not legal advice" disclaimer for contract talk, no CAN-SPAM enforcement when `physical_address` is blank.
11. **Onboarding does not collect enough to personalize well** — one screen skips tone, target audience, dream brands, blocked categories, minimum rate; the AI then falls back to generic voice on the first draft.
12. **Demo-mode leakage** — Real users see fake brands.

---

## 29. Code & file map

**Top-level**
- `src/router.tsx`, `src/server.ts`, `src/start.ts` — Start/Vite bootstrap and middleware.
- `src/styles.css` — Tailwind v4 tokens.
- `.lovable/plan.md`, `.lovable/project.json`.
- `wrangler.jsonc` — Cloudflare Worker config.

**Routes** (`src/routes/`)
- Public landing + auth (see §2).
- Dashboard 10 pages.
- `api.chat.*` — three chat endpoints (agent, landing, onboarding).
- `api.public.*` — webhooks + email pixels.
- `lovable/email/*` — internal transactional infra.
- `[.]lovable.oauth.consent.tsx`, `[.mcp]/*`, `mcp.ts`, `[.well-known]/oauth-protected-resource.ts` — MCP.

**Server functions & helpers** (`src/lib/`)
- **Chat/agent**: `agent-chat.functions.ts` (571), `agent-context.server.ts`, `agent-voice.server.ts` (432), `agent-highlight.ts`, `agent-audit.functions.ts`, `chat-openers.functions.ts`, `chat-auth.server.ts`.
- **AI**: `ai-gateway.server.ts`, `ai-engine.functions.ts`.
- **Matching/outreach**: `matchai.functions.ts` (1886), `matchai-extra.functions.ts` (926), `outreach-sender.server.ts`.
- **Contacts**: `brand-contacts.functions.ts`.
- **Onboarding**: `onboarding-v3.functions.ts`, `onboarding-scrape.functions.ts`.
- **Apify**: `apify.functions.ts` + `apify.server.ts`.
- **Deals**: `dashboard.functions.ts` (646), `top-actions.functions.ts`, `dispute.functions.ts`, `journey.functions.ts`, `insights.functions.ts`, `campaigns.functions.ts`, `qualification.functions.ts`, `reply-value.functions.ts`.
- **Payments**: `payments.functions.ts` (322), `escrow.functions.ts`, `wallet.functions.ts`, `public-pay.functions.ts`, `pricing-config.ts`, `plans.ts`, `break-even.functions.ts`.
- **Email**: `email-templates/` + `outreach-sender.server.ts` + `suppression.functions.ts` + email queue routes.
- **Gmail**: `gmail.functions.ts` (dormant).
- **Autonomy / creator setup**: `autonomy.functions.ts`, `creator-setup.ts`, `demo-mode.ts`.
- **Verification**: `verification.functions.ts`, `verification.server.ts`.
- **MCP**: `mcp/index.ts` + `mcp/supabase.ts` + 4 tools.
- **Misc**: `open-email-in-chat.ts`, `utils.ts`, `error-capture.ts`, `error-page.ts`, `analytics.functions.ts`.

**Components** (`src/components/`)
- `chat/` (agent panel, cursor, activity, cards, landing widget).
- `dashboard/` (sidebar, tabs, top bar, banners, journey, digest, strip, stat card, loaders, welcome modal, opportunity screen).
- `hero/` (~28 landing components — see file map in §2).
- `settings/` (agent personalization, compliance, creator setup).
- `email/` (attachment picker).
- `motion/`, `onboarding/`, `verification/`, `brand/`, `icons/`, `ui/` (shadcn).

**Tests**: none in the repo.

---

## 30. Final executive summary

**What works today**
- Sign-up / onboarding / dashboard shell / chat streaming.
- AI brand matching (Gemini 2.5-pro).
- AI outreach drafting with structured JSON + quality-check.
- Resend sending, tracking, follow-up scheduling, inbound webhook, suppression + CAN-SPAM headers.
- Rule-based + LLM reply classification and free-access-status gate.
- Stripe Checkout escrow + Stripe Connect Express + wallet ledger with dispute + auto-release.
- Subscription checkout with Stripe Tax.
- MCP server exposing 4 read-only tools.
- pgmq + pg_cron email queue.

**Appears functional but is mocked**
- 6 hardcoded demo brand opportunities in production.
- Landing "38 signals" claim.
- Landing "100 pitches on Free" (enforcement is 25).
- Success-fee accounting (displayed, not charged).

**Partially built**
- Deal pipeline (loose statuses).
- Analytics page (only counts, no funnel).
- Admin (role gate exists, features minimal).
- Gmail send/read (present but dormant).
- Negotiation (chat-driven, unstructured).
- Reply-value estimator (returns `insufficient_info` unless `pricing_rules.configured`).

**Completely missing**
- Contract analysis / disclaimers.
- Media-kit generation.
- Success-fee capture.
- Sentry / PostHog / GA.
- Privacy / Terms routes.
- `/escrow/funded` and `/escrow/cancelled` post-checkout pages.
- Apollo / Clay / PDL / LinkedIn contact sources.
- Structured negotiation history.

**Top 10 product blockers**
1. Success fee not actually charged (revenue).
2. Free-plan quota mismatch (trust).
3. Escrow success/cancel routes missing (funnel).
4. Demo brands leak into production (trust).
5. No contract review (promise gap).
6. Pricing rules require manual setup for reply-value to work (activation).
7. Onboarding collects too little to personalize outreach.
8. No media-kit output.
9. No structured negotiation record.
10. No admin tools to correct AI outputs.

**Top 10 technical blockers**
1. `matchai.functions.ts` at 1886 LOC — monolith.
2. Two model families in flight (2.5-flash, 2.5-pro, 3-flash-preview, 3.6-flash) with occasional Forbidden risk on 3.6.
3. No observability (Sentry, alerts).
4. No unit / integration tests.
5. No rate limiting on chat and match endpoints.
6. No bounce handling from Resend.
7. `poll-replies` cron is a near-stub.
8. No structured event/analytics pipeline.
9. Gmail integration is dead code.
10. Custom auth-gate on `/dashboard/*` instead of the managed `_authenticated/` layout — hard-refresh loop risk.

**Top 10 security / legal risks**
1. Success-fee unenforced → likely misrepresentation on a paid product.
2. Landing quota misstatement.
3. Demo data shown as if real.
4. No Terms / Privacy pages.
5. No "not legal advice" disclaimer while agent negotiates.
6. Missing `physical_address` doesn't block sends (CAN-SPAM edge).
7. No bounce list — sending to invalid addresses accumulates penalties.
8. Prompt-injection surface via inbound replies.
9. No general rate limits.
10. `DEMO_MODE = true` in production widens the misrepresentation surface.

**Readiness scores (0–10)**

| Area | Score | Justification |
|---|---|---|
| Landing page | 8 | Strong copy + demo but contains unverified claims (100 pitches, 38 signals). |
| Onboarding | 6 | Fast and pretty, but too little collected for personalization. |
| Chat experience | 8 | Streaming works, tools rich, personality strong; some duplication under stress. |
| Brand discovery | 7 | Real AI, weighted scoring, dedupe; still fully model-generated, no ground-truth brand DB. |
| Contact quality | 6 | Hunter + AI + pattern cascade; low-confidence rate is high; no verification. |
| Outreach | 8 | Structured schema, quality checks, Resend + tracking, follow-ups — solid. |
| Inbox & replies | 7 | Classifier is good; Resend inbound is the only ingestion channel; missing classes. |
| Deal CRM | 6 | Works, but stage model is loose and multi-status. |
| Negotiation | 4 | Chat-only, unstructured, no round history. |
| Contracts | 1 | Effectively not built. |
| Payments | 6 | Escrow + Connect solid; success-fee capture missing; escrow return routes 404. |
| Backend reliability | 6 | Correct patterns, no tests, no monitoring. |
| Security | 6 | RLS + Zod + Stripe webhook idempotency; missing rate limits, legal disclaimers. |
| Mobile experience | 5 | Drawer works; layouts are compressed. |
| Overall MVP readiness | 6 | Impressive breadth; blocked by unimplemented monetization and unfulfilled promises (contracts, quota, demo leakage). |

_End of audit._
