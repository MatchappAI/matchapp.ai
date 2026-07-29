import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Compile rich user context for the agent system prompt. */
export async function loadAgentContext(userId: string) {
  const [
    profile,
    stats,
    rules,
    pricing,
    brands,
    deals,
    approvals,
    outreach,
    gmail,
    prefs,
    insights,
  ] = await Promise.all([
    supabaseAdmin.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("platform_stats").select("*").eq("user_id", userId),
    supabaseAdmin.from("agent_rules").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("pricing_rules").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("brand_matches")
      .select(
        "id, brand_name, brand_industry, fit_score, status, estimated_deal_min, estimated_deal_max, suggested_package, outreach_angle, my_take, partnership_angle",
      )
      .eq("user_id", userId)
      .order("fit_score", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("deals")
      .select("id, brand_name, status, deal_value, contract_status, escrow_status, invoice_status")
      .eq("user_id", userId)
      .neq("status", "completed")
      .limit(20),
    supabaseAdmin
      .from("approvals")
      .select("id, approval_type, brand_name, amount, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(10),
    supabaseAdmin
      .from("outreach_emails")
      .select("id, subject, sent, replied, brand_match_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("connected_accounts")
      .select("service, connected, account_email")
      .eq("user_id", userId),
    supabaseAdmin
      .from("brand_preferences")
      .select(
        "preferred_categories, blocked_categories, dream_brands, brand_size_preference, values_to_avoid, additional_notes",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("learning_insights")
      .select("insight_title, recommendation, applied")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    profile: profile.data,
    stats: stats.data ?? [],
    rules: rules.data,
    pricing: pricing.data,
    brands: brands.data ?? [],
    deals: deals.data ?? [],
    approvals: approvals.data ?? [],
    outreach: outreach.data ?? [],
    connections: gmail.data ?? [],
    prefs: prefs.data,
    insights: insights.data ?? [],
  };
}

export function summarizeContext(ctx: Awaited<ReturnType<typeof loadAgentContext>>): string {
  const p = ctx.profile;
  const lines: string[] = [];
  lines.push("=== CREATOR CONTEXT (real data — use it, don't invent) ===");
  if (p) {
    lines.push(
      `Name: ${p.full_name ?? "(unknown)"} | @${p.handle ?? "?"} on ${p.primary_platform ?? "?"} | Niche: ${p.niche ?? "?"} | Followers: ${p.follower_count ?? "?"} | Location: ${p.location ?? "?"}`,
    );
    if (p.tone) lines.push(`Creator tone: ${p.tone}`);
    if (p.content_style) lines.push(`Content style: ${p.content_style}`);
    if (p.target_audience) lines.push(`Target audience: ${p.target_audience}`);
    if (p.audience_age_band) lines.push(`Audience age: ${p.audience_age_band}`);
    if (p.content_themes?.length)
      lines.push(`Top content themes: ${p.content_themes.slice(0, 6).join(", ")}`);
    if (p.bio) lines.push(`Bio: ${p.bio.slice(0, 220)}`);
    if (p.deal_type_preference?.length)
      lines.push(`Preferred deal types: ${p.deal_type_preference.join(", ")}`);
    if (p.gifted_products_accepted === false)
      lines.push(`Rule: DOES NOT accept gifted-only deals.`);
    if (p.market_scope) lines.push(`Market scope: ${p.market_scope}`);
    // Personalization knobs
    const pp = p as Record<string, unknown>;
    const knobs: string[] = [];
    if (pp.growth_stage) knobs.push(`stage=${pp.growth_stage}`);
    if (pp.confidence_level) knobs.push(`confidence=${pp.confidence_level}`);
    if (pp.voice_formality) knobs.push(`voice=${pp.voice_formality}`);
    if (pp.voice_length) knobs.push(`length=${pp.voice_length}`);
    if (pp.voice_warmth) knobs.push(`warmth=${pp.voice_warmth}`);
    if (pp.explanation_level) knobs.push(`explain=${pp.explanation_level}`);
    if (pp.autonomy_level) knobs.push(`autonomy=${pp.autonomy_level}`);
    if (pp.pricing_aggressiveness) knobs.push(`pricing=${pp.pricing_aggressiveness}`);
    if (pp.cta_style) knobs.push(`cta=${pp.cta_style}`);
    if (knobs.length) lines.push(`Personalization: ${knobs.join(" · ")}`);
  }

  if (ctx.pricing) {
    lines.push(
      `Pricing: floor $${ctx.pricing.rate_floor ?? "?"}, target $${ctx.pricing.target_rate ?? "?"}, walkaway $${ctx.pricing.walk_away_rate ?? "?"}`,
    );
  }
  if (ctx.rules) {
    lines.push(
      `Rules: auto_outreach=${ctx.rules.auto_outreach} auto_follow_up=${ctx.rules.auto_follow_up} approve_before_send=${ctx.rules.approval_before_send}`,
    );
  }
  if (ctx.prefs) {
    if (ctx.prefs.preferred_categories)
      lines.push(`Likes brand categories: ${ctx.prefs.preferred_categories}`);
    if (ctx.prefs.blocked_categories)
      lines.push(`AVOID brand categories: ${ctx.prefs.blocked_categories}`);
    if (ctx.prefs.values_to_avoid)
      lines.push(`Values to avoid in brands: ${ctx.prefs.values_to_avoid}`);
    if (ctx.prefs.dream_brands) lines.push(`Dream brands: ${ctx.prefs.dream_brands}`);
    if (ctx.prefs.brand_size_preference)
      lines.push(`Brand size preference: ${ctx.prefs.brand_size_preference}`);
    if (ctx.prefs.additional_notes)
      lines.push(`Creator notes: ${ctx.prefs.additional_notes.slice(0, 240)}`);
  }
  if (ctx.stats?.length) {
    const themes = ctx.stats.flatMap((s) => (s as { top_content_categories?: string[] }).top_content_categories ?? []);
    if (themes.length) lines.push(`Top performing topics: ${[...new Set(themes)].slice(0, 6).join(", ")}`);
    const eng = ctx.stats.map((s) => Number((s as { engagement_rate?: number }).engagement_rate ?? 0)).filter(Boolean);
    if (eng.length) lines.push(`Avg engagement: ${(eng.reduce((a, b) => a + b, 0) / eng.length).toFixed(2)}%`);
  }
  if (ctx.brands.length) {
    lines.push(
      `Top brand matches: ${ctx.brands.slice(0, 5).map((b) => `${b.brand_name} (${b.fit_score}%)`).join(", ")}`,
    );
  }
  if (ctx.deals.length) {
    lines.push(`Active deals: ${ctx.deals.map((d) => `${d.brand_name} [${d.status}]`).join(", ")}`);
  }
  if (ctx.approvals.length) lines.push(`Pending approvals: ${ctx.approvals.length}`);
  if (ctx.insights.length) {
    const applied = ctx.insights.filter((i) => i.applied);
    if (applied.length) {
      lines.push(
        `What I've learned about you so far: ${applied.map((i) => i.insight_title).slice(0, 5).join(" · ")}`,
      );
    }
  }
  lines.push(
    `Outreach sending: MatchAI sends every pitch and follow-up from its own verified domain (outreach@notify.www.matchapp.ai, shown as "You via MatchAI"). Brand replies route straight back into the MatchAI workspace — the creator never connects Gmail, Outlook, or any external inbox. Do not suggest connecting an email provider; there isn't one to connect.`,
  );


  return lines.join("\n");
}
