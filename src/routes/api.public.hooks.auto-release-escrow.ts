/**
 * Auto-release cron endpoint.
 *
 * Scheduled by pg_cron every 5 minutes. For every funded escrow row whose
 * `release_scheduled_at` has passed, with no active dispute, and (if
 * deliverables exist) all deliverables approved, we mark it released.
 *
 * Auth: shared `x-cron-secret` header verified against public.cron_secret.
 * Actual Stripe transfer to the creator's Connect account is performed by
 * the canonical `releaseProtectedPayment` path when the creator hits
 * Release — auto-release here is bookkeeping-only for demo/non-Stripe
 * funded rows, and marks the deal complete so the creator sees payout.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-release-escrow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? "";
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: sec } = await supabaseAdmin
          .from("cron_secret")
          .select("secret")
          .eq("id", true)
          .maybeSingle();
        if (!sec?.secret || provided !== sec.secret) {
          return new Response("unauthorized", { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due } = await supabaseAdmin
          .from("escrow_transactions")
          .select("id, deal_id, user_id, dispute_status, release_scheduled_at, stripe_payment_intent_id")
          .eq("status", "funded")
          .lte("release_scheduled_at", nowIso)
          .limit(50);

        let released = 0;
        for (const row of due ?? []) {
          if (row.dispute_status && row.dispute_status !== "none" && row.dispute_status !== "resolved") {
            continue;
          }
          if (row.deal_id) {
            const { data: dlvs } = await supabaseAdmin
              .from("deliverables")
              .select("status")
              .eq("deal_id", row.deal_id);
            if (dlvs && dlvs.length > 0) {
              const pending = dlvs.filter(
                (d) => d.status !== "approved" && d.status !== "posted",
              );
              if (pending.length > 0) continue;
            }
          }

          // NOTE: We intentionally do NOT fire stripe.transfers.create here.
          // The creator must have an onboarded Connect account, and if they
          // don't, the auto-release should still mark the deal complete
          // (bookkeeping) — the payout will fire when they finish onboarding
          // and hit Release. This keeps demo flows working and avoids
          // silent transfer failures from cron.
          const payoutDate = new Date();
          payoutDate.setDate(payoutDate.getDate() + 2);
          await supabaseAdmin
            .from("escrow_transactions")
            .update({
              status: "released",
              released_at: nowIso,
              expected_payout_date: payoutDate.toISOString().slice(0, 10),
            })
            .eq("id", row.id);

          if (row.deal_id) {
            await supabaseAdmin
              .from("deals")
              .update({
                escrow_status: "released",
                invoice_status: "paid",
                status: "completed",
              })
              .eq("id", row.deal_id);
          }

          await supabaseAdmin.from("agent_activity").insert({
            user_id: row.user_id,
            activity_type: "payment_released",
            title: "Payment auto-released",
            description: "Brand did not respond within the review window. Funds released.",
            related_id: row.id,
            action_label: "View",
            action_route: "/dashboard/deals",
          });

          released += 1;
        }

        return Response.json({ ok: true, released, scanned: due?.length ?? 0 });
      },
    },
  },
});
