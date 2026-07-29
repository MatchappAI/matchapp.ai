import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";

/* ----------------- Deal detail ----------------- */

const IdSchema = z.object({ deal_id: z.string().uuid() });

export const getDealDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase
      .from("deals")
      .select("*")
      .eq("user_id", userId)
      .eq("id", data.deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");
    return { deal };
  });

/* ----------------- Deliverables ----------------- */

export const listDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("deliverables")
      .select("*")
      .eq("user_id", userId)
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    return { deliverables: rows ?? [] };
  });

const CreateDeliverableSchema = z.object({
  deal_id: z.string().uuid(),
  deliverable_type: z.string().min(1).max(60),
  file_url: z.string().url().max(500).optional().or(z.literal("")),
  caption_draft: z.string().max(2000).optional(),
  post_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const createDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateDeliverableSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase
      .from("deals")
      .select("brand_name")
      .eq("user_id", userId)
      .eq("id", data.deal_id)
      .maybeSingle();
    const { error } = await supabase.from("deliverables").insert({
      user_id: userId,
      deal_id: data.deal_id,
      brand_name: deal?.brand_name ?? null,
      deliverable_type: data.deliverable_type,
      file_url: data.file_url || null,
      caption_draft: data.caption_draft ?? null,
      post_date: data.post_date || null,
      notes: data.notes ?? null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[deliverable] create failed", error);
      throw new Error("Failed to add deliverable. Please try again.");
    }
    return { ok: true };
  });

const UpdateDeliverableSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "approved", "revision_requested", "posted"]),
  revision_notes: z.string().max(2000).optional(),
});

export const updateDeliverableStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateDeliverableSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      status: typeof data.status;
      revision_notes: string | null;
      approved_at?: string;
      submitted_at?: string;
    } = {
      status: data.status,
      revision_notes: data.revision_notes ?? null,
    };
    if (data.status === "approved") patch.approved_at = new Date().toISOString();
    if (data.status === "submitted") patch.submitted_at = new Date().toISOString();
    const { error } = await supabase
      .from("deliverables")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) {
      console.error("[deliverable] update failed", error);
      throw new Error("Failed to update deliverable.");
    }
    return { ok: true };
  });

/* ----------------- Negotiation ----------------- */

export const listNegotiationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("negotiation_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: true });
    return { messages: rows ?? [] };
  });

const AddMsgSchema = z.object({
  deal_id: z.string().uuid(),
  sender: z.enum(["creator", "brand"]),
  message_text: z.string().min(1).max(4000),
  ai_recommendation: z.boolean().optional(),
});

export const addNegotiationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AddMsgSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("negotiation_messages").insert({
      user_id: userId,
      deal_id: data.deal_id,
      sender: data.sender,
      message_text: data.message_text,
      ai_recommendation: data.ai_recommendation ?? false,
    });
    if (error) {
      console.error("[negotiation] insert failed", error);
      throw new Error("Failed to send message.");
    }
    return { ok: true };
  });

export const generateNegotiationCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey)
      return { ok: false as const, error: "AI not configured" };
    const [deal, msgs, rules, profileData] = await Promise.all([
      supabaseAdmin.from("deals").select("*").eq("user_id", userId).eq("id", data.deal_id).maybeSingle(),
      supabaseAdmin
        .from("negotiation_messages")
        .select("sender,message_text")
        .eq("user_id", userId)
        .eq("deal_id", data.deal_id)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("pricing_rules").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    const provider = createLovableAiGatewayProvider(lovableKey);
    const model = provider("google/gemini-2.5-pro");
    const thread = (msgs.data ?? [])
      .map((m) => `${m.sender}: ${m.message_text}`)
      .join("\n");
    const { AGENT_VOICE_PRINCIPLES, NEGOTIATION_PROTECTION_RULES, personalizedVoiceGuide } = await import(
      "./agent-voice.server"
    );
    const voiceGuide = personalizedVoiceGuide(profileData.data);


    const r = await generateText({
      model,
      system: `${AGENT_VOICE_PRINCIPLES}

${voiceGuide}

${NEGOTIATION_PROTECTION_RULES}

You write the next message FROM the creator in a brand negotiation. One short, direct message under 120 words. No greetings, no sign-off. Sound like a real person who knows their worth — confident, not aggressive. Match the creator's voice from the Personalized Agent Voice above. Stay above the walk-away rate. If terms beyond price need pushback (usage, exclusivity, deliverables), address them too.`,

      prompt: `Brand: ${deal.data?.brand_name}
Floor: $${rules.data?.rate_floor ?? "?"}
Target: $${rules.data?.target_rate ?? "?"}
Walk-away: $${rules.data?.walk_away_rate ?? "?"}
Current deal value: $${deal.data?.deal_value ?? "TBD"}

Conversation so far:
${thread || "(no messages yet)"}

Write the next message now. Plain text only.`,
    });
    const text = r.text.trim();
    return { ok: true as const, suggestion: text };
  });

