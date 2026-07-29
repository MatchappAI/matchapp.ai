import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";
import { sendOutreach } from "./outreach-sender.server";
import {
  PLANS,
  resolvePlan,
  currentMonthYear,
  USAGE_ACTION_OUTREACH_SEND,
  type PlanSlug,
} from "./plans";

/* ---------------- Brand matching with secondary scoring ---------------- */

const ScoreBreakdownSchema = z.object({
  audience_fit: z.number().int().min(0).max(100),
  category_fit: z.number().int().min(0).max(100),
  sponsorship_likelihood: z.number().int().min(0).max(100),
  conversion_potential: z.number().int().min(0).max(100),
  deal_value_potential: z.number().int().min(0).max(100),
  brand_credibility_fit: z.number().int().min(0).max(100),
  outreach_timing: z.number().int().min(0).max(100),
  relationship_path: z.number().int().min(0).max(100),
  competitive_white_space: z.number().int().min(0).max(100),
  creator_leverage: z.number().int().min(0).max(100),
});

const SCORE_WEIGHTS = {
  audience_fit: 0.2,
  category_fit: 0.15,
  sponsorship_likelihood: 0.15,
  conversion_potential: 0.15,
  deal_value_potential: 0.1,
  brand_credibility_fit: 0.1,
  outreach_timing: 0.05,
  relationship_path: 0.05,
  competitive_white_space: 0.03,
  creator_leverage: 0.02,
} as const;

function computeWeightedScore(b: z.infer<typeof ScoreBreakdownSchema>): number {
  let total = 0;
  for (const [k, w] of Object.entries(SCORE_WEIGHTS)) {
    total += (b[k as keyof typeof SCORE_WEIGHTS] ?? 0) * w;
  }
  return Math.round(Math.max(0, Math.min(100, total)));
}

function matchLabelFor(score: number): string {
  if (score >= 90) return "Strong Match";
  if (score >= 80) return "Good Match";
  if (score >= 70) return "Worth Testing";
  if (score >= 60) return "Low Priority";
  return "Do Not Recommend";
}

const MatchListSchema = z.object({
  brands: z
    .array(
      z.object({
        brand_name: z.string(),
        brand_industry: z.string(),
        fit_reasoning: z.string(),
        estimated_deal_min: z.number().int().min(0),
        estimated_deal_max: z.number().int().min(0),
        suggested_package: z.string(),
        outreach_angle: z.string(),
        market_type: z.enum(["local", "international"]),
        my_take: z.string(),
        partnership_angle: z.string(),
        potential_risk: z.string(),
        recommended_next_move: z.string(),
        score_breakdown: ScoreBreakdownSchema,
        why_creator_fits: z.string(),
        why_brand_cares: z.string(),
        top_reasons: z.array(z.string()).min(1).max(4),
        suggested_deliverables: z.array(z.string()).min(1).max(6),
        best_outreach_channel: z.string(),
        contact_path: z.string(),
        what_to_avoid: z.string(),
      }),
    )
    .min(1)
    .max(20),
});

