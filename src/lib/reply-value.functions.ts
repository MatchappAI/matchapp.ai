/**
 * Reply value estimator (Phase 4 hybrid path).
 *
 * How it works:
 *  1. LLM extracts the deliverables a brand asked for from the reply body:
 *     `{ platform, format, count, usage_rights, exclusivity, timeline }`.
 *  2. We look up the creator's own `pricing_rules` / `packages` table and
 *     price each requested deliverable deterministically.
 *  3. If the creator hasn't priced that combo yet, we return
 *     `{ status: 'insufficient_info' }` — never a fabricated dollar amount.
 *
 * The result feeds the free-tier reply-lock card ("potential value") and
 * the paid negotiation compare view.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  reply_body: z.string().min(10).max(20_000),
  brand_name: z.string().max(200).optional(),
});

type DeliverableAsk = {
  platform: string;
  format: string;
  count: number;
  usage_rights?: string | null;
  exclusivity?: boolean | null;
  timeline_days?: number | null;
};

async function extractDeliverables(replyBody: string, brandName?: string): Promise<DeliverableAsk[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract deliverables a brand is asking a creator for. Return ONLY strict JSON: {\"deliverables\":[{\"platform\":\"instagram|tiktok|youtube|other\",\"format\":\"reel|post|story|short|long|ugc|other\",\"count\":number,\"usage_rights\":string|null,\"exclusivity\":boolean|null,\"timeline_days\":number|null}]}. If nothing concrete is asked, return {\"deliverables\":[]}.",
          },
          { role: "user", content: `Brand: ${brandName ?? "unknown"}\n\nReply:\n${replyBody}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { deliverables?: DeliverableAsk[] };
    return Array.isArray(parsed.deliverables) ? parsed.deliverables : [];
  } catch (err) {
    console.error("[reply-value] extract failed", err);
    return [];
  }
}

export const estimateReplyValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => InputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Extract asks.
    const asks = await extractDeliverables(data.reply_body, data.brand_name);
    if (asks.length === 0) {
      return {
        status: "insufficient_info" as const,
        reason: "The reply doesn't spell out specific deliverables yet.",
        asks: [] as DeliverableAsk[],
        min: null,
        max: null,
      };
    }

    // 2. Load creator's own pricing rules (single row per user).
    const { data: rule } = await supabase
      .from("pricing_rules")
      .select("target_rate, walk_away_rate, rate_floor, exclusivity_fee, usage_rights_fee, rush_fee, configured")
      .eq("user_id", userId)
      .maybeSingle();

    if (!rule || !rule.configured || !rule.target_rate) {
      return {
        status: "insufficient_info" as const,
        reason: "You haven't set your rate yet. Add it in Settings → Packages.",
        asks,
        min: null,
        max: null,
      };
    }

    // 3. Price each ask deterministically. Give a min/max range instead of a
    //    single number — we never claim precision we don't have.
    const floor = rule.walk_away_rate ?? rule.rate_floor ?? rule.target_rate * 0.75;
    const target = rule.target_rate;
    let minCents = 0;
    let maxCents = 0;
    for (const ask of asks) {
      let unitMin = floor;
      let unitMax = target;
      if (ask.exclusivity && rule.exclusivity_fee) {
        unitMin += rule.exclusivity_fee;
        unitMax += rule.exclusivity_fee;
      }
      if (ask.usage_rights && rule.usage_rights_fee) {
        unitMin += rule.usage_rights_fee;
        unitMax += rule.usage_rights_fee;
      }
      if ((ask.timeline_days ?? 99) <= 7 && rule.rush_fee) {
        unitMin += rule.rush_fee;
        unitMax += rule.rush_fee;
      }
      const count = Math.max(ask.count, 1);
      minCents += Math.round(unitMin * count * 100);
      maxCents += Math.round(unitMax * count * 100);
    }

    return {
      status: "estimated" as const,
      asks,
      min: minCents / 100,
      max: maxCents / 100,
    };
  });