const UpdateTermsSchema = z.object({
  deal_id: z.string().uuid(),
  deal_value: z.number().min(0).max(10_000_000).optional(),
  timeline_days: z.number().int().min(0).max(3650).optional(),
  usage_rights: z.string().max(500).optional(),
  exclusivity: z.string().max(500).optional(),
  deliverables: z.string().max(2000).optional(),
  payment_terms: z.string().max(500).optional(),
  revision_limit: z.number().int().min(0).max(50).optional(),
  package_name: z.string().max(200).optional(),
});

export const updateDealTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateTermsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { deal_id, ...patch } = data;
    const { error } = await supabase
      .from("deals")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", deal_id);
    if (error) {
      console.error("[deals] terms update failed", error);
      throw new Error("Failed to save deal terms.");
    }
    return { ok: true };
  });

/* ----------------- Follow-ups ----------------- */

export const listFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("follow_up_sequences")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { followups: data ?? [] };
  });

const FollowUpIdSchema = z.object({ id: z.string().uuid() });

export const approveFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FollowUpIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("follow_up_sequences")
      .update({ approved: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) {
      console.error("[followup] approve failed", error);
      throw new Error("Failed to approve follow-up.");
    }
    return { ok: true };
  });

export const cancelFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FollowUpIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("follow_up_sequences")
      .update({ cancelled: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) {
      console.error("[followup] cancel failed", error);
      throw new Error("Failed to cancel follow-up.");
    }
    return { ok: true };
  });

const GenFuSchema = z.object({ outreach_id: z.string().uuid() });

export const generateFollowUpDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GenFuSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey)
      return { ok: false as const, error: "AI not configured" };
    const { data: oe } = await supabaseAdmin
      .from("outreach_emails")
      .select("subject,body,brand_match_id")
      .eq("user_id", userId)
      .eq("id", data.outreach_id)
      .maybeSingle();
    if (!oe) return { ok: false as const, error: "Outreach not found" };
    const { data: brand } = await supabaseAdmin
      .from("brand_matches")
      .select("brand_name")
      .eq("id", oe.brand_match_id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    const provider = createLovableAiGatewayProvider(lovableKey);
    const model = provider("google/gemini-2.5-pro");
    const schema = z.object({
      followups: z.array(
        z.object({
          subject: z.string(),
          body: z.string(),
          ai_reason: z.string(),
          days_after: z.number().int(),
        }),
      ),
    });
    const { AGENT_VOICE_PRINCIPLES, REDDIT_AUTHENTICITY_PRINCIPLES, personalizedVoiceGuide } = await import(
      "./agent-voice.server"
    );
    const { data: profileForVoice } = await supabaseAdmin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const voiceGuide = personalizedVoiceGuide(profileForVoice);
    const r = await generateText({
      model,
      system: `${AGENT_VOICE_PRINCIPLES}

${REDDIT_AUTHENTICITY_PRINCIPLES}

${voiceGuide}

Write a full, open-ended follow-up cadence from the creator — as many as it takes to earn a reply without getting spammy. Each must feel human, short, and distinct — NOT a templated chain. Match the creator's Personalized Agent Voice above (warmth, length, CTA style). Vary openers, sentence rhythm, and the angle across the sequence: early ones = gentle bumps with new context; middle ones = add value, share a fresh idea or stat, mention a recent campaign moment; later ones = short warm "reviving this / last try" notes with the door left open. No fake praise. No "just bumping this." Return STRICT JSON: {"followups":[{"subject","body","ai_reason","days_after"}]}.`,

      prompt: `Brand: ${brand?.brand_name ?? "Brand"}
Original subject: ${oe.subject}
Original body: ${oe.body}

Write a full follow-up cadence (no fixed number — use as many nudges as feels natural, typically 6–10, spaced from a few days out to ~90 days). Each entry needs its own days_after gap.`,
    });

    let parsed: z.infer<typeof schema>;
    try {
      parsed = schema.parse(JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
    } catch {
      return { ok: false as const, error: "AI returned invalid format" };
    }
    const rows = parsed.followups.map((f, i) => ({
      user_id: userId,
      outreach_id: data.outreach_id,
      brand_name: brand?.brand_name ?? null,
      sequence_number: i + 1,
      subject: f.subject,
      body: f.body,
      ai_reason: f.ai_reason,
      body_strategy: f.ai_reason,
      scheduled_at: new Date(Date.now() + f.days_after * 86400000).toISOString(),
      approved: false,
      sent: false,
      cancelled: false,
    }));
    await supabaseAdmin.from("follow_up_sequences").insert(rows);
    return { ok: true as const, count: rows.length };
  });