function tokenize(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function audienceAlignment(niche: string | null, industry: string) {
  const n = (niche ?? "").toLowerCase();
  const i = industry.toLowerCase();
  if (!n || !i) return 0;
  if (n === i) return 30;
  if (n.includes(i) || i.includes(n)) return 30;
  const nt = new Set(tokenize(n));
  const it = new Set(tokenize(i));
  for (const w of nt) if (it.has(w)) return 15;
  return 0;
}

export const generateBrandMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) return { ok: false as const, error: "AI not configured" };

    const [{ data: profile }, { data: prefs }] = await Promise.all([
      supabaseAdmin.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin
        .from("brand_preferences")
        .select("preferred_categories,blocked_categories")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const { data: stats } = await supabaseAdmin
      .from("platform_stats")
      .select("engagement_rate,follower_count,top_content_categories")
      .eq("user_id", userId);

    const minDealValue = profile?.min_deal_value ?? 0;
    const preferred = tokenize(prefs?.preferred_categories);
    const blocked = tokenize(prefs?.blocked_categories);
    const marketScope =
      (profile?.market_scope as "local" | "international" | "both" | null) ?? "both";
    const creatorLocation = profile?.location ?? null;
    const avgEngagement =
      (stats ?? []).reduce((s, x) => s + Number(x.engagement_rate ?? 0), 0) /
      Math.max(1, stats?.length ?? 1);

    // Profile-completeness gate: don't guess matches without minimum context.
    const missing: string[] = [];
    if (!profile?.niche) missing.push("niche");
    if (!profile?.primary_platform) missing.push("platform");
    if (!creatorLocation) missing.push("city");
    const totalFollowers = (stats ?? []).reduce((s, x) => s + Number(x.follower_count ?? 0), 0);
    if (totalFollowers <= 0) missing.push("follower count");
    if (!avgEngagement) missing.push("engagement rate");
    if (missing.length >= 3) {
      return {
        ok: false as const,
        error: "Profile incomplete",
        missing,
        empty_state:
          "To find better matches, add your niche, city, platform, follower count, engagement rate, and audience details.",
      };
    }

    const scopeInstruction =
      marketScope === "local"
        ? `ONLY return brands that operate in ${creatorLocation ?? "the creator's country"} (local market). Every brand must have market_type "local".`
        : marketScope === "international"
          ? `ONLY return international/global brands. Every brand must have market_type "international". Do NOT include hyper-local-only businesses.`
          : `Return a mix, but PRIORITIZE brands physically close to the creator (${creatorLocation ?? "the creator's country"}): same city > same region/state > same country > ships to creator's country > international. Local proximity closes deals faster (cheaper/faster sample shipping, shared timezone for replies, possible in-person meets, local relevance in content). Aim for AT LEAST 5 of 12 brands to be same-city/region/country. Tag each brand's market_type as "local" or "international".`;

    const system = `You are a brand-matching engine for a creator under 100K. Think like a real personal brand-deals agent: who would actually pay this creator, and why? Score each brand rigorously across 10 dimensions.

Return JSON ONLY (no markdown):
{ "brands": [{
  "brand_name": string,
  "brand_industry": string,                     // short category: "Restaurant", "Fitness studio", "SaaS", "Beauty", "Travel/Hotel", "Events", "Professional services", etc.
  "fit_reasoning": string,                      // 1 short sentence
  "estimated_deal_min": int,                    // USD
  "estimated_deal_max": int,                    // USD
  "suggested_package": string,                  // concise package summary
  "outreach_angle": string,                     // one-line pitch angle
  "market_type": "local" | "international",
  "my_take": string,                            // 1 sentence agent voice
  "partnership_angle": string,                  // concrete content idea
  "potential_risk": string,                     // "" if none
  "recommended_next_move": string,
  "score_breakdown": {
    "audience_fit": int 0-100,                  // does the brand's customer overlap with the creator's audience?
    "category_fit": int 0-100,                  // does this category match the creator's niche/content?
    "sponsorship_likelihood": int 0-100,        // does this brand actually pay creators of this size?
    "conversion_potential": int 0-100,          // will the audience act on it?
    "deal_value_potential": int 0-100,          // can it clear the creator's rate floor?
    "brand_credibility_fit": int 0-100,         // would the creator be proud to post this?
    "outreach_timing": int 0-100,               // is now a good moment (new launch, season, event)?
    "relationship_path": int 0-100,             // is there a warm path or clear contact?
    "competitive_white_space": int 0-100,       // is this niche under-saturated for the creator?
    "creator_leverage": int 0-100               // does the creator have a uniquely strong angle here?
  },
  "why_creator_fits": string,                   // 1-2 sentences explaining audience+content overlap
  "why_brand_cares": string,                    // 1-2 sentences in the brand's POV (ROI / reach / story)
  "top_reasons": [string, string],              // EXACTLY 2 short bullet reasons (max ~10 words each)
  "suggested_deliverables": [string],           // 2-4 concrete deliverables ("1x Reel + 3x Stories")
  "best_outreach_channel": string,              // "Email", "DM on Instagram", "LinkedIn DM", etc.
  "contact_path": string,                       // one sentence on who to reach (e.g. "Marketing Manager via press@brand.com")
  "what_to_avoid": string                       // 1 sentence — what would make this fall flat
}] }

Return 12 real companies tailored to the creator's niche, platform, and audience.
${scopeInstruction}
Never invent fake brand names. Never include brands in the creator's blocked categories.
Tone: calm, specific, no hype, no buzzwords ("workflow", "synergy", "leverage", "optimize" are banned).
Score breakdowns must be honest — many brands should score below 70 in at least one dimension.`;

    let raw: z.infer<typeof MatchListSchema>;
    try {
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const model = gateway("google/gemini-2.5-pro");
      const { text } = await generateText({
        model,
        system,
        prompt: `Creator profile:\n${JSON.stringify(
          {
            niche: profile?.niche,
            platform: profile?.primary_platform,
            handle: profile?.handle,
            location: creatorLocation,
            market_scope: marketScope,
            min_deal_value: minDealValue,
            preferred_categories: preferred,
            blocked_categories: blocked,
            top_categories: stats?.flatMap((s) => s.top_content_categories ?? []) ?? [],
            avg_engagement: avgEngagement,
          },
          null,
          2,
        )}`,
      });
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      raw = MatchListSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      console.error("[brand-match] ai failed", e);
      return { ok: false as const, error: "Brand generation failed" };
    }

    const rows = raw.brands
      .map((b) => {
        const niche = profile?.niche ?? null;
        const audience = audienceAlignment(niche, b.brand_industry);

        let deal = 0;
        if (minDealValue <= 0 || b.estimated_deal_min >= minDealValue) deal = 25;
        else if (b.estimated_deal_min >= minDealValue * 0.8) deal = 10;

        const industryLower = b.brand_industry.toLowerCase();
        let pref = 0;
        if (blocked.some((b2) => industryLower.includes(b2) || b2.includes(industryLower))) {
          pref = -100;
        } else if (preferred.some((p) => industryLower.includes(p) || p.includes(industryLower))) {
          pref = 25;
        }

        let engagement = 0;
        if (avgEngagement >= 5) engagement = 20;
        else if (avgEngagement >= 3) engagement = 10;

        const fit_quality_score = Math.max(0, Math.min(100, audience + deal + pref + engagement));
        const weighted = computeWeightedScore(b.score_breakdown);
        const match_label = matchLabelFor(weighted);
        const blockedFlag = pref < 0;

        return { ...b, fit_score: weighted, fit_quality_score, match_label, blockedFlag };
      })
      .filter((b) => !b.blockedFlag);

    if (rows.length === 0)
      return { ok: false as const, error: "All matches filtered out by preferences" };

    // One funnel per brand: never wipe in-flight rows. Only clear stale "new"/"queued"
    // rows so the fresh AI pass can replace them, and dedupe by normalized brand name.
    await supabaseAdmin
      .from("brand_matches")
      .delete()
      .eq("user_id", userId)
      .in("status", ["new", "queued"]);

    const { data: existing } = await supabaseAdmin
      .from("brand_matches")
      .select("brand_name")
      .eq("user_id", userId);
    const taken = new Set((existing ?? []).map((r) => (r.brand_name ?? "").trim().toLowerCase()));

    const seen = new Set<string>();
    const freshRows = rows.filter((b) => {
      const key = (b.brand_name ?? "").trim().toLowerCase();
      if (!key || seen.has(key) || taken.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (freshRows.length === 0) {
      return { ok: true as const, count: 0 };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("brand_matches")
      .insert(
        freshRows.map((b) => ({
          user_id: userId,
          brand_name: b.brand_name,
          brand_industry: b.brand_industry,
          fit_score: b.fit_score,
          fit_quality_score: b.fit_quality_score,
          fit_reasoning: b.fit_reasoning,
          estimated_deal_min: b.estimated_deal_min,
          estimated_deal_max: b.estimated_deal_max,
          suggested_package: b.suggested_package,
          outreach_angle: b.outreach_angle,
          market_type: b.market_type,
          my_take: b.my_take,
          partnership_angle: b.partnership_angle,
          potential_risk: b.potential_risk,
          recommended_next_move: b.recommended_next_move,
          score_breakdown: b.score_breakdown,
          match_label: b.match_label,
          why_creator_fits: b.why_creator_fits,
          why_brand_cares: b.why_brand_cares,
          top_reasons: b.top_reasons,
          suggested_deliverables: b.suggested_deliverables,
          best_outreach_channel: b.best_outreach_channel,
          contact_path: b.contact_path,
          what_to_avoid: b.what_to_avoid,
          // Trust Pass: mark every real AI-generated match so demo rows never
          // silently mix with real ones and admins can audit provenance.
          is_demo: false,
          data_source: "real_ai_match",
        })),
      )
      .select("id,brand_name,brand_industry,market_type");

    if (error) {
      console.error("[brand-match] insert failed", error);
      return { ok: false as const, error: "Failed to save brand matches. Please try again." };
    }

    // Fire-and-forget: discover best contact email for each new match.
    if (inserted && inserted.length > 0) {
      import("./brand-contacts.functions")
        .then((m) => m.backgroundDiscoverContacts(userId, inserted))
        .catch((e) => console.error("[brand-match] contact discovery failed", e));
    }

    // Track usage (best-effort)
    try {
      const monthYear = new Date().toISOString().slice(0, 7);
      const { data: existing } = await supabaseAdmin
        .from("usage_tracking")
        .select("id,count")
        .eq("user_id", userId)
        .eq("action_type", "match_brands")
        .eq("month_year", monthYear)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("usage_tracking")
          .update({ count: (existing.count ?? 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("usage_tracking")
          .insert({
            user_id: userId,
            action_type: "match_brands",
            month_year: monthYear,
            count: 1,
          });
      }
    } catch (e) {
      console.error("[brand-match] usage track failed", e);
    }

    // Post a 2-sentence agent chat message announcing the matches
    try {
      const sorted = [...freshRows].sort(
        (a, b) => (b.fit_quality_score ?? 0) - (a.fit_quality_score ?? 0),
      );
      const top = sorted[0];
      const skipped = rows.length - freshRows.length;
      const skipNote = skipped > 0 ? ` Skipped ${skipped} you already have in flight.` : "";
      const summary = top
        ? `Found ${freshRows.length} new brand matches.${skipNote} ${top.brand_name} is your best fit at ${top.fit_quality_score}% — want to pitch them?`
        : `No new brands to add — you're already running funnels for the top candidates.`;
      await supabaseAdmin.from("agent_messages").insert({
        user_id: userId,
        role: "assistant",
        content: summary,
        inline_card_type: null,
        inline_card_data: null,
        action_triggered: null,
        requires_approval: false,
        approval_status: "none",
      });
    } catch (e) {
      console.error("[brand-match] chat post failed", e);
    }

    return { ok: true as const, count: freshRows.length };
  });

export const listBrandMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("brand_matches")
      .select("*")
      .eq("user_id", userId)
      .order("fit_quality_score", { ascending: false, nullsFirst: false })
      .order("fit_score", { ascending: false });
    return { brands: data ?? [] };
  });

/* ---------------- Outreach ---------------- */

const DraftOutreachSchema = z.object({ brand_match_id: z.string().uuid() });

export const draftOutreachForBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DraftOutreachSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) return { ok: false as const, error: "AI not configured" };

    const { data: brand } = await supabaseAdmin
      .from("brand_matches")
      .select("*")
      .eq("user_id", userId)
      .eq("id", data.brand_match_id)
      .maybeSingle();
    if (!brand) return { ok: false as const, error: "Brand not found" };

    // One outreach per company: if an active (non-cancelled) draft already exists
    // for this brand, return it instead of creating a duplicate.
    const { data: existingOutreach } = await supabaseAdmin
      .from("outreach_emails")
      .select("id")
      .eq("user_id", userId)
      .eq("brand_match_id", brand.id)
      .eq("cancelled", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingOutreach) {
      return {
        ok: true as const,
        outreach_id: existingOutreach.id,
        existing: true as const,
      };
    }

    // Pull deep personalization context.
    const [
      { data: profile },
      { data: prefs },
      { data: stats },
      { data: insights },
      { data: pastOutreach },
    ] = await Promise.all([
      supabaseAdmin.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin
        .from("brand_preferences")
        .select("preferred_categories, blocked_categories, values_to_avoid, additional_notes")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("platform_stats")
        .select("top_content_categories, engagement_rate, follower_count")
        .eq("user_id", userId),
      supabaseAdmin
        .from("learning_insights")
        .select("insight_title, recommendation")
        .eq("user_id", userId)
        .eq("applied", true)
        .limit(5),
      supabaseAdmin
        .from("outreach_emails")
        .select("subject, body, replied")
        .eq("user_id", userId)
        .eq("sent", true)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const { data: pricing } = await supabaseAdmin
      .from("pricing_rules")
      .select("rate_floor, target_rate, walk_away_rate")
      .eq("user_id", userId)
      .maybeSingle();

    const { getBestContactEmail } = await import("./brand-contacts.functions");
    const contact = await getBestContactEmail(brand.id);
    const { getCampaignBriefForBrand } = await import("./campaigns.functions");
    const campaignBrief = await getCampaignBriefForBrand({ userId, brandMatchId: brand.id });

    const {
      AGENT_VOICE_PRINCIPLES,
      REDDIT_AUTHENTICITY_PRINCIPLES,
      OUTREACH_QUALITY_STANDARD,
      inferBrandCategory,
      categoryStyleGuide,
      personalizedVoiceGuide,
    } = await import("./agent-voice.server");

    const category = inferBrandCategory(brand.brand_industry);
    const styleGuide = categoryStyleGuide(category);
    const voiceGuide = personalizedVoiceGuide(profile);

    const themes = [
      ...new Set(
        (stats ?? []).flatMap(
          (s) => (s as { top_content_categories?: string[] }).top_content_categories ?? [],
        ),
      ),
    ].slice(0, 6);

    const personalizationContext = {
      creator: {
        name: profile?.full_name ?? null,
        handle: profile?.handle ?? null,
        platform: profile?.primary_platform ?? null,
        niche: profile?.niche ?? null,
        tone: profile?.tone ?? null,
        content_style: profile?.content_style ?? null,
        target_audience: profile?.target_audience ?? null,
        audience_age: profile?.audience_age_band ?? null,
        location: profile?.location ?? null,
        top_themes: themes,
        bio: profile?.bio?.slice(0, 300) ?? null,
        market_scope: profile?.market_scope ?? null,
        gifted_ok: profile?.gifted_products_accepted ?? null,
        rate_floor: pricing?.rate_floor ?? null,
      },
      brand: {
        name: brand.brand_name,
        industry: brand.brand_industry,
        market_type: brand.market_type ?? null,
        category_style: category,
        suggested_angle: brand.outreach_angle ?? null,
        suggested_package: brand.suggested_package ?? null,
        my_take: brand.my_take ?? null,
        partnership_angle: brand.partnership_angle ?? null,
      },
      contact: { name: contact.name, title: contact.title },
      preferences: {
        likes: prefs?.preferred_categories ?? null,
        avoid: prefs?.blocked_categories ?? null,
        values_avoid: prefs?.values_to_avoid ?? null,
        creator_notes: prefs?.additional_notes ?? null,
      },
      learning: (insights ?? []).map((i) => i.insight_title),
      past_winning_subjects: (pastOutreach ?? [])
        .filter((o) => o.replied)
        .map((o) => o.subject)
        .slice(0, 3),
      campaign_brief: campaignBrief ? { name: campaignBrief.name, ...campaignBrief.brief } : null,
    };

    const system = `${AGENT_VOICE_PRINCIPLES}

${REDDIT_AUTHENTICITY_PRINCIPLES}

${voiceGuide}

${OUTREACH_QUALITY_STANDARD}


# Brand category style for THIS pitch
Category: ${category}
Style guide: ${styleGuide}

# Output format
Return STRICT JSON only (no markdown, no commentary):
{
  "subject": string,                    // 4-9 words, specific, NOT "Partnership:" / "Collab:" / "Opportunity"
  "subject_variants": string[],         // 2 alternative subjects, same rules, distinctly different angles
  "body": string,                       // 70-140 words plain text, line breaks ok, no markdown
  "ai_reason": string,                  // 1-2 sentences: the strategic choice you made and why for THIS pair
  "personalization_used": string,       // bullet list ("- " prefix) — human-readable summary of the signals actually stitched in
  "signals_used": [                     // STRUCTURED — one entry per real signal you used. 4-10 entries. No filler.
    {
      "category": "brand_fit" | "creator_content" | "personalization" | "pricing_offer",
      "signal": string,                 // short label (e.g. "Recent product launch", "Top content theme", "Audience geo overlap", "Rate floor anchor")
      "value_from_context": string,     // the exact value you read from the context (quote it, don't paraphrase)
      "used_in": "subject" | "hook" | "why_me" | "idea" | "offer" | "ask",
      "how_it_shaped_the_email": string // 1 sentence, concrete: what line/word/angle this drove
    }
  ],
  "send_time_suggestion": {
    "day_of_week": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
    "local_hour_24": number,            // 0-23, in the brand contact's likely local time
    "why": string                       // 1 short sentence tying it to industry/inbox behavior
  },
  "quality_check": {
    "specific_to_brand": boolean,
    "specific_to_creator": boolean,
    "clear_ask": boolean,
    "short_enough": boolean,
    "no_fake_praise": boolean,
    "no_banned_phrases": boolean,
    "safe_facts_only": boolean,
    "signals_are_real": boolean         // every signals_used[].value_from_context appears verbatim in the personalization context
  }
}

# Hard constraints
- Address ${contact.name ? `the contact "${contact.name}" by first name` : `"Hi ${brand.brand_name} team,"`}.
- Match the creator's tone: ${profile?.tone ?? "casual and warm"}.
- Every signals_used entry MUST cite a value that literally exists in the personalization context above. If a signal is missing, DO NOT include it — use a safer general angle. Never fabricate.
- Cover at least 2 of the 4 categories in signals_used (brand_fit, creator_content, personalization, pricing_offer).
- All eight quality_check booleans MUST be true. If any would be false, REWRITE before returning.
- If the draft uses any banned phrase or feels like a template, REWRITE.`;

    const prompt = `Personalization context:\n${JSON.stringify(personalizationContext, null, 2)}\n\nWrite the outreach now.`;

    let parsed: {
      subject: string;
      subject_variants: string[];
      body: string;
      ai_reason: string;
      personalization_used: string;
      signals_used: Array<{
        category: "brand_fit" | "creator_content" | "personalization" | "pricing_offer";
        signal: string;
        value_from_context: string;
        used_in: "subject" | "hook" | "why_me" | "idea" | "offer" | "ask";
        how_it_shaped_the_email: string;
      }>;
      send_time_suggestion: {
        day_of_week: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
        local_hour_24: number;
        why: string;
      };
      quality_check: Record<string, boolean>;
    };
    try {
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const model = gateway("google/gemini-2.5-pro");
      const { text } = await generateText({ model, system, prompt });
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const obj = JSON.parse(cleaned);
      parsed = z
        .object({
          subject: z.string().min(3).max(200),
          subject_variants: z.array(z.string().min(3).max(200)).default([]),
          body: z.string().min(20),
          ai_reason: z.string(),
          personalization_used: z.string(),
          signals_used: z
            .array(
              z.object({
                category: z.enum([
                  "brand_fit",
                  "creator_content",
                  "personalization",
                  "pricing_offer",
                ]),
                signal: z.string().min(1),
                value_from_context: z.string().min(1),
                used_in: z.enum(["subject", "hook", "why_me", "idea", "offer", "ask"]),
                how_it_shaped_the_email: z.string().min(1),
              }),
            )
            .default([]),
          send_time_suggestion: z
            .object({
              day_of_week: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
              local_hour_24: z.number().int().min(0).max(23),
              why: z.string().min(1),
            })
            .optional()
            .default({
              day_of_week: "Tue",
              local_hour_24: 10,
              why: "Tuesday mid-morning is a low-noise inbox window for most brand teams.",
            }),
          quality_check: z.record(z.string(), z.boolean()),
        })
        .parse(obj);
    } catch (e) {
      console.error("[outreach-draft] failed", e);
      return { ok: false as const, error: "Draft failed" };
    }

    const { data: oe, error } = await supabaseAdmin
      .from("outreach_emails")
      .insert({
        user_id: userId,
        brand_match_id: brand.id,
        subject: parsed.subject,
        body: parsed.body,
        ai_generated: true,
        ai_reason: parsed.ai_reason,
        personalization_used: parsed.personalization_used,
        category_style: category,
        quality_check: parsed.quality_check,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[outreach] insert failed", error);
      return { ok: false as const, error: "Failed to save outreach draft. Please try again." };
    }

    const { data: approval } = await supabaseAdmin
      .from("approvals")
      .insert({
        user_id: userId,
        approval_type: "outreach_draft",
        brand_name: brand.brand_name,
        related_id: oe.id,
        related_table: "outreach_emails",
        ai_recommendation: parsed.ai_reason,
        what_happens_next:
          "Nothing sends automatically. You can review the draft, copy it, or mark it as sent — and the deal opens internally either way.",
      })
      .select("id")
      .single();

    // brand_matches.status only moves to "pitched" after explicit send approval.

    // Insert an inline review card into the agent chat so the user can
    // approve / edit / send right from the chat panel. Nothing actually
    // sends until the user clicks "Approve and send" in the card.
    await supabaseAdmin.from("agent_messages").insert({
      user_id: userId,
      role: "assistant",
      content: `Drafted outreach to ${brand.brand_name}. ${parsed.ai_reason}`,
      requires_approval: true,
      action_triggered: "send_outreach",
      inline_card_type: "outreach_review",
      inline_card_data: {
        outreachId: oe.id,
        approvalId: approval?.id ?? null,
        brand_name: brand.brand_name,
        to_email: contact.email ?? "",
        contact_name: contact.name ?? null,
        contact_title: contact.title ?? null,
        contact_source: contact.source ?? null,
        contact_confidence: contact.confidence ?? null,
        subject: parsed.subject,
        subject_variants: parsed.subject_variants ?? [],
        body: parsed.body,
        personalization_used: parsed.personalization_used,
        signals_structured: parsed.signals_used ?? [],
        send_time_suggestion: parsed.send_time_suggestion ?? null,
        ai_reason: parsed.ai_reason,
      },
    });

    return { ok: true as const, outreach_id: oe.id };
  });

/* ---------------- Send outreach from chat (explicit click gate) ---------------- */

const SendFromChatSchema = z.object({
  messageId: z.string().uuid(),
  outreachId: z.string().uuid(),
  approvalId: z.string().uuid().nullable().optional(),
  to: z.string().email().or(z.literal("")),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
  mode: z.enum(["send", "mark_sent"]),
  autonomyLevel: z.number().int().min(0).max(3).optional(),
});

export const sendOutreachFromChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendFromChatSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Validate the chat message belongs to this user and still needs approval.
    const { data: msg } = await supabaseAdmin
      .from("agent_messages")
      .select("id, user_id, requires_approval, approval_status")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!msg) return { ok: false as const, error: "Approval not found" };
    if (msg.approval_status === "executed") {
      return { ok: false as const, error: "Already sent" };
    }

    if (data.mode === "send" && !data.to) {
      return { ok: false as const, error: "Add a recipient email first" };
    }

    // -------- Low-confidence contact guard --------
    // Never fire an unverified/guessed address in `send` mode. `mark_sent`
    // (creator sends manually elsewhere) is still allowed.
    if (data.mode === "send" && data.to) {
      const { data: outreachRow } = await supabaseAdmin
        .from("outreach_emails")
        .select("brand_match_id")
        .eq("user_id", userId)
        .eq("id", data.outreachId)
        .maybeSingle();
      if (outreachRow?.brand_match_id) {
        const { data: contact } = await supabaseAdmin
          .from("brand_contacts")
          .select("email, confidence")
          .eq("user_id", userId)
          .eq("brand_match_id", outreachRow.brand_match_id)
          .eq("email", data.to)
          .maybeSingle();
        if (contact && contact.confidence === "low") {
          return {
            ok: false as const,
            error:
              "This contact is low confidence — verify the address (or pick a better one) before sending.",
          };
        }
      }
    }

    // -------- Plan-aware pitch quota gate --------
    // Read the user's current plan and this-month outbound send count, then
    // block (with a clear upgrade hint) if they're already at their cap.
    const monthYear = currentMonthYear();
    const { data: planProfile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const planDef = resolvePlan(planProfile?.plan);
    const { data: usageRow } = await supabaseAdmin
      .from("usage_tracking")
      .select("id,count")
      .eq("user_id", userId)
      .eq("action_type", USAGE_ACTION_OUTREACH_SEND)
      .eq("month_year", monthYear)
      .maybeSingle();
    const used = usageRow?.count ?? 0;
    if (Number.isFinite(planDef.monthlyPitchQuota) && used >= planDef.monthlyPitchQuota) {
      const nextPlan: PlanSlug | null =
        planDef.slug === "free"
          ? "starter"
          : planDef.slug === "starter"
            ? "growth"
            : planDef.slug === "growth"
              ? "pro"
              : null;
      const upgradeHint = nextPlan
        ? ` Upgrade to ${PLANS[nextPlan].name} for ${PLANS[nextPlan].monthlyPitchQuota} pitches/mo.`
        : "";
      await supabaseAdmin
        .from("agent_messages")
        .update({
          approval_status: "failed",
          action_result: {
            error: "quota_exceeded",
            plan: planDef.slug,
            used,
            limit: planDef.monthlyPitchQuota,
          },
        })
        .eq("id", data.messageId);
      return {
        ok: false as const,
        error: `You've used all ${planDef.monthlyPitchQuota} pitches on the ${planDef.name} plan this month.${upgradeHint}`,
      };
    }

    let sendResult: { messageId?: string | null; threadId?: string | null } = {};
    try {
      if (data.mode === "send") {
        const r = await sendOutreach({
          userId,
          to: data.to,
          subject: data.subject,
          body: data.body,
          outreachId: data.outreachId,
          autonomyLevel: data.autonomyLevel,
        });
        if (!r.ok) throw new Error(r.error);
        sendResult = { messageId: r.messageId, threadId: r.threadId };
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Send failed";
      console.error("[sendOutreachFromChat]", err);
      await supabaseAdmin
        .from("agent_messages")
        .update({ approval_status: "failed", action_result: { error: err } })
        .eq("id", data.messageId);
      return { ok: false as const, error: err };
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("outreach_emails")
      .update({
        sent: true,
        sent_at: now,
        to_email: data.to || null,
        subject: data.subject,
        body: data.body,
        gmail_message_id: sendResult.messageId ?? null,
        gmail_thread_id: sendResult.threadId ?? null,
      })
      .eq("user_id", userId)
      .eq("id", data.outreachId);

    if (data.approvalId) {
      await supabaseAdmin
        .from("approvals")
        .update({ status: "approved" })
        .eq("user_id", userId)
        .eq("id", data.approvalId);
    }

    // Move the brand to "pitched" now that we actually sent / recorded a send.
    const { data: oeRow } = await supabaseAdmin
      .from("outreach_emails")
      .select("brand_match_id")
      .eq("id", data.outreachId)
      .maybeSingle();
    if (oeRow?.brand_match_id) {
      await supabaseAdmin
        .from("brand_matches")
        .update({ status: "pitched" })
        .eq("id", oeRow.brand_match_id)
        .eq("user_id", userId);
    }

    // Schedule an open-ended follow-up cadence. No hard cap — we keep
    // nudging until the brand replies (cron auto-cancels on reply).
    const days = [2, 5, 9, 14, 21, 30, 45, 60, 75, 90];
    const autoApprove = data.mode === "send";
    const scheduledRows = days.map((d, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return {
        user_id: userId,
        outreach_id: data.outreachId,
        sequence_number: i + 1,
        scheduled_at: dt.toISOString(),
        approved: autoApprove,
      };
    });
    await supabaseAdmin.from("follow_up_sequences").insert(scheduledRows);

    await supabaseAdmin
      .from("agent_messages")
      .update({ approval_status: "executed", action_result: sendResult as never })
      .eq("id", data.messageId);

    const confirmation =
      data.mode === "send"
        ? `Outreach sent${data.to ? ` to ${data.to}` : ""}. I'll keep nudging with a full follow-up cadence until they reply.`
        : `Marked as sent. Remember to send it yourself — I'll keep the follow-up cadence running until they reply.`;

    await supabaseAdmin.from("agent_messages").insert({
      user_id: userId,
      role: "assistant",
      content: confirmation,
    });

    // -------- Increment outbound-pitch quota usage (best-effort) --------
    try {
      if (usageRow) {
        await supabaseAdmin
          .from("usage_tracking")
          .update({ count: used + 1 })
          .eq("id", usageRow.id);
      } else {
        await supabaseAdmin.from("usage_tracking").insert({
          user_id: userId,
          action_type: USAGE_ACTION_OUTREACH_SEND,
          month_year: monthYear,
          count: 1,
        });
      }
    } catch (e) {
      console.error("[sendOutreachFromChat] usage track failed", e);
    }

    return { ok: true as const, sentAt: now };
  });

/* ---------------- Autosave chat draft (subject/body/to) ---------------- */

const SaveDraftSchema = z.object({
  outreachId: z.string().uuid(),
  to: z.string().max(320).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().max(10_000).optional(),
});

export const saveDraftFromChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveDraftSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("outreach_emails")
      .select("id, sent")
      .eq("id", data.outreachId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "Draft not found" };
    if (row.sent) return { ok: false as const, error: "Already sent" };
    const patch: {
      to_email?: string | null;
      subject?: string;
      body?: string;
    } = {};
    if (typeof data.to === "string") patch.to_email = data.to.trim() || null;
    if (typeof data.subject === "string" && data.subject.trim()) patch.subject = data.subject;
    if (typeof data.body === "string" && data.body.trim()) patch.body = data.body;
    if (Object.keys(patch).length === 0)
      return { ok: true as const, savedAt: new Date().toISOString() };
    await supabaseAdmin
      .from("outreach_emails")
      .update(patch)
      .eq("id", data.outreachId)
      .eq("user_id", userId);
    return { ok: true as const, savedAt: new Date().toISOString() };
  });

export const listApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("approvals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { approvals: data ?? [] };
  });

const OutreachIdSchema = z.object({ outreach_id: z.string().uuid() });

export const getOutreachForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OutreachIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: oe } = await supabase
      .from("outreach_emails")
      .select("*")
      .eq("user_id", userId)
      .eq("id", data.outreach_id)
      .maybeSingle();
    if (!oe) return { outreach: null, brand: null, senderEmail: null, contact: null };
    const [{ data: brand }, { data: profile }] = await Promise.all([
      oe.brand_match_id
        ? supabase.from("brand_matches").select("*").eq("id", oe.brand_match_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("sender_email").eq("user_id", userId).maybeSingle(),
    ]);
    let contact: {
      email: string | null;
      name: string | null;
      title: string | null;
      source: string | null;
      confidence: string | null;
    } | null = null;
    if (oe.brand_match_id) {
      const { getBestContactEmail } = await import("./brand-contacts.functions");
      contact = await getBestContactEmail(oe.brand_match_id);
    }
    return {
      outreach: oe,
      brand,
      senderEmail: (profile as { sender_email?: string | null } | null)?.sender_email ?? null,
      contact,
    };
  });

