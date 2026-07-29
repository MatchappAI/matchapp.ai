/**
 * Cron-driven follow-up sender.
 *
 * Schedule: every ~15 minutes via pg_cron (see migration).
 *
 * For each `follow_up_sequences` row that is due, not sent, not cancelled:
 *   1. Skip and cancel if the parent outreach was replied to.
 *   2. Skip if the user has not approved the sequence yet (`approved=false`)
 *      AND we don't have a generated body — we never silently send blanks.
 *   3. Generate subject/body via the AI gateway if missing.
 *   4. Send through the selected creator-email transport.
 *   5. Mark the row sent and persist subject/body for the inbox view.
 *
 * No creator-email provider is selected today. Resend remains reserved for
 * MatchAI transactional/product email.
 *
 * Auth: this endpoint lives under /api/public/* which bypasses the
 * Lovable published-site auth gate, but the handler still requires the
 * Supabase publishable key in the `apikey` header (the value pg_cron sends)
 * so random internet traffic can't trigger it.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/process-follow-ups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Gated by a private cron secret stored in the DB and injected by pg_cron.
        // The previous publishable-key check was public (shipped in the browser bundle).
        const presented = request.headers.get("x-cron-secret") ?? "";
        const { data: secretRow } = await supabaseAdmin
          .from("cron_secret" as never)
          .select("secret")
          .eq("id", true)
          .maybeSingle();
        const expected = (secretRow as { secret?: string } | null)?.secret ?? "";
        if (!expected || presented.length !== expected.length || presented !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { getCreatorEmailTransport } = await import("@/lib/creator-email-transport.server");
        if (!getCreatorEmailTransport().configured) {
          return Response.json(
            {
              ok: false,
              code: "provider_not_configured",
              message: "Creator email follow-ups are paused until a delivery provider is selected.",
            },
            { status: 503 },
          );
        }

        const { sendOutreach } = await import("@/lib/outreach-sender.server");
        const { generateText } = await import("ai");
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

        const nowIso = new Date().toISOString();

        // Pull a small batch — keep each cron tick bounded.
        const { data: due, error } = await supabaseAdmin
          .from("follow_up_sequences")
          .select("id, user_id, outreach_id, sequence_number, subject, body, scheduled_at")
          .eq("sent", false)
          .eq("cancelled", false)
          .eq("approved", true)
          .lte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(25);

        if (error) {
          console.error("[cron.process-follow-ups] query failed", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{
          id: string;
          status: "sent" | "cancelled" | "skipped" | "failed";
          reason?: string;
        }> = [];

        for (const row of due ?? []) {
          try {
            if (!row.outreach_id) {
              await supabaseAdmin
                .from("follow_up_sequences")
                .update({ cancelled: true })
                .eq("id", row.id);
              results.push({ id: row.id, status: "cancelled", reason: "no outreach_id" });
              continue;
            }
            // Pull the parent outreach & creator context.
            const { data: outreach } = await supabaseAdmin
              .from("outreach_emails")
              .select(
                "id, user_id, to_email, subject, body, sent, replied, gmail_thread_id, brand_match_id",
              )
              .eq("id", row.outreach_id)
              .maybeSingle();

            if (!outreach || !outreach.sent || !outreach.to_email) {
              await supabaseAdmin
                .from("follow_up_sequences")
                .update({ cancelled: true })
                .eq("id", row.id);
              results.push({ id: row.id, status: "cancelled", reason: "parent not sent" });
              continue;
            }

            if (outreach.replied) {
              await supabaseAdmin
                .from("follow_up_sequences")
                .update({ cancelled: true })
                .eq("id", row.id);
              results.push({ id: row.id, status: "cancelled", reason: "brand replied" });
              continue;
            }

            // Lazily generate subject/body if we never drafted one.
            let subject = row.subject;
            let body = row.body;
            if (!subject || !body) {
              const { data: brand } = outreach.brand_match_id
                ? await supabaseAdmin
                    .from("brand_matches")
                    .select("brand_name, brand_industry")
                    .eq("id", outreach.brand_match_id)
                    .maybeSingle()
                : { data: null };
              const { data: profile } = await supabaseAdmin
                .from("creator_profiles")
                .select("full_name, handle, primary_platform")
                .eq("user_id", row.user_id)
                .maybeSingle();

              const key = process.env.LOVABLE_API_KEY;
              if (!key) throw new Error("LOVABLE_API_KEY missing");
              const gateway = createLovableAiGatewayProvider(key);
              const model = gateway("google/gemini-3-flash-preview");

              const sequenceContext: Record<number, string> = {
                1: "Gentle nudge — a couple of days after the first email. Reference the original ask, keep it under 80 words, end with a soft question.",
                2: "Add value — about a week in. Reference one fresh idea, stat, or angle that wasn't in the first email. Under 90 words.",
                3: "Friendly bump — ~2 weeks in. Acknowledge timing, share a quick update or new hook, keep it warm and specific. Under 80 words.",
              };
              const genericStrategy = `Ongoing warm follow-up #${row.sequence_number} — the thread has gone quiet for a while. Assume the contact is busy, not uninterested. Open differently than any earlier email, share one genuinely new angle (a recent post, a launch, a seasonal moment, a small idea), keep it under 80 words, and leave the door wide open. Never guilt-trip, never say "just bumping this," never imply this is the last time you'll reach out.`;

              const prompt = `Write follow-up #${row.sequence_number} to a brand contact who hasn't replied.

Original subject: ${outreach.subject ?? "(unknown)"}
Original body:
${outreach.body ?? "(unknown)"}

Brand: ${brand?.brand_name ?? "the brand"} (${brand?.brand_industry ?? "general"})
Creator: ${profile?.full_name ?? "the creator"} (@${profile?.handle ?? ""}, ${profile?.primary_platform ?? ""})

Strategy: ${sequenceContext[row.sequence_number] ?? genericStrategy}

Return ONLY a JSON object like:
{"subject":"...","body":"..."}
Subject should reference the original thread (e.g. "Re:" or "Following up on …"). Body should be plain text, no markdown, no signature placeholders.`;

              const ai = await generateText({ model, prompt });
              const text = ai.text.trim();
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error("AI returned no JSON");
              const parsed = JSON.parse(jsonMatch[0]) as {
                subject?: string;
                body?: string;
              };
              subject = (parsed.subject ?? `Re: ${outreach.subject ?? ""}`).slice(0, 300);
              body = (parsed.body ?? "").slice(0, 8000);

              await supabaseAdmin
                .from("follow_up_sequences")
                .update({ subject, body })
                .eq("id", row.id);
            }

            const send = await sendOutreach({
              userId: row.user_id,
              to: outreach.to_email,
              subject: subject!,
              body: body!,
              threadId: outreach.gmail_thread_id ?? undefined,
            });

            if (!send.ok) {
              console.error("[cron.process-follow-ups] send failed", row.id, send.error);
              results.push({ id: row.id, status: "failed", reason: send.error });
              continue;
            }

            await supabaseAdmin
              .from("follow_up_sequences")
              .update({ sent: true, sent_at: new Date().toISOString() })
              .eq("id", row.id);

            results.push({ id: row.id, status: "sent" });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[cron.process-follow-ups] row failed", row.id, msg);
            results.push({ id: row.id, status: "failed", reason: msg });
          }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