/* ----------------- Learning insights ----------------- */

export const listLearningInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: insights }, { data: outreach }, { data: deals }] = await Promise.all([
      supabase
        .from("learning_insights")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("outreach_emails")
        .select("subject,replied,performance_note")
        .eq("user_id", userId)
        .eq("sent", true),
      supabase.from("deals").select("status,invoice_status,deal_value").eq("user_id", userId),
    ]);
    const sent = outreach?.length ?? 0;
    const replies = (outreach ?? []).filter((o) => o.replied).length;
    const replyRate = sent > 0 ? Math.round((replies / sent) * 100) : 0;
    const completed = (deals ?? []).filter((d) => d.invoice_status === "paid");
    const avgValue = completed.length
      ? Math.round(
          completed.reduce((s, d) => s + Number(d.deal_value ?? 0), 0) / completed.length,
        )
      : 0;
    return {
      insights: insights ?? [],
      stats: {
        sentCount: sent,
        replyRate,
        dealsCompleted: completed.length,
        avgValue,
      },
      bestPitches: (outreach ?? [])
        .filter((o) => o.replied)
        .slice(0, 5),
    };
  });

export const applyLearningInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FollowUpIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("learning_insights")
      .update({ applied: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) {
      console.error("[learning] apply failed", error);
      throw new Error("Failed to apply insight.");
    }
    return { ok: true };
  });

export const generateLearningInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey)
      return { ok: false as const, error: "AI not configured" };
    const [{ data: outreach }, { data: deals }] = await Promise.all([
      supabaseAdmin
        .from("outreach_emails")
        .select("subject,body,replied,performance_note")
        .eq("user_id", userId)
        .eq("sent", true)
        .limit(40),
      supabaseAdmin
        .from("deals")
        .select("brand_name,deal_value,status,invoice_status,timeline_days")
        .eq("user_id", userId)
        .limit(40),
    ]);

    const provider = createLovableAiGatewayProvider(lovableKey);
    const model = provider("google/gemini-2.5-pro");
    const schema = z.object({
      insights: z.array(
        z.object({
          insight_title: z.string(),
          recommendation: z.string(),
          evidence: z.string(),
          expected_impact: z.string(),
        }),
      ).min(2).max(5),
    });
    const { AGENT_VOICE_PRINCIPLES } = await import("./agent-voice.server");
    const r = await generateText({
      model,
      system: `${AGENT_VOICE_PRINCIPLES}

You analyze what's actually working for THIS creator based on real outreach + deals data and produce 3 sharp, specific learning insights. Each insight is something you've learned about the creator — written in agent voice, like notes you'd keep in a memory file.

Examples of good titles:
- "You usually approve shorter messages."
- "Local brands are converting better for you."
- "Startup and AI brands are getting replies."
- "You skip gifted-only deals — I'll deprioritize them."
- "Your best-performing pitches lead with a specific content idea."

Return STRICT JSON: {"insights":[{"insight_title","recommendation","evidence","expected_impact"}]}. No generic advice. No buzzwords.`,
      prompt: `Outreach: ${JSON.stringify(outreach ?? []).slice(0, 4000)}
Deals: ${JSON.stringify(deals ?? []).slice(0, 4000)}

Generate 3 specific insights grounded in this data.`,
    });
    let parsed: z.infer<typeof schema>;
    try {
      parsed = schema.parse(JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
    } catch {
      return { ok: false as const, error: "AI returned invalid format" };
    }
    const rows = parsed.insights.map((i) => ({
      user_id: userId,
      insight_title: i.insight_title,
      recommendation: i.recommendation,
      evidence: i.evidence,
      expected_impact: i.expected_impact,
      applied: false,
    }));
    await supabaseAdmin.from("learning_insights").insert(rows);
    return { ok: true as const, count: rows.length };
  });