const UpdateOutreachSchema = z.object({
  outreach_id: z.string().uuid(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
  to_email: z.string().email().or(z.literal("")).optional(),
});

export const updateOutreachDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateOutreachSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("outreach_emails")
      .update({
        subject: data.subject,
        body: data.body,
        to_email: data.to_email || null,
      })
      .eq("user_id", userId)
      .eq("id", data.outreach_id);
    if (error) {
      console.error("[outreach] update failed", error);
      throw new Error("Failed to update outreach draft. Please try again.");
    }
    return { ok: true };
  });

/* ---------------- User-control outreach revision ----------------
 * Lets the creator say "make it shorter", "more casual", "more direct",
 * "ask for budget first", "remove my rate", "use a Reddit-style tone",
 * etc. The agent rewrites the existing draft in place.
 */
const ReviseOutreachSchema = z.object({
  outreach_id: z.string().uuid(),
  intent: z.string().min(2).max(500),
});

export const reviseOutreachDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReviseOutreachSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) return { ok: false as const, error: "AI not configured" };

    const { data: oe } = await supabaseAdmin
      .from("outreach_emails")
      .select("id, subject, body, brand_match_id, personalization_used, category_style")
      .eq("user_id", userId)
      .eq("id", data.outreach_id)
      .maybeSingle();
    if (!oe) return { ok: false as const, error: "Draft not found" };

    const { data: brand } = await supabaseAdmin
      .from("brand_matches")
      .select("brand_name, brand_industry, outreach_angle")
      .eq("id", oe.brand_match_id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const {
      AGENT_VOICE_PRINCIPLES,
      REDDIT_AUTHENTICITY_PRINCIPLES,
      OUTREACH_QUALITY_STANDARD,
      personalizedVoiceGuide,
    } = await import("./agent-voice.server");

    const voiceGuide = personalizedVoiceGuide(profile);

    const system = `${AGENT_VOICE_PRINCIPLES}

${REDDIT_AUTHENTICITY_PRINCIPLES}

${voiceGuide}

${OUTREACH_QUALITY_STANDARD}


You are revising an existing outreach draft based on the creator's instruction.
Keep what works. Apply their change. Do NOT replace the whole message unless
they asked you to start over. Preserve real facts; never invent new ones.

Return STRICT JSON only:
{ "subject": string, "body": string, "ai_reason": string }`;

    const prompt = `Brand: ${brand?.brand_name ?? "Brand"} (${brand?.brand_industry ?? "?"})
Creator tone: ${profile?.tone ?? "casual"}
Creator niche: ${profile?.niche ?? "?"}

CURRENT DRAFT
Subject: ${oe.subject}
Body:
${oe.body}

CREATOR INSTRUCTION
${data.intent}

Revise the draft now.`;

    let parsed: { subject: string; body: string; ai_reason: string };
    try {
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const model = gateway("google/gemini-2.5-pro");
      const { text } = await generateText({ model, system, prompt });
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = z
        .object({
          subject: z.string().min(3).max(300),
          body: z.string().min(20),
          ai_reason: z.string(),
        })
        .parse(JSON.parse(cleaned));
    } catch (e) {
      console.error("[outreach-revise] failed", e);
      return { ok: false as const, error: "Revision failed" };
    }

    const { error } = await supabaseAdmin
      .from("outreach_emails")
      .update({
        subject: parsed.subject,
        body: parsed.body,
        ai_reason: parsed.ai_reason,
      })
      .eq("user_id", userId)
      .eq("id", data.outreach_id);
    if (error) {
      console.error("[outreach-revise] update failed", error);
      return { ok: false as const, error: "Failed to save revised draft." };
    }

    return {
      ok: true as const,
      subject: parsed.subject,
      body: parsed.body,
      ai_reason: parsed.ai_reason,
    };
  });

