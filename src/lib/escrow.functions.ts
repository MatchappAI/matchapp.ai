/**
 * Canonical protected-payment (a.k.a. "escrow") server functions.
 *
 * Single source of truth for:
 *  - funding link creation
 *  - dispute flagging / freeze
 *  - release calculation + Stripe transfer to the creator's Connect account
 *
 * `releaseEscrow` in matchai.functions.ts delegates here; do not add
 * duplicate release logic elsewhere.
 *
 * Flow:
 *  1. Creator has a deal + `escrow_transactions` row.
 *  2. `createEscrowFundingLink` → Stripe Checkout URL for the brand.
 *  3. `/api/public/stripe-webhook` sets status='funded' on
 *     `checkout.session.completed` (idempotent).
 *  4. `releaseProtectedPayment` fires `stripe.transfers.create` to the
 *     creator's Connect account, minus the 3 % platform fee.
 *
 * A dispute (`dispute_status != 'none'`) blocks release until resolved.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getStripe() {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY is not configured");
  const StripeMod = await import("stripe");
  const Stripe = StripeMod.default;
  return new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const createEscrowFundingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      escrow_id: z.string().uuid(),
      origin: z.string().url(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("escrow_transactions")
      .select("*")
      .eq("id", data.escrow_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !row) throw new Error("Protected payment not found");
    if (row.status === "funded" || row.status === "released") {
      throw new Error("This payment is already funded.");
    }

    const stripe = await getStripe();
    const amountCents = Math.round(Number(row.gross_amount) * 100);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        capture_method: "automatic",
        metadata: {
          escrow_id: row.id,
          deal_id: row.deal_id ?? "",
          creator_user_id: userId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: row.currency ?? "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Protected payment — ${row.brand_name ?? "MatchAI deal"}`,
              description: "Held by MatchAI until the creator marks the deliverables complete.",
            },
          },
        },
      ],
      metadata: {
        escrow_id: row.id,
        deal_id: row.deal_id ?? "",
        creator_user_id: userId,
      },
      success_url: `${data.origin}/escrow/funded?escrow=${row.id}`,
      cancel_url: `${data.origin}/escrow/cancelled?escrow=${row.id}`,
    });

    await supabaseAdmin
      .from("escrow_transactions")
      .update({
        stripe_checkout_session_id: session.id,
        funding_url: session.url ?? null,
      })
      .eq("id", row.id);

    return { url: session.url as string, escrowId: row.id };
  });

/**
 * CANONICAL release function. All UI/agent paths (dashboard, chat approvals,
 * agent tools) MUST go through this — never issue a stripe.transfers.create
 * or an escrow_transactions status='released' update anywhere else.
 *
 * Preconditions:
 *   - escrow row belongs to the caller
 *   - status = 'funded'
 *   - dispute_status = 'none'
 *   - (if funded on Stripe) creator has a completed Connect account
 */
export const releaseProtectedPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ escrow_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("escrow_transactions")
      .select("*")
      .eq("id", data.escrow_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Protected payment not found");
    if (row.status === "released") {
      return { ok: true as const, transferId: row.stripe_transfer_id ?? null, alreadyReleased: true };
    }
    if (row.status !== "funded") throw new Error("Payment is not funded yet.");
    if (row.dispute_status && row.dispute_status !== "none" && row.dispute_status !== "resolved") {
      throw new Error(
        "This payment is under dispute and cannot be released until it is resolved.",
      );
    }

    // Deliverable proof gate: if the deal has any deliverables, every one
    // must be marked approved before funds can leave escrow. Deals without
    // deliverables (small collabs, gifting) are released on the creator's
    // manual action alone.
    if (row.deal_id) {
      const { data: dlvs } = await supabaseAdmin
        .from("deliverables")
        .select("id, status")
        .eq("deal_id", row.deal_id);
      if (dlvs && dlvs.length > 0) {
        const pending = dlvs.filter((d) => d.status !== "approved" && d.status !== "posted");
        if (pending.length > 0) {
          throw new Error(
            `Approve all ${dlvs.length} deliverable${dlvs.length === 1 ? "" : "s"} before releasing (${pending.length} still pending).`,
          );
        }
      }
    }

    // Load profile to determine payout mode + Connect readiness.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded, payout_mode")
      .eq("user_id", userId)
      .maybeSingle();

    const payoutMode = (profile?.payout_mode as "auto" | "manual") ?? "manual";
    const connectReady = Boolean(
      profile?.stripe_connect_account_id && profile?.stripe_connect_onboarded,
    );

    // Only auto-mode fires an immediate bank transfer. Manual mode (default)
    // credits the internal wallet and lets the creator withdraw when ready.
    let transferId: string | null = (row.stripe_transfer_id as string | null) ?? null;
    const amountCents = Math.round(Number(row.net_payout) * 100);

    if (
      payoutMode === "auto" &&
      connectReady &&
      row.stripe_payment_intent_id &&
      !transferId
    ) {
      const stripe = await getStripe();
      try {
        const t = await stripe.transfers.create({
          amount: amountCents,
          currency: row.currency ?? "usd",
          destination: profile!.stripe_connect_account_id!,
          transfer_group: `escrow_${row.id}`,
          metadata: {
            escrow_id: row.id,
            deal_id: row.deal_id ?? "",
            creator_user_id: userId,
          },
        });
        transferId = t.id;
      } catch (err) {
        console.error("[escrow] auto transfer failed", err);
        // Don't block release — funds still land in the internal wallet
        // and the creator can request the transfer manually.
        transferId = null;
      }
    }

    const now = new Date();
    const payout = new Date(now);
    payout.setDate(payout.getDate() + 2);
    await supabaseAdmin
      .from("escrow_transactions")
      .update({
        status: "released",
        released_at: now.toISOString(),
        expected_payout_date: payout.toISOString().slice(0, 10),
        ...(transferId ? { stripe_transfer_id: transferId } : {}),
      })
      .eq("id", row.id);

    // Always credit the wallet ledger — single source of truth for balance.
    await supabaseAdmin.from("wallet_ledger").insert({
      user_id: userId,
      direction: "credit",
      amount_cents: amountCents,
      kind: "deal_release",
      escrow_id: row.id,
      description: `Released — ${row.deal_id ? "deal " + String(row.deal_id).slice(0, 8) : "payment"}`,
    });

    // If an auto transfer went out, record the corresponding debit so the
    // balance nets to zero for this deal.
    if (transferId) {
      await supabaseAdmin.from("wallet_ledger").insert({
        user_id: userId,
        direction: "debit",
        amount_cents: amountCents,
        kind: "auto_payout",
        stripe_transfer_id: transferId,
        escrow_id: row.id,
        description: "Auto-transfer to bank",
      });
    }

    if (row.deal_id) {
      await supabaseAdmin
        .from("deals")
        .update({
          escrow_status: "released",
          invoice_status: "paid",
          status: "completed",
        })
        .eq("id", row.deal_id)
        .eq("user_id", userId);
    }

    return { ok: true as const, transferId, alreadyReleased: false };

  });

/** Creator (or MatchAI on their behalf) flags a problem — freezes the release path. */
export const flagProtectedPaymentDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      escrow_id: z.string().uuid(),
      reason: z.string().min(3).max(500),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status")
      .eq("id", data.escrow_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Protected payment not found");
    if (row.status === "released") throw new Error("Payment already released.");
    await supabaseAdmin
      .from("escrow_transactions")
      .update({
        dispute_status: "flagged",
        dispute_reason: data.reason,
        disputed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true as const };
  });
