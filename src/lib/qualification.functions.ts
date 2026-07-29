/**
 * Reply qualification for monetization v2.
 *
 * Rule-based filter → LLM classifier → confidence.
 * If classification is a qualifying paid class and confidence >= 0.7,
 * flips profiles.free_access_status to 'pricing_decision_required' and
 * stamps qualified_reply_received_at (idempotent — never overwrites).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REPLY_CLASSIFICATIONS = [
  "qualified_paid_interest",
  "negotiation_started",
  "request_for_rates",
  "request_for_information",
  "gifted_only",
  "affiliate_only",
  "rejection",
  "auto_reply",
  "unsubscribe",
  "spam",
  "unclear",
] as const;
export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

const QUALIFYING: ReplyClassification[] = [
  "qualified_paid_interest",
  "negotiation_started",
  "request_for_rates",
];

function ruleBased(body: string): { cls: ReplyClassification; conf: number } | null {
  const t = body.toLowerCase();
  if (/\bunsubscribe\b|opt[- ]out|remove me/.test(t)) return { cls: "unsubscribe", conf: 0.95 };
  if (/out of office|auto[- ]?reply|automatic reply|vacation/.test(t)) return { cls: "auto_reply", conf: 0.9 };
  if (/not interested|no thanks|not a fit|pass on this/.test(t)) return { cls: "rejection", conf: 0.85 };
  if (/gift(ed)? (only|product)|in exchange for a? ?post|complimentary product/.test(t) && !/paid|budget|\$/.test(t)) {
    return { cls: "gifted_only", conf: 0.8 };
  }
  if (/affiliate|commission[- ]only|% of sales/.test(t) && !/paid|budget|flat fee|\$/.test(t)) {
    return { cls: "affiliate_only", conf: 0.8 };
  }
  return null;
}

async function llmClassify(body: string, brand?: string): Promise<{ cls: ReplyClassification; conf: number; reason: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { cls: "unclear", conf: 0, reason: "No AI key configured" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              `Classify a brand's reply to a creator's outreach. Return strict JSON: {"classification":"...","confidence":0..1,"reason":"..."}. Classification must be one of: ${REPLY_CLASSIFICATIONS.join(", ")}. Use qualified_paid_interest only if the brand clearly wants a paid collaboration. Use negotiation_started for rate/terms discussion. Use request_for_rates when asking for a rate card in a paid context.`,
          },
          { role: "user", content: `Brand: ${brand ?? "unknown"}\n\nReply:\n${body}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { cls: "unclear", conf: 0, reason: `AI error ${res.status}` };
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    const cls = (REPLY_CLASSIFICATIONS as readonly string[]).includes(parsed.classification)
      ? (parsed.classification as ReplyClassification)
      : "unclear";
    return {
      cls,
      conf: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason ?? ""),
    };
  } catch (err) {
    console.error("[qualification] llm failed", err);
    return { cls: "unclear", conf: 0, reason: "AI failure" };
  }
}

export const classifyReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        outreach_id: z.string().uuid(),
        reply_body: z.string().min(1).max(20_000),
        brand_name: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Creator opt-ins for gifted/affiliate — treat these as qualifying if enabled.
    const { data: cp } = await supabase
      .from("creator_profiles")
      .select("gifted_products_accepted")
      .eq("user_id", userId)
      .maybeSingle();
    const giftedOk = !!cp?.gifted_products_accepted;

    const rb = ruleBased(data.reply_body);
    let cls: ReplyClassification;
    let conf: number;
    let reason: string;
    if (rb) {
      cls = rb.cls; conf = rb.conf; reason = "rule-based";
    } else {
      const l = await llmClassify(data.reply_body, data.brand_name);
      cls = l.cls; conf = l.conf; reason = l.reason;
    }

    await supabase
      .from("outreach_emails")
      .update({
        reply_classification: cls,
        reply_classified_at: new Date().toISOString(),
        qualification_confidence: conf,
        qualification_reason: reason,
      })
      .eq("id", data.outreach_id)
      .eq("user_id", userId);

    // Qualifying?
    const isQualifying =
      (QUALIFYING.includes(cls) && conf >= 0.7) ||
      (cls === "gifted_only" && giftedOk);

    let gated = false;
    if (isQualifying) {
      // Flip pricing gate — idempotent.
      const { data: prof } = await supabase
        .from("profiles")
        .select("free_access_status, qualified_reply_received_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (prof && prof.free_access_status === "unrestricted") {
        await supabase
          .from("profiles")
          .update({
            free_access_status: "pricing_decision_required",
            qualified_reply_received_at: prof.qualified_reply_received_at ?? new Date().toISOString(),
          })
          .eq("user_id", userId);
        gated = true;
        await supabase.from("agent_activity").insert({
          user_id: userId,
          activity_type: "brand_replied",
          title: "Qualified brand reply — choose how to proceed",
          description: `${data.brand_name ?? "A brand"} is interested in a paid collaboration. Pick Stay Free (20% only if it closes) or a paid plan (0% fee).`,
          related_id: data.outreach_id,
          action_label: "Open opportunity",
          action_route: "/dashboard/approvals",
        });
      }
    }

    return { classification: cls, confidence: conf, reason, gated };
  });

/** Lock monetization choice on the profile. Called from the Qualified Opportunity screen. */
export const lockMonetizationChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        choice: z.enum([
          "stay_free_success_fee",
          "starter_subscription",
          "growth_subscription",
          "pro_subscription",
        ]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { MONETIZATION_COPY } = await import("@/lib/pricing-config");
    await supabase
      .from("profiles")
      .update({
        monetization_choice: data.choice,
        free_access_status: "decided",
        terms_accepted_at: new Date().toISOString(),
        creator_agreement_version: MONETIZATION_COPY.agreementVersion,
      })
      .eq("user_id", userId);
    return { ok: true };
  });