const MarkSentSchema = z.object({
  outreach_id: z.string().uuid(),
  approval_id: z.string().uuid(),
  to_email: z.string().email().or(z.literal("")).optional(),
});

export const markOutreachSentManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MarkSentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error: e1 } = await supabase
      .from("outreach_emails")
      .update({ sent: true, sent_at: now, to_email: data.to_email || null })
      .eq("user_id", userId)
      .eq("id", data.outreach_id);
    if (e1) {
      console.error("[outreach] mark sent failed", e1);
      throw new Error("Failed to mark outreach as sent. Please try again.");
    }

    await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("id", data.approval_id);

    // Schedule follow-up rows (placeholders; content generated on demand).
    // Open-ended cadence — no hard cap. Cron cancels on reply.
    const days = [2, 5, 9, 14, 21, 30, 45, 60, 75, 90];
    const scheduledRows = days.map((d, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return {
        user_id: userId,
        outreach_id: data.outreach_id,
        sequence_number: i + 1,
        scheduled_at: dt.toISOString(),
      };
    });
    await supabase.from("follow_up_sequences").insert(scheduledRows);

    return { ok: true };
  });

/* ---------------- Internal email sending (MatchAI's own sender) ---------------- */

const AttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  dataUrl: z.string().min(1).max(12_000_000), // ~9MB base64 ceiling
  mime: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const SendInternalSchema = z.object({
  outreach_id: z.string().uuid(),
  approval_id: z.string().uuid(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
  to_email: z.string().email(),
  attachments: z.array(AttachmentSchema).max(10).optional(),
});

const SENDER_DOMAIN = "notify.www.matchapp.ai";
const FROM_DOMAIN = "www.matchapp.ai";

function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const sendOutreachInternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendInternalSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const recipient = data.to_email.trim().toLowerCase();

    // Fail-closed suppression check
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("id")
      .eq("email", recipient)
      .maybeSingle();
    if (suppressed) {
      return { ok: false as const, error: "This address has unsubscribed or bounced." };
    }

    // Unsubscribe token (one per recipient)
    let unsubscribeToken: string;
    const { data: existingTok } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", recipient)
      .maybeSingle();
    if (existingTok?.token && !existingTok.used_at) {
      unsubscribeToken = existingTok.token;
    } else {
      unsubscribeToken = generateUnsubscribeToken();
      await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .upsert(
          { token: unsubscribeToken, email: recipient },
          { onConflict: "email", ignoreDuplicates: true },
        );
      const { data: stored } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", recipient)
        .maybeSingle();
      if (stored?.token) unsubscribeToken = stored.token;
    }

    // Render the brand-outreach React Email template (dynamic import keeps
    // React Email out of the client bundle).
    const [{ default: React }, { render }, { template }] = await Promise.all([
      import("react"),
      import("@react-email/components"),
      import("./email-templates/brand-outreach"),
    ]);
    const element = React.createElement(template.component, {
      subject: data.subject,
      body: data.body,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });

    const messageId = crypto.randomUUID();

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "brand-outreach",
      recipient_email: recipient,
      status: "pending",
    });

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `MatchAI <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: data.subject,
        html,
        text,
        purpose: "transactional",
        label: "brand-outreach",
        idempotency_key: `outreach-${data.outreach_id}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
        attachments: (data.attachments ?? []).map((a) => ({
          filename: a.name,
          content: a.dataUrl,
          content_type: a.mime,
        })),
      },
    });

    if (enqueueError) {
      console.error("[sendOutreachInternal] enqueue failed", enqueueError);
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "brand-outreach",
        recipient_email: recipient,
        status: "failed",
        error_message: enqueueError.message,
      });
      return { ok: false as const, error: "Failed to send. Try again in a moment." };
    }

    const now = new Date().toISOString();
    await supabase
      .from("outreach_emails")
      .update({
        sent: true,
        sent_at: now,
        subject: data.subject,
        body: data.body,
        to_email: recipient,
      })
      .eq("user_id", userId)
      .eq("id", data.outreach_id);

    await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("id", data.approval_id);

    // Move brand to "pitched"
    const { data: oeRow } = await supabaseAdmin
      .from("outreach_emails")
      .select("brand_match_id")
      .eq("id", data.outreach_id)
      .maybeSingle();
    if (oeRow?.brand_match_id) {
      await supabaseAdmin
        .from("brand_matches")
        .update({ status: "pitched" })
        .eq("id", oeRow.brand_match_id)
        .eq("user_id", userId);
    }

    // Auto-approved follow-up sequence (we're now sending for them).
    // Open-ended cadence — no hard cap. Cron cancels on reply.
    const days = [2, 5, 9, 14, 21, 30, 45, 60, 75, 90];
    const rows = days.map((d, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return {
        user_id: userId,
        outreach_id: data.outreach_id,
        sequence_number: i + 1,
        scheduled_at: dt.toISOString(),
        approved: true,
      };
    });
    await supabase.from("follow_up_sequences").insert(rows);

    return { ok: true as const, sentAt: now };
  });

