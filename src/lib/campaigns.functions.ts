/**
 * Pre-approved outreach campaigns.
 *
 * A campaign is a bounded rule set the creator sets once — brand list,
 * daily send cap, follow-up count, stop rules — and the agent then sends
 * within that envelope without a per-send approval. We still block sends
 * that would exceed the daily cap and still stop on reply / bounce /
 * unsubscribe when those rules are on.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("outreach_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { campaigns: data ?? [] };
  });

const BriefSchema = z
  .object({
    objective: z.string().max(500).optional().default(""),
    target_audience: z.string().max(500).optional().default(""),
    key_talking_points: z.string().max(1000).optional().default(""),
    deliverables: z.string().max(500).optional().default(""),
    kpis: z.string().max(500).optional().default(""),
    budget_min_cents: z.number().int().min(0).nullable().optional(),
    budget_max_cents: z.number().int().min(0).nullable().optional(),
    brand_voice_notes: z.string().max(500).optional().default(""),
  })
  .default({});

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  mode: z.enum(["manual", "approve_each", "pre_approved"]),
  brand_match_ids: z.array(z.string().uuid()).default([]),
  daily_send_cap: z.number().int().min(0),
  follow_up_count: z.number().int().min(0),

  min_deal_value_cents: z.number().int().min(0).default(0),
  max_deal_value_cents: z.number().int().min(0).nullable().optional(),
  allow_package_offers: z.boolean().default(true),
  stop_on_reply: z.boolean().default(true),
  stop_on_bounce: z.boolean().default(true),
  stop_on_unsubscribe: z.boolean().default(true),
  active: z.boolean().default(true),
  brief: BriefSchema,
});


export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = { ...data, user_id: userId };
    if (data.id) {
      const { error } = await supabase
        .from("outreach_campaigns")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await supabase
      .from("outreach_campaigns")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const toggleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("outreach_campaigns")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("outreach_campaigns")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Server-side gate reused by the outreach send flow.
 * Returns the active pre-approved campaign for a brand (if any), plus
 * whether the daily cap has room. Callers use this to decide whether to
 * bypass per-send approval and to block over-cap sends.
 */
export async function getCampaignSendPermission(params: {
  userId: string;
  brandMatchId: string | null;
}): Promise<
  | { hasCampaign: false }
  | {
      hasCampaign: true;
      campaignId: string;
      allowed: boolean;
      reason?: string;
      dailyCap: number;
      sentToday: number;
    }
> {
  if (!params.brandMatchId) return { hasCampaign: false };
  const { data: c } = await supabaseAdmin
    .from("outreach_campaigns")
    .select("id,daily_send_cap,mode,active,brand_match_ids")
    .eq("user_id", params.userId)
    .eq("mode", "pre_approved")
    .eq("active", true)
    .contains("brand_match_ids", [params.brandMatchId])
    .maybeSingle();
  if (!c) return { hasCampaign: false };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("outreach_emails")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .not("sent_at", "is", null)
    .gte("sent_at", startOfDay.toISOString());
  const sentToday = count ?? 0;
  const allowed = sentToday < c.daily_send_cap;
  return {
    hasCampaign: true,
    campaignId: c.id,
    allowed,
    reason: allowed
      ? undefined
      : `Daily cap of ${c.daily_send_cap} reached for this campaign.`,
    dailyCap: c.daily_send_cap,
    sentToday,
  };
}

/**
 * Returns the active campaign brief (if any) covering the given brand match,
 * so outreach drafting can incorporate the creator's stated objective,
 * audience, deliverables, and budget.
 */
export async function getCampaignBriefForBrand(params: {
  userId: string;
  brandMatchId: string | null;
}): Promise<null | {
  campaignId: string;
  name: string;
  brief: Record<string, unknown>;
}> {
  if (!params.brandMatchId) return null;
  const { data } = await supabaseAdmin
    .from("outreach_campaigns")
    .select("id,name,brief,active")
    .eq("user_id", params.userId)
    .eq("active", true)
    .contains("brand_match_ids", [params.brandMatchId])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { campaignId: data.id, name: data.name, brief: (data.brief as Record<string, unknown>) ?? {} };
}

