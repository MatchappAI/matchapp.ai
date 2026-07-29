/**
 * MatchAI internal wallet.
 *
 * Every released deal payment credits the creator's wallet_ledger.
 * Payouts to the creator's bank (Stripe Connect) are recorded as debits.
 * Balance = SUM(credit) - SUM(debit).
 *
 * Payout modes:
 *  - 'manual' (default): funds sit in the MatchAI balance; creator taps
 *    "Transfer to bank" when they want it.
 *  - 'auto': release also fires an immediate transfer to the connected bank.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ledgerRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("wallet_ledger")
        .select("id, direction, amount_cents, kind, escrow_id, stripe_transfer_id, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("profiles")
        .select("payout_mode, stripe_connect_account_id, stripe_connect_onboarded")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const entries = ledgerRes.data ?? [];
    let credits = 0;
    let debits = 0;
    for (const e of entries) {
      const amt = Number(e.amount_cents) || 0;
      if (e.direction === "credit") credits += amt;
      else debits += amt;
    }

    // Pending = funded escrow that hasn't been released yet
    const { data: pendingRows } = await supabaseAdmin
      .from("escrow_transactions")
      .select("net_payout")
      .eq("user_id", userId)
      .eq("status", "funded");
    const pending_cents = (pendingRows ?? []).reduce(
      (sum, r) => sum + Math.round(Number(r.net_payout) * 100),
      0,
    );

    return {
      balance_cents: credits - debits,
      lifetime_earned_cents: credits,
      lifetime_paid_out_cents: debits,
      pending_cents,
      payout_mode: (profileRes.data?.payout_mode as "auto" | "manual") ?? "manual",
      connect_ready: Boolean(
        profileRes.data?.stripe_connect_account_id && profileRes.data?.stripe_connect_onboarded,
      ),
      entries,
    };
  });

export const setPayoutMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ mode: z.enum(["auto", "manual"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ payout_mode: data.mode })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, mode: data.mode };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ amount_cents: z.number().int().positive().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_onboarded) {
      throw new Error("Connect a bank account first (Settings → Payouts).");
    }

    const { data: entries } = await supabaseAdmin
      .from("wallet_ledger")
      .select("direction, amount_cents")
      .eq("user_id", userId);
    let balance = 0;
    for (const e of entries ?? []) {
      const amt = Number(e.amount_cents) || 0;
      balance += e.direction === "credit" ? amt : -amt;
    }
    if (balance <= 0) throw new Error("Your balance is $0.");

    const amount = data.amount_cents ?? balance;
    if (amount > balance) throw new Error("Amount exceeds available balance.");

    const key = process.env.STRIPE_API_KEY;
    if (!key) throw new Error("Payouts are not configured yet.");
    const StripeMod = await import("stripe");
    const Stripe = StripeMod.default;
    const stripe = new Stripe(key, {
      apiVersion: "2026-05-27.dahlia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let transferId: string;
    const attemptInsert = async (status: "succeeded" | "failed", err?: string, tid?: string) => {
      await supabaseAdmin.from("payout_attempts").insert({
        user_id: userId,
        amount_cents: amount,
        status,
        stripe_transfer_id: tid ?? null,
        error: err ?? null,
      });
    };
    try {
      const t = await stripe.transfers.create({
        amount,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: { creator_user_id: userId, source: "wallet_manual_payout" },
      });
      transferId = t.id;
    } catch (err) {
      console.error("[wallet] transfer failed", err);
      const msg = err instanceof Error ? err.message : "unknown";
      await attemptInsert("failed", msg);
      throw new Error("Bank transfer failed. Try again in a moment.");
    }

    await attemptInsert("succeeded", undefined, transferId);
    await supabaseAdmin.from("wallet_ledger").insert({
      user_id: userId,
      direction: "debit",
      amount_cents: amount,
      kind: "manual_payout",
      stripe_transfer_id: transferId,
      description: "Transfer to bank account",
    });

    return { ok: true as const, transferId, amount_cents: amount };
  });

export const listPayoutAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payout_attempts")
      .select("id, amount_cents, status, stripe_transfer_id, error, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    return { attempts: data ?? [] };
  });
