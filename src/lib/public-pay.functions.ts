/**
 * Public (unauthenticated) server functions powering the branded
 * /pay/$id funding page that brands land on.
 *
 * Reads are intentionally narrow (brand name, creator display, amount) so
 * that a leaked escrow id only reveals payment context the brand already
 * knows. Writes create a Stripe Checkout Session bound to the escrow id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const getPublicEscrowSummary = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ escrow_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("escrow_transactions")
      .select(
        "id, brand_name, gross_amount, currency, status, user_id, deal_id",
      )
      .eq("id", data.escrow_id)
      .maybeSingle();
    if (!row) return null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_id", row.user_id)
      .maybeSingle();

    return {
      id: row.id,
      brandName: row.brand_name ?? null,
      creatorName: profile?.display_name || profile?.full_name || "the creator",
      amountCents: Math.round(Number(row.gross_amount) * 100),
      currency: (row.currency ?? "usd") as string,
      status: row.status as string,
    };
  });

export const startPublicEscrowCheckout = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      escrow_id: z.string().uuid(),
      origin: z.string().url(),
      terms_accepted: z.literal(true),
      brand_email: z.string().email().max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("escrow_transactions")
      .select("*")
      .eq("id", data.escrow_id)
      .maybeSingle();
    if (!row) throw new Error("Payment link not found");
    if (row.status === "funded" || row.status === "released") {
      throw new Error("This payment has already been funded.");
    }

    const stripe = await getStripe();
    const amountCents = Math.round(Number(row.gross_amount) * 100);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.brand_email,
      payment_intent_data: {
        capture_method: "automatic",
        metadata: {
          escrow_id: row.id,
          deal_id: row.deal_id ?? "",
          creator_user_id: row.user_id,
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
              description:
                "Held by MatchAI until the creator delivers. Released on approval, refunded on dispute.",
            },
          },
        },
      ],
      metadata: {
        escrow_id: row.id,
        deal_id: row.deal_id ?? "",
        creator_user_id: row.user_id,
      },
      success_url: `${data.origin}/pay/${row.id}?status=funded`,
      cancel_url: `${data.origin}/pay/${row.id}?status=cancelled`,
    });

    await supabaseAdmin
      .from("escrow_transactions")
      .update({
        stripe_checkout_session_id: session.id,
        funding_url: session.url ?? null,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_email: data.brand_email,
      })
      .eq("id", row.id);

    return { url: session.url as string };
  });
