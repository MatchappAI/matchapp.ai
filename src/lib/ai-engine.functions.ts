import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";

const AnalysisSchema = z.object({
  recommended_floor: z.number().int().min(0),
  recommended_packages: z
    .array(z.object({ name: z.string(), price: z.number().int().min(0) }))
    .length(3),
  first_brand_opportunities: z
    .array(
      z.object({
        brand_name: z.string(),
        brand_industry: z.string(),
        fit_score: z.number().int().min(0).max(100),
        fit_reasoning: z.string(),
        estimated_deal_min: z.number().int().min(0),
        estimated_deal_max: z.number().int().min(0),
        suggested_package: z.string(),
        outreach_angle: z.string(),
        market_type: z.enum(["local", "international"]),
      }),
    )
    .length(10),
  analysis_summary: z.string(),
  pricing_insight: z.string(),
});

export type CreatorAnalysis = z.infer<typeof AnalysisSchema>;

export const runCreatorAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; analysis: CreatorAnalysis } | { ok: false; error: string }> => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) return { ok: false, error: "AI not configured" };

    const { data: profile } = await supabaseAdmin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: stats } = await supabaseAdmin
      .from("platform_stats")
      .select("*")
      .eq("user_id", userId);
    const { data: brandPrefs } = await supabaseAdmin
      .from("brand_preferences")
      .select("blocked_categories")
      .eq("user_id", userId)
      .maybeSingle();

    const marketScope = (profile?.market_scope as "local" | "international" | "both" | null) ?? "both";
    const creatorLocation = profile?.location ?? null;

    const input = {
      name: profile?.full_name ?? null,
      platform: profile?.primary_platform ?? null,
      handle: profile?.handle ?? null,
      niche: profile?.niche ?? null,
      location: creatorLocation,
      market_scope: marketScope,
      min_deal_value: profile?.min_deal_value ?? null,
      deal_type_preference: profile?.deal_type_preference ?? null,
      blocked_categories: brandPrefs?.blocked_categories ?? profile?.blocked_industries ?? null,
      platform_stats: (stats ?? []).map((s) => ({
        platform: s.platform,
        follower_count: s.follower_count,
        avg_views: s.avg_views,
        engagement_rate: s.engagement_rate,
        top_content_categories: s.top_content_categories,
        posting_cadence: s.posting_cadence,
        recent_post_snapshot: s.recent_post_snapshot,
      })),
    };

    const scopeInstruction =
      marketScope === "local"
        ? `Only suggest brands that operate in ${creatorLocation ?? "the creator's country"}. Every first_brand_opportunities[*].market_type must be "local".`
        : marketScope === "international"
          ? `Only suggest international/global brands. Every first_brand_opportunities[*].market_type must be "international".`
          : `Return a mix of local (operating in ${creatorLocation ?? "the creator's country"}) and international brands. Tag each opportunity's market_type accordingly.`;

    const system = `You are a creator economy analyst. Based on the creator profile below, generate a monetization analysis and first brand matches. Return JSON only with these exact fields:
{
  "recommended_floor": integer (USD),
  "recommended_packages": [{"name": string, "price": integer}, {"name": string, "price": integer}, {"name": string, "price": integer}],
  "first_brand_opportunities": [{"brand_name": string, "brand_industry": string, "fit_score": integer 0-100, "fit_reasoning": string (1-2 sentences), "estimated_deal_min": integer, "estimated_deal_max": integer, "suggested_package": string, "outreach_angle": string (1 sentence), "market_type": "local" | "international"}] (exactly 10 items, real companies only),
  "analysis_summary": string (2 sentences),
  "pricing_insight": string (1 sentence about their rate positioning)
}
${scopeInstruction}
Only suggest real companies. Tailor every match to the niche, platform, and audience described. Return JSON only, no markdown, no commentary.`;

    let parsed: CreatorAnalysis;
    try {
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const model = gateway("google/gemini-2.5-pro");
      const { text } = await generateText({
        model,
        system,
        prompt: `Creator profile:\n${JSON.stringify(input, null, 2)}`,
      });
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const raw = JSON.parse(cleaned);
      parsed = AnalysisSchema.parse(raw);
    } catch (e) {
      console.error("[ai-engine] analysis failed", e);
      return { ok: false, error: "AI analysis failed" };
    }

    // Persist ai_analysis
    await supabaseAdmin.from("ai_analysis").upsert(
      {
        user_id: userId,
        recommended_floor: parsed.recommended_floor,
        recommended_packages: parsed.recommended_packages,
        first_brand_opportunities: parsed.first_brand_opportunities.map((o) => o.brand_name),
        high_fit_deal_types: parsed.first_brand_opportunities.filter((o) => o.fit_score >= 80).length,
        analysis_summary: parsed.analysis_summary,
        pricing_insight: parsed.pricing_insight,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    // Persist brand_matches (delete + insert)
    await supabaseAdmin.from("brand_matches").delete().eq("user_id", userId);
    await supabaseAdmin.from("brand_matches").insert(
      parsed.first_brand_opportunities.map((o) => ({
        user_id: userId,
        brand_name: o.brand_name,
        brand_industry: o.brand_industry,
        fit_score: o.fit_score,
        fit_reasoning: o.fit_reasoning,
        estimated_deal_min: o.estimated_deal_min,
        estimated_deal_max: o.estimated_deal_max,
        suggested_package: o.suggested_package,
        outreach_angle: o.outreach_angle,
        market_type: o.market_type,
      })),
    );

    // pricing_rules: set rate_floor
    await supabaseAdmin.from("pricing_rules").upsert(
      { user_id: userId, rate_floor: parsed.recommended_floor },
      { onConflict: "user_id" },
    );

    // Mark onboarding complete
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_complete: true, onboarding_step: 3 })
      .eq("user_id", userId);

    return { ok: true, analysis: parsed };
  });