const SendViaGmailSchema = z.object({
  outreach_id: z.string().uuid(),
  approval_id: z.string().uuid(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
  to_email: z.string().email(),
});

export const sendOutreachViaGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendViaGmailSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Fetch (or backfill) the tracking_id so Resend opens/clicks land on this row.
    const { data: row } = await supabase
      .from("outreach_emails")
      .select("tracking_id")
      .eq("user_id", userId)
      .eq("id", data.outreach_id)
      .maybeSingle();
    const trackingId = (row?.tracking_id as string | null) ?? undefined;
    const result = await sendOutreach({
      userId,
      to: data.to_email,
      subject: data.subject,
      body: data.body,
      outreachId: data.outreach_id,
      trackingId,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    const now = new Date().toISOString();
    await supabase
      .from("outreach_emails")
      .update({
        sent: true,
        sent_at: now,
        subject: data.subject,
        body: data.body,
        to_email: data.to_email,
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
        send_provider: result.provider,
        provider_message_id: result.messageId,
      })
      .eq("user_id", userId)
      .eq("id", data.outreach_id);
    await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("id", data.approval_id);

    const days = [2, 5, 9, 14, 21, 30, 45, 60, 75, 90];
    const scheduledRows = days.map((d, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return {
        user_id: userId,
        outreach_id: data.outreach_id,
        sequence_number: i + 1,
        scheduled_at: dt.toISOString(),
        approved: true, // user sent via Gmail in-app → opted into the sequence
      };
    });
    await supabase.from("follow_up_sequences").insert(scheduledRows);

    return { ok: true as const };
  });

const RejectSchema = z.object({ approval_id: z.string().uuid() });
export const rejectApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RejectSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("approvals")
      .update({ status: "rejected" })
      .eq("user_id", userId)
      .eq("id", data.approval_id);
    return { ok: true };
  });

