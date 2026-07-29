import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBestContactEmail } from "@/lib/brand-contacts.functions";

type Direction = "creator_to_brand" | "brand_to_creator";

type QueryResult = {
  data: unknown;
  error: unknown;
};

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  insert: (...args: unknown[]) => QueryBuilder;
  update: (...args: unknown[]) => QueryBuilder;
  upsert: (...args: unknown[]) => QueryBuilder;
  delete: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  contains: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  maybeSingle: (...args: unknown[]) => Promise<QueryResult>;
  single: (...args: unknown[]) => Promise<QueryResult>;
};

const db = supabaseAdmin as unknown as {
  from: (table: string) => QueryBuilder;
};

const ScoreSchema = z.object({
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

const DirectionSchema = z.enum(["creator_to_brand", "brand_to_creator"]);

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function tokenize(value: string | null | undefined): string[] {
  return uniq(
    normalizeText(value)
      .split(/[\s,;/|]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function splitTags(...values: Array<string | string[] | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) out.push(...tokenize(item));
    } else {
      out.push(...tokenize(value));
    }
  }
  return uniq(out).slice(0, 40);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function weightedMatchScore(source: string[], target: string[]): number {
  if (!source.length || !target.length) return 0;
  const targetSet = new Set(target);
  let hits = 0;
  for (const item of source) {
    if (targetSet.has(item)) hits += 1;
  }
  return Math.round((hits / Math.max(1, Math.min(source.length, target.length))) * 100);
}

function intersect(source: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return uniq(source.filter((item) => targetSet.has(item)));
}

function labelFor(score: number): string {
  if (score >= 90) return "Strong Match";
  if (score >= 80) return "Good Match";
  if (score >= 70) return "Worth Testing";
  if (score >= 60) return "Low Priority";
  return "Do Not Recommend";
}

async function writeDiscoverySource(input: {
  user_id: string;
  source_type: "manual" | "csv" | "onboarding" | "analysis" | "match" | "review" | "system";
  source_name: string;
  source_ref?: string | null;
  confidence?: number;
  evidence?: Record<string, unknown>;
}) {
  const { data } = await db
    .from("discovery_sources")
    .insert({
      user_id: input.user_id,
      source_type: input.source_type,
      source_name: input.source_name,
      source_ref: input.source_ref ?? null,
      confidence: input.confidence ?? 50,
      evidence: input.evidence ?? {},
      status: "active",
    })
    .select("*")
    .single();
  return data as { id: string } | null;
}

async function createDiscoveryJob(input: {
  user_id: string;
  job_type:
    | "creator_analysis"
    | "brand_analysis"
    | "match_scoring"
    | "shortlist_refresh"
    | "review_publish";
  direction?: Direction | null;
  source_id?: string | null;
  entity_id?: string | null;
  status?: "queued" | "running" | "succeeded" | "failed";
  progress?: number;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_message?: string | null;
}) {
  const { data } = await db
    .from("discovery_jobs")
    .insert({
      user_id: input.user_id,
      job_type: input.job_type,
      direction: input.direction ?? null,
      source_id: input.source_id ?? null,
      entity_id: input.entity_id ?? null,
      status: input.status ?? "queued",
      progress: input.progress ?? 0,
      input: input.input ?? {},
      result: input.result ?? {},
      error_message: input.error_message ?? null,
      started_at: input.status === "running" ? new Date().toISOString() : null,
      finished_at:
        input.status === "succeeded" || input.status === "failed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  return data as { id: string } | null;
}

function summarizeTags(prefix: string, tags: string[]): string {
  if (!tags.length) return `${prefix}: none`;
  return `${prefix}: ${tags.slice(0, 6).join(", ")}`;
}

async function ensureCreatorContentProfile(userId: string) {
  const [
    { data: creator },
    { data: platforms },
    { data: prefs },
    { data: pricing },
    { data: analysis },
  ] = await Promise.all([
    db.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("platform_stats")
      .select(
        "platform,handle,follower_count,engagement_rate,top_content_categories,posting_cadence",
      )
      .eq("user_id", userId),
    db
      .from("brand_preferences")
      .select(
        "preferred_categories,blocked_categories,worked_with_before,dream_brands,brand_size_preference,values_to_avoid,location_restrictions,additional_notes,configured",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("pricing_rules")
      .select("rate_floor,target_rate,walk_away_rate")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("ai_analysis")
      .select(
        "analysis_summary,pricing_insight,best_brand_categories,recommended_floor,recommended_packages,first_brand_opportunities",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!creator) throw new Error("Creator profile not found");

  const followerEntries = (platforms ?? []).map((row) => ({
    platform: row.platform as string,
    handle: row.handle as string | null,
    followers: Number(row.follower_count ?? 0),
    engagement_rate: Number(row.engagement_rate ?? 0),
  }));
  const followersTotal = followerEntries.reduce((sum, row) => sum + row.followers, 0);
  const engagementRates = followerEntries
    .map((row) => row.engagement_rate)
    .filter((n) => Number.isFinite(n));
  const engagementRate =
    engagementRates.length > 0
      ? Number((engagementRates.reduce((sum, n) => sum + n, 0) / engagementRates.length).toFixed(2))
      : null;

  const niches = splitTags(
    creator.niche,
    creator.primary_platform,
    creator.content_style,
    analysis?.best_brand_categories ?? [],
    prefs?.preferred_categories,
    prefs?.worked_with_before,
    prefs?.dream_brands,
  );
  const contentTags = splitTags(
    creator.content_style,
    creator.bio,
    creator.deal_type_preference ?? [],
    creator.creator_notes,
    analysis?.pricing_insight,
    (platforms ?? []).flatMap((row) => row.top_content_categories ?? []),
  );
  const audienceTags = splitTags(
    creator.target_audience,
    creator.location,
    creator.market_scope,
    creator.audience_age_band,
    creator.market_scope === "local" ? "local audience" : null,
    prefs?.location_restrictions,
  );
  const toneTags = splitTags(creator.tone, creator.content_style, creator.bio);
  const platformTags = splitTags(
    creator.platforms ?? [],
    creator.primary_platform,
    (platforms ?? []).map((row) => row.platform),
  );

  const preferences = {
    preferred_categories: prefs?.preferred_categories ?? null,
    blocked_categories: prefs?.blocked_categories ?? null,
    worked_with_before: prefs?.worked_with_before ?? null,
    dream_brands: prefs?.dream_brands ?? null,
    brand_size_preference: prefs?.brand_size_preference ?? null,
    values_to_avoid: prefs?.values_to_avoid ?? null,
    location_restrictions: prefs?.location_restrictions ?? null,
    additional_notes: prefs?.additional_notes ?? null,
    configured: prefs?.configured ?? false,
  };

  const evidence = {
    creator,
    platforms,
    pricing_rules: pricing,
    ai_analysis: analysis,
  };

  const source = await writeDiscoverySource({
    user_id: userId,
    source_type: "analysis",
    source_name: "creator profile analysis",
    source_ref: creator.id,
    confidence: clamp(60 + Math.min(30, followersTotal > 0 ? 10 : 0) + (engagementRate ? 10 : 0)),
    evidence,
  });

  const payload = {
    user_id: userId,
    creator_profile_id: creator.id,
    niches,
    content_tags: contentTags,
    audience_tags: audienceTags,
    tone_tags: toneTags,
    platform_tags: platformTags,
    followers_total: followersTotal,
    followers_by_platform: followerEntries.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.platform] = row;
      return acc;
    }, {}),
    engagement_rate: engagementRate,
    rate_floor: pricing?.rate_floor ?? creator.min_deal_value ?? null,
    rate_target: pricing?.target_rate ?? null,
    rate_walk_away: pricing?.walk_away_rate ?? null,
    preferences,
    source_evidence: evidence,
    analysis_summary:
      analysis?.analysis_summary ??
      [
        summarizeTags("Niches", niches),
        summarizeTags("Content", contentTags),
        summarizeTags("Audience", audienceTags),
        summarizeTags("Tone", toneTags),
        summarizeTags("Platforms", platformTags),
      ].join(" · "),
    discovery_source_id: source?.id ?? null,
  };

  const { data } = await db
    .from("creator_content_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  return data as Record<string, unknown>;
}

async function ensureBrandContentProfile(userId: string, brandMatchId: string) {
  const [{ data: brand }, { data: contacts }] = await Promise.all([
    db.from("brand_matches").select("*").eq("id", brandMatchId).eq("user_id", userId).maybeSingle(),
    db
      .from("brand_contacts")
      .select(
        "contact_name,contact_title,email,domain,source,confidence,notes,verification_status,confidence_score",
      )
      .eq("brand_match_id", brandMatchId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (!brand) throw new Error("Brand not found");

  const category = brand.brand_industry ?? null;
  const productTags = splitTags(
    brand.brand_name,
    brand.brand_industry,
    brand.suggested_package,
    brand.outreach_angle,
    brand.partnership_angle,
    brand.my_take,
    brand.top_reasons ?? [],
    brand.suggested_deliverables ?? [],
    brand.why_brand_cares,
  );
  const audienceTags = splitTags(
    brand.brand_industry,
    brand.market_type === "local" ? "local customers" : "global customers",
    brand.why_creator_fits,
    brand.contact_path,
  );
  const toneTags = splitTags(
    brand.outreach_angle,
    brand.partnership_angle,
    brand.my_take,
    brand.what_to_avoid,
  );
  const campaignTags = splitTags(
    brand.suggested_package,
    brand.recommended_next_move,
    brand.match_label,
    brand.status,
  );
  const platformTags = splitTags(brand.best_outreach_channel, brand.contact_path);
  const publicContacts = (contacts ?? []).map((contact) => ({
    name: contact.contact_name ?? null,
    title: contact.contact_title ?? null,
    email: contact.email ?? null,
    domain: contact.domain ?? null,
    source: contact.source ?? null,
    confidence: contact.confidence ?? null,
    verification_status: contact.verification_status ?? null,
    confidence_score: contact.confidence_score ?? null,
    notes: contact.notes ?? null,
  }));

  const evidence = {
    brand,
    contacts,
  };

  const source = await writeDiscoverySource({
    user_id: userId,
    source_type: brand.data_source === "csv_import" ? "csv" : "manual",
    source_name: "brand profile analysis",
    source_ref: brand.id,
    confidence: clamp(55 + (publicContacts.length > 0 ? 15 : 0)),
    evidence,
  });

  const payload = {
    user_id: userId,
    brand_match_id: brand.id,
    category,
    product_tags: productTags,
    audience_tags: audienceTags,
    tone_tags: toneTags,
    campaign_tags: campaignTags,
    platform_tags: platformTags,
    public_contacts: publicContacts,
    source_evidence: evidence,
    analysis_summary:
      brand.fit_reasoning ??
      [
        summarizeTags("Products", productTags),
        summarizeTags("Audience", audienceTags),
        summarizeTags("Tone", toneTags),
        summarizeTags("Campaign", campaignTags),
        summarizeTags("Platform", platformTags),
      ].join(" · "),
    discovery_source_id: source?.id ?? null,
  };

  const { data } = await db
    .from("brand_content_profiles")
    .upsert(payload, { onConflict: "brand_match_id" })
    .select("*")
    .single();
  return data as Record<string, unknown>;
}

function scorePair(input: {
  direction: Direction;
  creator: Record<string, unknown>;
  brand: Record<string, unknown>;
  creatorTags: {
    niches: string[];
    contentTags: string[];
    audienceTags: string[];
    toneTags: string[];
    platformTags: string[];
    followersTotal: number;
    rateFloor: number;
  };
  brandTags: {
    category: string | null;
    productTags: string[];
    audienceTags: string[];
    toneTags: string[];
    campaignTags: string[];
    platformTags: string[];
    publicContacts: Array<Record<string, unknown>>;
  };
}) {
  const brandTags = input.brandTags;
  const creatorTags = input.creatorTags;

  const nicheOverlap = weightedMatchScore(creatorTags.niches, brandTags.productTags);
  const contentOverlap = weightedMatchScore(creatorTags.contentTags, brandTags.campaignTags);
  const audienceOverlap = weightedMatchScore(creatorTags.audienceTags, brandTags.audienceTags);
  const toneOverlap = weightedMatchScore(creatorTags.toneTags, brandTags.toneTags);
  const platformOverlap = weightedMatchScore(creatorTags.platformTags, brandTags.platformTags);

  const rateFloor =
    creatorTags.rateFloor || Number(input.creator.rate_floor ?? input.creator.min_deal_value ?? 0);
  const budgetMin = Number(input.brand.estimated_deal_min ?? 0);
  const budgetMax = Number(input.brand.estimated_deal_max ?? 0);
  let dealValue = 35;
  if (rateFloor > 0 && budgetMax > 0) {
    if (budgetMax >= rateFloor) dealValue = 100;
    else if (budgetMax >= rateFloor * 0.8) dealValue = 75;
    else if (budgetMax >= rateFloor * 0.6) dealValue = 45;
    else dealValue = 10;
  } else if (budgetMax > 0 || budgetMin > 0) {
    dealValue = 55;
  }

  const credibility = clamp(
    35 +
      Math.min(20, creatorTags.followersTotal > 0 ? 8 : 0) +
      Math.min(20, brandTags.publicContacts.length > 0 ? 12 : 0) +
      Math.min(20, String(input.brand.data_source ?? "").includes("csv") ? 8 : 4),
  );

  const timing = clamp(
    45 +
      Math.min(20, String(input.brand.status ?? "") === "new" ? 8 : 4) +
      Math.min(15, String(input.brand.market_type ?? "") === "local" ? 8 : 5) +
      Math.min(20, brandTags.publicContacts.length > 0 ? 10 : 0),
  );

  const relationshipPath = clamp(
    20 +
      Math.min(30, brandTags.publicContacts.length > 0 ? 20 : 0) +
      Math.min(30, brandTags.platformTags.length > 0 ? 10 : 0) +
      Math.min(20, contentOverlap > 60 ? 10 : 0),
  );

  const whiteSpace = clamp(
    40 + (brandTags.publicContacts.length === 0 ? 20 : 0) + (contentOverlap < 50 ? 15 : 0),
  );
  const creatorLeverage = clamp(
    audienceOverlap * 0.35 +
      toneOverlap * 0.15 +
      platformOverlap * 0.15 +
      nicheOverlap * 0.2 +
      dealValue * 0.15,
  );
  const sponsorshipLikelihood = clamp(
    25 +
      (budgetMax > 0 ? 25 : 0) +
      (creatorTags.followersTotal > 0 ? 15 : 0) +
      (audienceOverlap > 50 ? 15 : 0),
  );
  const conversionPotential = clamp(
    audienceOverlap * 0.4 + nicheOverlap * 0.25 + toneOverlap * 0.15 + platformOverlap * 0.2,
  );
  const audienceFit = clamp(
    audienceOverlap * 0.5 + contentOverlap * 0.25 + toneOverlap * 0.15 + platformOverlap * 0.1,
  );
  const categoryFit = clamp(nicheOverlap * 0.55 + contentOverlap * 0.25 + toneOverlap * 0.2);
  const brandCredibilityFit = clamp(
    toneOverlap * 0.35 + audienceOverlap * 0.25 + credibility * 0.4,
  );
  const fitScore = clamp(
    Math.round(
      audienceFit * 0.18 +
        categoryFit * 0.16 +
        sponsorshipLikelihood * 0.14 +
        conversionPotential * 0.14 +
        dealValue * 0.12 +
        brandCredibilityFit * 0.08 +
        timing * 0.06 +
        relationshipPath * 0.06 +
        whiteSpace * 0.04 +
        creatorLeverage * 0.02,
    ),
  );

  const scoreBreakdown = ScoreSchema.parse({
    audience_fit: Math.round(audienceFit),
    category_fit: Math.round(categoryFit),
    sponsorship_likelihood: Math.round(sponsorshipLikelihood),
    conversion_potential: Math.round(conversionPotential),
    deal_value_potential: Math.round(dealValue),
    brand_credibility_fit: Math.round(brandCredibilityFit),
    outreach_timing: Math.round(timing),
    relationship_path: Math.round(relationshipPath),
    competitive_white_space: Math.round(whiteSpace),
    creator_leverage: Math.round(creatorLeverage),
  });

  const overlapReasons = uniq([
    ...intersect(creatorTags.niches, brandTags.productTags)
      .slice(0, 2)
      .map((tag) => `Shared tag: ${tag}`),
    ...intersect(creatorTags.audienceTags, brandTags.audienceTags)
      .slice(0, 2)
      .map((tag) => `Audience overlap: ${tag}`),
    ...intersect(creatorTags.toneTags, brandTags.toneTags)
      .slice(0, 1)
      .map((tag) => `Tone match: ${tag}`),
    ...intersect(creatorTags.platformTags, brandTags.platformTags)
      .slice(0, 1)
      .map((tag) => `Platform fit: ${tag}`),
  ]).filter(Boolean);

  const risks = uniq(
    [
      brandTags.publicContacts.length === 0 ? "No public contact data found yet." : null,
      rateFloor > 0 && budgetMax > 0 && budgetMax < rateFloor
        ? "Brand budget looks below the creator's rate floor."
        : null,
      audienceOverlap < 35 ? "Audience overlap is inferred and still thin." : null,
      nicheOverlap < 25 ? "Category overlap is weak." : null,
    ].filter((item): item is string => Boolean(item)),
  );

  const pitchAngle =
    input.direction === "creator_to_brand"
      ? `Lead with a ${intersect(creatorTags.contentTags, brandTags.campaignTags)[0] ?? creatorTags.niches[0] ?? "content"} angle and keep the ask specific.`
      : `Position the creator as a fit for ${brandTags.category ?? "this campaign"} with a concrete deliverable package.`;
  const nextAction =
    input.direction === "creator_to_brand"
      ? "Approve the match, then open the inbox draft."
      : "Review the creator fit and either shortlist or keep scanning.";

  const confidence = clamp(
    Math.round(
      fitScore * 0.35 +
        (brandTags.publicContacts.length > 0 ? 20 : 0) +
        (creatorTags.followersTotal > 0 ? 10 : 0) +
        (overlapReasons.length > 0 ? 15 : 0) +
        (risks.length === 0 ? 10 : 0),
    ),
  );

  return {
    fitScore,
    confidence,
    label: labelFor(fitScore),
    reasons:
      overlapReasons.length > 0
        ? overlapReasons.slice(0, 4)
        : ["Signals are sparse, but the profile still clears the floor."],
    risks,
    pitchAngle,
    nextAction,
    scoreBreakdown,
  };
}

async function upsertCampaignBrief(input: {
  userId: string;
  direction: Direction;
  creatorProfileId: string | null;
  creatorContentProfileId: string | null;
  brandMatchId: string;
  brandContentProfileId: string | null;
  matchScoreId: string;
  creator: Record<string, unknown>;
  brand: Record<string, unknown>;
  score: ReturnType<typeof scorePair>;
}) {
  const title =
    input.direction === "creator_to_brand"
      ? `${String(input.brand.brand_name ?? "Brand")} partnership brief`
      : `${String(input.creator.full_name ?? input.creator.niche ?? "Creator")} fit brief`;
  const summary =
    input.direction === "creator_to_brand"
      ? `Pitch ${String(input.brand.brand_name ?? "brand")} with ${input.score.label.toLowerCase()} confidence and a ${input.score.pitchAngle.toLowerCase()}`
      : `Use the brand to evaluate the creator fit and keep the next action simple.`;
  const deliverables = uniq(
    splitTags(
      input.brand.suggested_deliverables ?? [],
      input.brand.suggested_package,
      input.creator.content_style,
    ).slice(0, 4),
  );

  const { data } = await db
    .from("campaign_briefs")
    .upsert(
      {
        user_id: input.userId,
        direction: input.direction,
        title,
        summary,
        objective:
          input.direction === "creator_to_brand"
            ? `Open an internal outreach draft to ${String(input.brand.brand_name ?? "the brand")}.`
            : `Assess whether this brand should be shortlisted for the creator.`,
        audience: String(input.creator.target_audience ?? input.brand.audience_tags ?? ""),
        deliverables,
        budget_min: Number(input.brand.estimated_deal_min ?? 0) || null,
        budget_max: Number(input.brand.estimated_deal_max ?? 0) || null,
        pitch_angle: input.score.pitchAngle,
        contact_hint:
          input.direction === "creator_to_brand" ? null : String(input.brand.contact_path ?? ""),
        source_evidence: {
          creator: input.creator,
          brand: input.brand,
          score: input.score.scoreBreakdown,
        },
        creator_content_profile_id: input.creatorContentProfileId,
        brand_content_profile_id: input.brandContentProfileId,
        match_score_id: input.matchScoreId,
      },
      { onConflict: "match_score_id" },
    )
    .select("*")
    .single();
  return data as { id: string } | null;
}

async function enqueueReview(input: {
  userId: string;
  direction: Direction;
  matchScoreId: string;
  campaignBriefId: string | null;
  title: string;
  reason: string;
  nextAction: string;
  fitScore: number;
  payload: Record<string, unknown>;
}) {
  const { data } = await db
    .from("review_queue")
    .upsert(
      {
        user_id: input.userId,
        direction: input.direction,
        queue_type: "match",
        match_score_id: input.matchScoreId,
        campaign_brief_id: input.campaignBriefId,
        title: input.title,
        status: "pending",
        priority: input.fitScore,
        reason: input.reason,
        next_action: input.nextAction,
        payload: input.payload,
      },
      { onConflict: "match_score_id" },
    )
    .select("*")
    .single();
  return data as { id: string } | null;
}

async function createInboxDraftFromMatch(input: {
  userId: string;
  queueId: string;
  matchScoreId: string;
}) {
  const { data: matchScore } = await db
    .from("match_scores")
    .select("*")
    .eq("id", input.matchScoreId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!matchScore) throw new Error("Match score not found");

  const brandId = matchScore.brand_match_id as string;
  const [{ data: brand }, { data: profile }] = await Promise.all([
    db
      .from("brand_matches")
      .select("*")
      .eq("id", brandId)
      .eq("user_id", input.userId)
      .maybeSingle(),
    db
      .from("profiles")
      .select("email,sender_email,full_name")
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  if (!brand) throw new Error("Brand not found");

  const contact = await getBestContactEmail(brand.id);
  const fromAddress =
    ((profile as Record<string, unknown> | null)?.sender_email as string | null) ||
    ((profile as Record<string, unknown> | null)?.email as string | null) ||
    "outreach@matchapp.ai";
  const recipient = contact.email ?? null;
  const subject = `${brand.brand_name} collaboration idea`;
  const body = [
    `Approved from the discovery queue.`,
    `Match score: ${matchScore.fit_score}/100 (${matchScore.label ?? labelFor(matchScore.fit_score)})`,
    `Next step: ${matchScore.next_action ?? "Review the brief and personalize the pitch."}`,
    recipient ? `Recipient: ${recipient}` : `No public contact was available yet.`,
  ].join("\n");

  const draftInsert = await db
    .from("email_drafts")
    .insert({
      user_id: input.userId,
      thread_id: null,
      provider_draft_id: `discovery:${input.queueId}`,
      from_address: fromAddress,
      to_addresses: recipient ? [recipient] : [],
      cc_addresses: [],
      bcc_addresses: [],
      reply_to_addresses: [],
      subject,
      text_body: body,
      html_body: null,
      in_reply_to: null,
      references_header: null,
      status: "draft",
      sync_status: "pending",
      sync_error: null,
    })
    .select("*")
    .single();
  if (draftInsert.error || !draftInsert.data) throw new Error("Could not create inbox draft");

  const threadInsert = await db
    .from("email_threads")
    .insert({
      user_id: input.userId,
      provider_thread_id: `discovery:${input.queueId}`,
      subject,
      snippet: body.slice(0, 240),
      folder: "drafts",
      is_unread: false,
      message_count: 0,
      last_message_at: new Date().toISOString(),
      brand_match_id: brand.id,
      contact_id: null,
      deal_id: null,
      last_synced_at: new Date().toISOString(),
      sync_status: "pending",
      sync_error: null,
    })
    .select("id")
    .single();
  if (threadInsert.error || !threadInsert.data) throw new Error("Could not create inbox thread");

  const updateDraft = await db
    .from("email_drafts")
    .update({ thread_id: threadInsert.data.id })
    .eq("id", draftInsert.data.id)
    .eq("user_id", input.userId);
  if (updateDraft.error) throw new Error("Could not link draft to thread");

  await db
    .from("review_queue")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "matchai" })
    .eq("id", input.queueId)
    .eq("user_id", input.userId);

  return {
    draft_id: draftInsert.data.id as string,
    thread_id: threadInsert.data.id as string,
    brand_name: brand.brand_name as string,
  };
}

async function createInboxDraftFromTarget(input: {
  userId: string;
  queueId: string;
  targetId: string;
}) {
  const { data: target } = await db
    .from("outreach_targets")
    .select("*")
    .eq("id", input.targetId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!target) throw new Error("Outreach target not found");

  const opportunityId = (target.source_record_id as string | null) ?? null;
  const { data: opportunity } = opportunityId
    ? await db
        .from("brand_opportunities")
        .select("*")
        .eq("id", opportunityId)
        .eq("user_id", input.userId)
        .maybeSingle()
    : { data: null };

  const result = await makeInternalDraftForTarget({
    userId: input.userId,
    target: target as Record<string, unknown>,
    opportunity: (opportunity as Record<string, unknown> | null) ?? null,
  });

  await db
    .from("outreach_targets")
    .update({
      status: "approved",
      inbox_draft_id: result.draft_id,
    })
    .eq("id", target.id)
    .eq("user_id", input.userId);

  await db
    .from("review_queue")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "matchai" })
    .eq("id", input.queueId)
    .eq("user_id", input.userId);

  await db.from("discovery_jobs").insert({
    user_id: input.userId,
    job_type: "review_publish",
    direction: (target.outreach_direction as Direction | null) ?? null,
    status: "succeeded",
    progress: 100,
    input: { queue_id: input.queueId, outreach_target_id: target.id },
    result,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  return {
    draft_id: result.draft_id,
    thread_id: result.thread_id,
    brand_name: (target.display_name as string | null) ?? "Outreach target",
  };
}

async function makeInternalDraftForTarget(input: {
  userId: string;
  target: Record<string, unknown>;
  opportunity: Record<string, unknown> | null;
}) {
  const target = input.target;
  const opportunity = input.opportunity;
  const [{ data: profile }] = await Promise.all([
    db
      .from("profiles")
      .select("email,sender_email,full_name")
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  const sender =
    ((profile as Record<string, unknown> | null)?.sender_email as string | null) ??
    ((profile as Record<string, unknown> | null)?.email as string | null) ??
    "outreach@matchapp.ai";
  const subject =
    (opportunity?.opportunity_title as string | null) ??
    (target.display_name as string | null) ??
    "Internal outreach";
  const toEmail =
    (target.email as string | null) ??
    (Array.isArray(target.cc_addresses) ? (target.cc_addresses as string[])[0] : null) ??
    null;
  const body = [
    `Hi ${target.display_name ?? "there"},`,
    "",
    `This draft is queued from the internal outreach system.`,
    opportunity?.why_now ? `Why now: ${opportunity.why_now}` : null,
    opportunity?.signal_summary ? `Evidence: ${opportunity.signal_summary}` : null,
    opportunity?.pitch_angle ? `Pitch angle: ${opportunity.pitch_angle}` : null,
    "",
    `This will not send until approved in Inbox.`,
    "",
    `Thanks,`,
    (profile as Record<string, unknown> | null)?.full_name
      ? String((profile as Record<string, unknown>).full_name)
      : "MatchAI",
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");

  const draftInsert = await db
    .from("email_drafts")
    .insert({
      user_id: input.userId,
      thread_id: null,
      provider_draft_id: `discovery-target:${target.id}`,
      from_address: sender,
      to_addresses: toEmail ? [toEmail] : [],
      cc_addresses: (target.cc_addresses as string[] | null) ?? [],
      bcc_addresses: (target.bcc_addresses as string[] | null) ?? [],
      reply_to_addresses: (target.reply_to_addresses as string[] | null) ?? [],
      subject,
      text_body: body,
      html_body: null,
      in_reply_to: null,
      references_header: null,
      status: "draft",
      sync_status: "pending",
      sync_error: null,
    })
    .select("*")
    .single();
  if (draftInsert.error || !draftInsert.data) throw new Error("Could not create inbox draft");

  const threadInsert = await db
    .from("email_threads")
    .insert({
      user_id: input.userId,
      provider_thread_id: `discovery-target:${target.id}`,
      subject,
      snippet: body.slice(0, 240),
      folder: "drafts",
      is_unread: false,
      message_count: 0,
      last_message_at: new Date().toISOString(),
      brand_match_id: (target.brand_match_id as string | null) ?? null,
      contact_id: null,
      deal_id: null,
      last_synced_at: new Date().toISOString(),
      sync_status: "pending",
      sync_error: null,
    })
    .select("id")
    .single();
  if (threadInsert.error || !threadInsert.data) throw new Error("Could not create inbox thread");

  await db
    .from("email_drafts")
    .update({ thread_id: threadInsert.data.id })
    .eq("id", draftInsert.data.id)
    .eq("user_id", input.userId);

  return {
    draft_id: draftInsert.data.id as string,
    thread_id: threadInsert.data.id as string,
    brand_name: String(target.display_name ?? "Outreach target"),
  };
}

async function analyzeAndScoreBrand(input: {
  userId: string;
  brandMatchId: string;
  direction?: Direction;
}) {
  const creatorProfile = await ensureCreatorContentProfile(input.userId);
  const brandProfile = await ensureBrandContentProfile(input.userId, input.brandMatchId);

  const [{ data: creator }, { data: brand }] = await Promise.all([
    db.from("creator_profiles").select("*").eq("user_id", input.userId).maybeSingle(),
    db
      .from("brand_matches")
      .select("*")
      .eq("id", input.brandMatchId)
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  if (!creator || !brand) throw new Error("Discovery inputs missing");

  const creatorTags = {
    niches: (creatorProfile.niches as string[]) ?? [],
    contentTags: (creatorProfile.content_tags as string[]) ?? [],
    audienceTags: (creatorProfile.audience_tags as string[]) ?? [],
    toneTags: (creatorProfile.tone_tags as string[]) ?? [],
    platformTags: (creatorProfile.platform_tags as string[]) ?? [],
    followersTotal: Number(creatorProfile.followers_total ?? 0),
    rateFloor: Number(creatorProfile.rate_floor ?? creator.min_deal_value ?? 0),
  };
  const brandTags = {
    category: (brandProfile.category as string | null) ?? brand.brand_industry ?? null,
    productTags: (brandProfile.product_tags as string[]) ?? [],
    audienceTags: (brandProfile.audience_tags as string[]) ?? [],
    toneTags: (brandProfile.tone_tags as string[]) ?? [],
    campaignTags: (brandProfile.campaign_tags as string[]) ?? [],
    platformTags: (brandProfile.platform_tags as string[]) ?? [],
    publicContacts: (brandProfile.public_contacts as Array<Record<string, unknown>>) ?? [],
  };

  const directions: Direction[] = input.direction
    ? [input.direction]
    : ["creator_to_brand", "brand_to_creator"];
  const results: Array<Record<string, unknown>> = [];

  for (const direction of directions) {
    const score = scorePair({
      direction,
      creator,
      brand,
      creatorTags,
      brandTags,
    });
    const { data: scoreRow } = await db
      .from("match_scores")
      .upsert(
        {
          user_id: input.userId,
          direction,
          creator_profile_id: creator.id,
          brand_match_id: brand.id,
          creator_content_profile_id: creatorProfile.id,
          brand_content_profile_id: brandProfile.id,
          fit_score: score.fitScore,
          confidence: score.confidence,
          reasons: score.reasons,
          risks: score.risks,
          pitch_angle: score.pitchAngle,
          next_action: score.nextAction,
          score_breakdown: score.scoreBreakdown,
          label: score.label,
          review_status: direction === "creator_to_brand" ? "pending" : "archived",
        },
        {
          onConflict:
            "user_id,direction,brand_match_id,creator_content_profile_id,brand_content_profile_id",
        },
      )
      .select("*")
      .single();

    const brief = await upsertCampaignBrief({
      userId: input.userId,
      direction,
      creatorProfileId: creator.id,
      creatorContentProfileId: creatorProfile.id,
      brandMatchId: brand.id,
      brandContentProfileId: brandProfile.id,
      matchScoreId: scoreRow.id,
      creator,
      brand,
      score,
    });

    const review = await enqueueReview({
      userId: input.userId,
      direction,
      matchScoreId: scoreRow.id,
      campaignBriefId: brief?.id ?? null,
      title:
        direction === "creator_to_brand"
          ? `${brand.brand_name} is ready for review`
          : `${brand.brand_name} vs creator fit`,
      reason: score.reasons[0] ?? score.nextAction,
      nextAction: score.nextAction,
      fitScore: score.fitScore,
      payload: {
        match_score_id: scoreRow.id,
        brand_match_id: brand.id,
        creator_profile_id: creator.id,
        creator_content_profile_id: creatorProfile.id,
        brand_content_profile_id: brandProfile.id,
        direction,
        brief_id: brief?.id ?? null,
        score: score.scoreBreakdown,
      },
    });

    results.push({
      match_score_id: scoreRow.id,
      review_queue_id: review?.id ?? null,
      brief_id: brief?.id ?? null,
      direction,
      fit_score: score.fitScore,
      confidence: score.confidence,
      label: score.label,
      reasons: score.reasons,
      risks: score.risks,
      pitch_angle: score.pitchAngle,
      next_action: score.nextAction,
    });
  }

  return {
    creator_profile_id: creatorProfile.id,
    brand_content_profile_id: brandProfile.id,
    results,
  };
}

export const analyzeCreatorDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const job = await createDiscoveryJob({
      user_id: context.userId,
      job_type: "creator_analysis",
      direction: "brand_to_creator",
      input: {},
    });
    const profile = await ensureCreatorContentProfile(context.userId);
    if (job) {
      await db
        .from("discovery_jobs")
        .update({
          status: "succeeded",
          progress: 100,
          result: { creator_content_profile_id: profile.id },
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("user_id", context.userId);
    }
    return { ok: true as const, creator_content_profile_id: profile.id };
  });

export const analyzeBrandDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brand_match_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const job = await createDiscoveryJob({
      user_id: context.userId,
      job_type: "brand_analysis",
      direction: "creator_to_brand",
      entity_id: data.brand_match_id,
      input: { brand_match_id: data.brand_match_id },
    });
    const profile = await ensureBrandContentProfile(context.userId, data.brand_match_id);
    if (job) {
      await db
        .from("discovery_jobs")
        .update({
          status: "succeeded",
          progress: 100,
          result: { brand_content_profile_id: profile.id },
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("user_id", context.userId);
    }
    return { ok: true as const, brand_content_profile_id: profile.id };
  });

export const scoreDiscoveryMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ brand_match_id: z.string().uuid(), direction: DirectionSchema.optional() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const job = await createDiscoveryJob({
      user_id: context.userId,
      job_type: "match_scoring",
      direction: data.direction ?? null,
      entity_id: data.brand_match_id,
      input: data,
      status: "running",
      progress: 25,
    });
    try {
      const result = await analyzeAndScoreBrand({
        userId: context.userId,
        brandMatchId: data.brand_match_id,
        direction: data.direction,
      });
      if (job) {
        await db
          .from("discovery_jobs")
          .update({
            status: "succeeded",
            progress: 100,
            result,
            finished_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("user_id", context.userId);
      }
      return { ok: true as const, ...result };
    } catch (error) {
      if (job) {
        await db
          .from("discovery_jobs")
          .update({
            status: "failed",
            progress: 100,
            error_message: error instanceof Error ? error.message : String(error),
            finished_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("user_id", context.userId);
      }
      throw error;
    }
  });

export const listBrandDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [brands, profiles, scores, briefs, shortlists] = await Promise.all([
      db
        .from("brand_matches")
        .select("*")
        .eq("user_id", context.userId)
        .order("fit_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      db
        .from("brand_content_profiles")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      db
        .from("match_scores")
        .select("*")
        .eq("user_id", context.userId)
        .order("fit_score", { ascending: false })
        .limit(50),
      db
        .from("campaign_briefs")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("shortlists")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      brands: brands.data ?? [],
      brand_profiles: profiles.data ?? [],
      match_scores: scores.data ?? [],
      campaign_briefs: briefs.data ?? [],
      shortlists: shortlists.data ?? [],
    };
  });

export const listCreatorDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [creator, profile, scores, briefs, jobs, targets] = await Promise.all([
      db.from("creator_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("creator_content_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      db
        .from("match_scores")
        .select("*")
        .eq("user_id", context.userId)
        .eq("direction", "brand_to_creator")
        .order("fit_score", { ascending: false })
        .limit(50),
      db
        .from("campaign_briefs")
        .select("*")
        .eq("user_id", context.userId)
        .eq("direction", "brand_to_creator")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("discovery_jobs")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("outreach_targets")
        .select("*")
        .eq("user_id", context.userId)
        .eq("target_type", "creator")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      creator_profile: creator.data ?? null,
      creator_content_profile: profile.data ?? null,
      match_scores: scores.data ?? [],
      campaign_briefs: briefs.data ?? [],
      discovery_jobs: jobs.data ?? [],
      creator_targets: targets.data ?? [],
    };
  });

export const listReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [queue, scores, briefs] = await Promise.all([
      db
        .from("review_queue")
        .select("*")
        .eq("user_id", context.userId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      db
        .from("match_scores")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("campaign_briefs")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      review_queue: queue.data ?? [],
      match_scores: scores.data ?? [],
      campaign_briefs: briefs.data ?? [],
    };
  });

export const approveReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ queue_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: queue } = await db
      .from("review_queue")
      .select("*")
      .eq("id", data.queue_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!queue) throw new Error("Review item not found");

    const payload = (queue.payload as Record<string, unknown> | null) ?? {};
    let draft: { draft_id: string; thread_id: string; brand_name: string };
    if (payload.outreach_target_id) {
      draft = await createInboxDraftFromTarget({
        userId: context.userId,
        queueId: queue.id,
        targetId: String(payload.outreach_target_id),
      });
    } else {
      const { data: score } = await db
        .from("match_scores")
        .select("*")
        .eq("id", queue.match_score_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!score) throw new Error("Match score not found");

      draft = await createInboxDraftFromMatch({
        userId: context.userId,
        queueId: queue.id,
        matchScoreId: score.id,
      });
    }

    await db
      .from("review_queue")
      .update({
        status: "completed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "matchai",
      })
      .eq("id", queue.id)
      .eq("user_id", context.userId);

    await db.from("discovery_jobs").insert({
      user_id: context.userId,
      job_type: "review_publish",
      direction: queue.direction,
      status: "succeeded",
      progress: 100,
      input: {
        queue_id: queue.id,
        match_score_id: queue.match_score_id,
        outreach_target_id: payload.outreach_target_id ?? null,
      },
      result: draft,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });

    return { ok: true as const, draft };
  });

export const rejectReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ queue_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await db
      .from("review_queue")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "matchai",
      })
      .eq("id", data.queue_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export async function indexBrandDiscoveryRecord(args: {
  userId: string;
  brandMatchId: string;
  sourceType?: "manual" | "csv" | "onboarding" | "analysis" | "match" | "review" | "system";
}) {
  await writeDiscoverySource({
    user_id: args.userId,
    source_type: args.sourceType ?? "manual",
    source_name: "brand import",
    source_ref: args.brandMatchId,
    confidence: args.sourceType === "csv" ? 70 : 80,
    evidence: { brand_match_id: args.brandMatchId },
  });
  await ensureBrandContentProfile(args.userId, args.brandMatchId);
  return analyzeAndScoreBrand({ userId: args.userId, brandMatchId: args.brandMatchId });
}

export async function ensureCreatorDiscoveryIndex(userId: string) {
  await ensureCreatorContentProfile(userId);
  return true;
}