/* ----------------- Pricing ----------------- */

export const getPricingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: rules }, { data: deals }, { data: stats }] = await Promise.all([
      supabase.from("pricing_rules").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("deals").select("deal_value,invoice_status").eq("user_id", userId),
      supabase
        .from("platform_stats")
        .select("follower_count,engagement_rate")
        .eq("user_id", userId),
    ]);
    const paid = (deals ?? []).filter((d) => d.invoice_status === "paid");
    const avgClosed = paid.length
      ? Math.round(paid.reduce((s, d) => s + Number(d.deal_value ?? 0), 0) / paid.length)
      : 0;
    const followers = (stats ?? []).reduce((s, x) => s + (x.follower_count ?? 0), 0);
    const eng = stats?.length
      ? (stats.reduce((s, x) => s + Number(x.engagement_rate ?? 0), 0) / stats.length).toFixed(2)
      : "0.00";

    // Recommended rates table — CPM-style rough heuristic
    const baseCPM = Math.max(15, Math.min(60, Math.round(15 + Number(eng) * 8)));
    const recommendedRates = [
      { package: "Single TikTok / Reel", price: Math.round((followers / 1000) * baseCPM * 0.6) },
      { package: "Single YouTube integration", price: Math.round((followers / 1000) * baseCPM * 1.4) },
      { package: "3-post bundle", price: Math.round((followers / 1000) * baseCPM * 1.8) },
      { package: "30-day exclusivity add-on", price: Math.round((followers / 1000) * baseCPM * 0.9) },
      { package: "Usage rights (90d)", price: Math.round((followers / 1000) * baseCPM * 0.5) },
    ];

    return {
      rules: rules ?? null,
      avgClosed,
      followers,
      eng,
      recommendedRates,
    };
  });

const PricingRulesSchema = z.object({
  rate_floor: z.number().int().min(0).max(10_000_000).nullable().optional(),
  target_rate: z.number().int().min(0).max(10_000_000).nullable().optional(),
  walk_away_rate: z.number().int().min(0).max(10_000_000).nullable().optional(),
  rush_fee: z.number().min(0).max(1_000_000).nullable().optional(),
  bundle_discount: z.number().min(0).max(100).nullable().optional(),
  revision_fee: z.number().int().min(0).max(1_000_000).nullable().optional(),
  exclusivity_fee: z.number().min(0).max(1_000_000).nullable().optional(),
  usage_rights_fee: z.number().min(0).max(1_000_000).nullable().optional(),
  creator_note: z.string().max(2000).optional().nullable(),
});

export const upsertPricingRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PricingRulesSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("pricing_rules")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("pricing_rules")
        .update({ ...data, configured: true })
        .eq("user_id", userId)
        .eq("id", existing.id);
      if (error) {
        console.error("[pricing] update failed", error);
        throw new Error("Failed to save pricing rules.");
      }
    } else {
      const { error } = await supabase
        .from("pricing_rules")
        .insert({ user_id: userId, ...data, configured: true });
      if (error) {
        console.error("[pricing] insert failed", error);
        throw new Error("Failed to save pricing rules.");
      }
    }
    return { ok: true };
  });

/* ----------------- Settings: agent rules, brand prefs, payment, profile ----------------- */