/* ---------------- Deals ---------------- */

export const listDealsAndPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: deals }, { data: matches }] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("brand_matches")
        .select(
          "id,brand_name,status,estimated_deal_min,estimated_deal_max,fit_quality_score,fit_score",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    return { deals: deals ?? [], matches: matches ?? [] };
  });

const STAGES = [
  "matched",
  "outreach_sent",
  "interested",
  "negotiating",
  "contract_sent",
  "terms_agreed",
  "deliverables_due",
  "payment_pending",
  "paid",
] as const;

const MoveCardSchema = z.object({
  kind: z.enum(["match", "deal"]),
  id: z.string().uuid(),
  to_stage: z.enum(STAGES),
});

function matchStatusToStage(s: string): (typeof STAGES)[number] {
  if (s === "new") return "matched";
  if (s === "pitched") return "outreach_sent";
  if (s === "replied") return "interested";
  if (s === "negotiating") return "negotiating";
  return "matched";
}

function dealStage(d: {
  status: string;
  contract_status: string;
  invoice_status: string;
}): (typeof STAGES)[number] {
  if (d.invoice_status === "paid") return "paid";
  if (d.invoice_status === "invoiced") return "payment_pending";
  if (d.status === "in_progress") return "deliverables_due";
  if (d.contract_status === "accepted") return "terms_agreed";
  if (d.contract_status === "sent") return "contract_sent";
  return "negotiating";
}

