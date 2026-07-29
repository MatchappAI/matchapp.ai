/**
 * User-triggered dispute flag on a deal's protected payment.
 * Sets escrow_transactions.dispute_status = 'flagged' so release is blocked
 * until admin intervention. The Stripe webhook can also set this on
 * `charge.dispute.*` events; this fn is the human counterpart.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  reason: z.string().min(4).max(2000),
});

export const flagDealDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => InputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm the deal belongs to this user before touching escrow.
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id,user_id,brand_name")
      .eq("id", data.deal_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");

    const { data: tx } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id,dispute_status")
      .eq("deal_id", data.deal_id)
      .maybeSingle();
    if (!tx) {
      // No escrow yet — record a soft flag on the deal notes only.
      await supabaseAdmin
        .from("deals")
        .update({ status: "disputed" })
        .eq("id", data.deal_id);
      return { ok: true as const, escrow: false };
    }

    await supabaseAdmin
      .from("escrow_transactions")
      .update({
        dispute_status: "flagged",
        dispute_reason: data.reason,
        disputed_at: new Date().toISOString(),
      })
      .eq("id", tx.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "dispute_flagged",
      title: "Payment on hold",
      description: `You flagged an issue on ${deal.brand_name}. Release is paused until it's reviewed.`,
    });

    return { ok: true as const, escrow: true };
  });