const AgentRulesSchema = z.object({
  auto_outreach: z.boolean().optional(),
  auto_negotiate: z.boolean().optional(),
  auto_follow_up: z.boolean().optional(),
  approval_before_send: z.boolean().optional(),
  approval_money_terms: z.boolean().optional(),
  approval_contracts: z.boolean().optional(),
  approval_deliverables: z.boolean().optional(),
  minimum_rate: z.number().int().min(0).max(10_000_000).nullable().optional(),
  target_rate: z.number().int().min(0).max(10_000_000).nullable().optional(),
  walk_away_rate: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export const getAgentRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("agent_rules")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { rules: data ?? null };
  });

export const upsertAgentRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AgentRulesSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("agent_rules")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("agent_rules")
        .update({ ...data, rules_configured: true })
        .eq("user_id", userId)
        .eq("id", existing.id);
      if (error) throw new Error("Failed to save agent rules.");
    } else {
      const { error } = await supabase
        .from("agent_rules")
        .insert({ user_id: userId, ...data, rules_configured: true });
      if (error) throw new Error("Failed to save agent rules.");
    }
    return { ok: true };
  });

const BrandPrefsSchema = z.object({
  preferred_categories: z.string().max(1000).optional().nullable(),
  blocked_categories: z.string().max(1000).optional().nullable(),
  dream_brands: z.string().max(1000).optional().nullable(),
  brand_size_preference: z.string().max(200).optional().nullable(),
  brand_values: z.string().max(1000).optional().nullable(),
  values_to_avoid: z.string().max(1000).optional().nullable(),
  location_restrictions: z.string().max(500).optional().nullable(),
  additional_notes: z.string().max(2000).optional().nullable(),
});

export const getBrandPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("brand_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { prefs: data ?? null };
  });

export const upsertBrandPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BrandPrefsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("brand_preferences")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("brand_preferences")
        .update({ ...data, configured: true })
        .eq("user_id", userId)
        .eq("id", existing.id);
      if (error) throw new Error("Failed to save preferences.");
    } else {
      const { error } = await supabase
        .from("brand_preferences")
        .insert({ user_id: userId, ...data, configured: true });
      if (error) throw new Error("Failed to save preferences.");
    }
    return { ok: true };
  });

const PaymentSchema = z.object({
  payout_method: z.string().max(100).optional().nullable(),
  invoice_name: z.string().max(255).optional().nullable(),
  invoice_details: z.string().max(2000).optional().nullable(),
  tax_form_type: z.string().max(100).optional().nullable(),
  tax_info_status: z.string().max(100).optional().nullable(),
  escrow_default: z.boolean().optional(),
});

export const getPaymentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("payment_accounts")
      .select("id, user_id, stripe_connected, payout_method, escrow_default, invoice_name, invoice_details, tax_info_status, tax_form_type, created_at, updated_at, setup_skipped")
      .eq("user_id", userId)
      .maybeSingle();
    return { account: data ?? null };
  });

export const upsertPaymentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PaymentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("payment_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("payment_accounts")
        .update(data)
        .eq("user_id", userId)
        .eq("id", existing.id);
      if (error) throw new Error("Failed to save payment info.");
    } else {
      const { error } = await supabase
        .from("payment_accounts")
        .insert({ user_id: userId, ...data });
      if (error) throw new Error("Failed to save payment info.");
    }
    return { ok: true };
  });

const ProfileSchema = z.object({
  full_name: z.string().max(255).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  niche: z.string().max(255).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  primary_platform: z.string().max(50).optional().nullable(),
  handle: z.string().max(255).optional().nullable(),
  min_deal_value: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export const getCreatorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { profile: data ?? null };
  });

export const upsertCreatorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProfileSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("id,platforms")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("creator_profiles")
        .update(data)
        .eq("user_id", userId)
        .eq("id", existing.id);
      if (error) throw new Error("Failed to save profile.");
    } else {
      const { error } = await supabase
        .from("creator_profiles")
        .insert({ user_id: userId, platforms: [], ...data });
      if (error) throw new Error("Failed to save profile.");
    }
    return { ok: true };
  });

/* ----------------- Reply review (Replies, handled) ----------------- */

const ReplyReviewSchema = z.object({ outreach_id: z.string().uuid() });