export const moveDealCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MoveCardSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.kind === "match") {
      const { data: m } = await supabase
        .from("brand_matches")
        .select("status")
        .eq("user_id", userId)
        .eq("id", data.id)
        .maybeSingle();
      if (!m) throw new Error("Match not found");

      const fromIdx = STAGES.indexOf(matchStatusToStage(m.status));
      const toIdx = STAGES.indexOf(data.to_stage);
      if (toIdx > fromIdx + 1) {
        throw new Error("Complete the previous steps first.");
      }

      const newStatus =
        data.to_stage === "matched"
          ? "new"
          : data.to_stage === "outreach_sent"
            ? "pitched"
            : data.to_stage === "interested"
              ? "replied"
              : "negotiating";
      const { error } = await supabase
        .from("brand_matches")
        .update({ status: newStatus })
        .eq("user_id", userId)
        .eq("id", data.id);
      if (error) {
        console.error("[brand-match] status update failed", error);
        throw new Error("Failed to update status. Please try again.");
      }
      return { ok: true };
    }

    // deal
    const { data: d } = await supabase
      .from("deals")
      .select("status,contract_status,invoice_status")
      .eq("user_id", userId)
      .eq("id", data.id)
      .maybeSingle();
    if (!d) throw new Error("Deal not found");
    const fromIdx = STAGES.indexOf(dealStage(d));
    const toIdx = STAGES.indexOf(data.to_stage);
    if (toIdx > fromIdx + 1) {
      throw new Error("Complete the previous steps first.");
    }

    const patch: {
      contract_status?: string;
      invoice_status?: string;
      status?: string;
    } = {};
    switch (data.to_stage) {
      case "contract_sent":
        patch.contract_status = "sent";
        break;
      case "terms_agreed":
        patch.contract_status = "accepted";
        break;
      case "deliverables_due":
        patch.contract_status = "accepted";
        patch.status = "in_progress";
        break;
      case "payment_pending":
        patch.invoice_status = "invoiced";
        break;
      case "paid":
        patch.invoice_status = "paid";
        patch.status = "completed";
        break;
      default:
        break;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("deals")
        .update(patch)
        .eq("user_id", userId)
        .eq("id", data.id);
      if (error) {
        console.error("[deals] stage transition failed", error);
        throw new Error("Failed to update deal stage. Please try again.");
      }
    }
    return { ok: true };
  });

