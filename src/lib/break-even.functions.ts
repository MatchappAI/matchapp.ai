/**
 * Break-even nudge — computes whether a Free-tier creator is paying more
 * in success fees this month than a paid plan would cost, and returns a
 * friendly message MatchAI can surface in chat or in the wallet.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeBreakEvenSuggestion, type BreakEvenSuggestion } from "@/lib/pricing-config";

export const getBreakEvenNudge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BreakEvenSuggestion> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    // Sum success fees charged this calendar month.
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const { data: rows } = await supabase
      .from("escrow_transactions")
      .select("success_fee_amount, platform_fee, created_at, commission_status")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString());

    const monthly = (rows ?? []).reduce((acc, r: any) => {
      if (r.commission_status !== "charged" && r.commission_status !== "pending") return acc;
      const fee = Number(r.success_fee_amount ?? r.platform_fee ?? 0);
      return acc + (Number.isFinite(fee) ? fee : 0);
    }, 0);

    return computeBreakEvenSuggestion({
      currentPlan: prof?.plan ?? "free",
      monthlyCommissionUsd: monthly,
    });
  });