export const getReplyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReplyReviewSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: outreach } = await supabase
      .from("outreach_emails")
      .select(
        "id, subject, body, to_email, brand_reply_text, brand_match_id",
      )
      .eq("user_id", userId)
      .eq("id", data.outreach_id)
      .maybeSingle();
    if (!outreach) throw new Error("Outreach not found");

    const { data: brand } = outreach.brand_match_id
      ? await supabase
          .from("brand_matches")
          .select("brand_name, brand_industry, estimated_deal_min, estimated_deal_max")
          .eq("id", outreach.brand_match_id)
          .maybeSingle()
      : { data: null };

    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("full_name, handle, primary_platform, niche, agent_memory")
      .eq("user_id", userId)
      .maybeSingle();

    // Plan gate — free tier sees the fact of a reply and an estimated value,
    // but not the reply body or the AI-drafted response. Paid plans see all.
    const { data: planRow } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = (planRow?.plan ?? "free") as string;
    const locked = plan === "free";

    const replyText = outreach.brand_reply_text ?? "";
    let intent: "interested" | "negotiating" | "asking_questions" | "soft_pass" | "rejection" | "unclear" = "unclear";
    let summary = "";
    let suggestedReply = "";
    let strategy = "";

    if (replyText && !locked) {
      const key = process.env.LOVABLE_API_KEY;
      if (key) {
        try {
          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-2.5-pro");
          const prompt = `You are a brand-deals agent reading a reply from a brand to a creator's outreach. Be honest and protective of the creator.

Brand: ${brand?.brand_name ?? "Unknown"} (${brand?.brand_industry ?? "general"})
Creator: ${profile?.full_name ?? "the creator"} (@${profile?.handle ?? ""}, ${profile?.primary_platform ?? ""}, niche: ${profile?.niche ?? "—"})
Estimated deal range we'd quote: $${brand?.estimated_deal_min ?? 0}–$${brand?.estimated_deal_max ?? 0}

Original subject: ${outreach.subject ?? ""}
Original body:
${(outreach.body ?? "").slice(0, 1500)}

Brand reply:
${replyText.slice(0, 2500)}

Return ONLY a JSON object:
{
  "intent": "interested" | "negotiating" | "asking_questions" | "soft_pass" | "rejection" | "unclear",
  "summary": "1-2 sentences in plain English: what the brand actually wants or said.",
  "strategy": "1-2 sentences: my read as their agent — what to push for, what to watch out for, whether to hold price.",
  "suggested_reply": "A short, casual, on-voice reply (80-140 words, plain text, no signature). Keep one clear next step. Do NOT invent numbers the creator hasn't approved."
}`;
          const ai = await generateText({ model, prompt });
          const jsonMatch = ai.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as {
              intent?: string;
              summary?: string;
              strategy?: string;
              suggested_reply?: string;
            };
            if (parsed.intent && ["interested","negotiating","asking_questions","soft_pass","rejection","unclear"].includes(parsed.intent)) {
              intent = parsed.intent as typeof intent;
            }
            summary = (parsed.summary ?? "").slice(0, 600);
            strategy = (parsed.strategy ?? "").slice(0, 600);
            suggestedReply = (parsed.suggested_reply ?? "").slice(0, 4000);
          }
        } catch (e) {
          console.error("[getReplyReview] AI failed", e);
        }
      }
    }

    return {
      plan,
      locked,
      outreach: {
        id: outreach.id,
        subject: outreach.subject,
        body: locked ? "" : outreach.body,
        to_email: outreach.to_email,
        brand_reply_text: locked ? "" : replyText,
      },
      brand: brand
        ? {
            name: brand.brand_name,
            industry: brand.brand_industry,
            estimated_deal_min: brand.estimated_deal_min,
            estimated_deal_max: brand.estimated_deal_max,
          }
        : null,
      review: { intent, summary, strategy, suggestedReply },
    };
  });

const LogReplyApprovedSchema = z.object({
  approval_id: z.string().uuid(),
  outreach_id: z.string().uuid(),
});

export const acknowledgeReplyApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LogReplyApprovedSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("id", data.approval_id);
    return { ok: true as const };
  });