/* ---------------- Escrow ---------------- */

const CreateEscrowSchema = z.object({
  deal_id: z.string().uuid(),
  gross_amount: z.number().min(1).max(1_000_000),
});

export const createEscrowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateEscrowSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase
      .from("deals")
      .select("brand_name")
      .eq("user_id", userId)
      .eq("id", data.deal_id)
      .maybeSingle();
    // Fee logic: use monetization v2 (pricing-config). Rate is locked on the
    // deal at acceptance; Stripe processing is separate and not MatchAI revenue.
    const { computeFeeBreakdown, monetizationChoiceForPlan } = await import("@/lib/pricing-config");
    const { data: prof } = await supabase
      .from("profiles")
      .select("plan, monetization_choice")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: dealRow } = await supabase
      .from("deals")
      .select("deal_source, success_fee_rate_locked")
      .eq("id", data.deal_id)
      .maybeSingle();
    // Fair Deal Guarantee: repeat deals with the same brand are 0% forever.
    let isRepeatBrand = false;
    if (deal?.brand_name) {
      const { count } = await supabase
        .from("escrow_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("brand_name", deal.brand_name)
        .in("commission_status", ["charged", "pending"]);
      isRepeatBrand = (count ?? 0) > 0;
    }
    const choice = (prof?.monetization_choice as any) || monetizationChoiceForPlan(prof?.plan);
    const breakdown = computeFeeBreakdown({
      gross: data.gross_amount,
      choice,
      dealSource: (dealRow?.deal_source as any) ?? "matchai_sourced",
      lockedRate: dealRow?.success_fee_rate_locked ?? null,
      isRepeatBrand,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("escrow_transactions")
      .insert({
        user_id: userId,
        deal_id: data.deal_id,
        brand_name: deal?.brand_name ?? null,
        gross_amount: data.gross_amount,
        platform_fee: breakdown.successFeeAmount, // legacy column kept in sync
        net_payout: breakdown.creatorNet,
        gross_cash_compensation: breakdown.gross,
        success_fee_amount: breakdown.successFeeAmount,
        creator_net_v2: breakdown.creatorNet,
        payment_processing_fee: breakdown.paymentProcessingFee,
        commission_status: breakdown.commissionStatus,
        status: "awaiting",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[escrow] insert failed", error);
      throw new Error("Failed to create escrow. Please try again.");
    }
    await supabase
      .from("deals")
      .update({ escrow_status: "awaiting", deal_value: data.gross_amount })
      .eq("user_id", userId)
      .eq("id", data.deal_id);
    return { escrow: row };
  });

const EscrowIdSchema = z.object({ escrow_id: z.string().uuid() });

export const markEscrowFunded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EscrowIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { data: row } = await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "funded", funded_at: now })
      .eq("user_id", userId)
      .eq("id", data.escrow_id)
      .select("deal_id")
      .single();
    if (row?.deal_id) {
      await supabase
        .from("deals")
        .update({ escrow_status: "funded" })
        .eq("user_id", userId)
        .eq("id", row.deal_id);
    }
    return { ok: true };
  });

// Legacy name — delegates to the canonical `releaseProtectedPayment` in
// escrow.functions.ts. Do NOT add release logic here; edit the canonical
// function instead. Kept as a thin re-export so existing UI (dashboard.deals)
// keeps compiling.
export { releaseProtectedPayment as releaseEscrow } from "@/lib/escrow.functions";

/* ---------------- Payments + ROI ---------------- */

// Pricing constants now live in src/lib/plans.ts (single source of truth).

export const getPaymentsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: deals }, { data: escrows }, { data: profile }] = await Promise.all([
      supabase.from("deals").select("*").eq("user_id", userId),
      supabase
        .from("escrow_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("plan").eq("user_id", userId).maybeSingle(),
    ]);

    const d = deals ?? [];
    const paid = d.filter((x) => x.invoice_status === "paid");
    const grossRevenue = paid.reduce((s, x) => s + Number(x.deal_value ?? 0), 0);
    const escrowFunded = (escrows ?? [])
      .filter((e) => e.status === "funded")
      .reduce((s, e) => s + Number(e.gross_amount ?? 0), 0);
    const inEscrow = escrowFunded;
    const upcoming = (escrows ?? []).filter(
      (e) => e.status === "released" && e.expected_payout_date,
    );
    const platformFees = (escrows ?? []).reduce((s, e) => s + Number(e.platform_fee ?? 0), 0);
    const netPayout = grossRevenue - platformFees;
    const planPrice = resolvePlan(profile?.plan).monthlyUsd;
    const dealsClosed = paid.length;
    const totalCost = platformFees + planPrice;
    const roi = totalCost > 0 ? netPayout / totalCost : 0;

    return {
      grossRevenue,
      netPayout,
      platformFees,
      inEscrow,
      planPrice,
      dealsClosed,
      roi,
      escrows: escrows ?? [],
      upcoming,
      plan: profile?.plan ?? "free",
    };
  });

/* ---------------- Agent activity ---------------- */

export const listAgentActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("agent_activity")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return { activity: data ?? [] };
  });

/* ---------------- Save / reject a brand match ---------------- */

const SetStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["saved", "rejected", "new"]),
});

export const setBrandMatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetStatusSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("brand_matches")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };

    // Feedback loop signal for future ranking.
    try {
      await supabaseAdmin.from("learning_insights").insert({
        user_id: userId,
        insight_title:
          data.status === "saved"
            ? "User saved a brand"
            : data.status === "rejected"
              ? "User rejected a brand"
              : "User reset a brand",
        recommendation: `brand_match_id=${data.id}`,
        applied: false,
      });
    } catch {
      // best-effort; ignore
    }
    return { ok: true as const };
  });
