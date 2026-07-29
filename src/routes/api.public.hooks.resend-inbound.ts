/**
 * Resend inbound webhook — receives brand replies to MatchAI-sent outreach,
 * matches by tracking_id, stores the reply, runs qualification, and flips
 * the pricing gate when a qualifying paid reply lands.
 *
 * Security: verifies Svix signature headers when RESEND_WEBHOOK_SECRET is set.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const REPLY_CLASSIFICATIONS = [
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
type Cls = (typeof REPLY_CLASSIFICATIONS)[number];
const QUALIFYING: Cls[] = ["qualified_paid_interest", "negotiation_started", "request_for_rates"];

function ruleBased(body: string): { cls: Cls; conf: number } | null {
  const t = body.toLowerCase();
  if (/\bunsubscribe\b|opt[- ]out|remove me/.test(t)) return { cls: "unsubscribe", conf: 0.95 };
  if (/out of office|auto[- ]?reply|automatic reply|vacation/.test(t)) return { cls: "auto_reply", conf: 0.9 };
  if (/not interested|no thanks|not a fit|pass on this/.test(t)) return { cls: "rejection", conf: 0.85 };
  if (/gift(ed)? (only|product)|complimentary product/.test(t) && !/paid|budget|\$/.test(t))
    return { cls: "gifted_only", conf: 0.8 };
  if (/affiliate|commission[- ]only/.test(t) && !/paid|budget|flat fee|\$/.test(t))
    return { cls: "affiliate_only", conf: 0.8 };
  return null;
}

async function llmClassify(body: string, brand?: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { cls: "unclear" as Cls, conf: 0, reason: "no-key" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: `Classify a brand reply. Return strict JSON {"classification":"...","confidence":0..1,"reason":"..."}. classification must be one of: ${REPLY_CLASSIFICATIONS.join(", ")}.`,
          },
          { role: "user", content: `Brand: ${brand ?? "unknown"}\n\n${body}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { cls: "unclear" as Cls, conf: 0, reason: `ai-${res.status}` };
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const p = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    const cls = (REPLY_CLASSIFICATIONS as readonly string[]).includes(p.classification)
      ? (p.classification as Cls)
      : ("unclear" as Cls);
    return { cls, conf: Math.max(0, Math.min(1, Number(p.confidence) || 0)), reason: String(p.reason ?? "") };
  } catch (e) {
    return { cls: "unclear" as Cls, conf: 0, reason: "ai-fail" };
  }
}

export const Route = createFileRoute("/api/public/hooks/resend-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (secret) {
          const sig = request.headers.get("svix-signature") ?? "";
          const id = request.headers.get("svix-id") ?? "";
          const ts = request.headers.get("svix-timestamp") ?? "";
          const signed = `${id}.${ts}.${raw}`;
          const expected = createHmac("sha256", secret).update(signed).digest("base64");
          const provided = sig.split(" ").map((p) => p.split(",")[1]).filter(Boolean);
          const ok = provided.some((p) => {
            try { return timingSafeEqual(Buffer.from(p), Buffer.from(expected)); } catch { return false; }
          });
          if (!ok) return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        // Support Resend inbound shape + generic {tracking_id, body, from} shape.
        const data = payload.data ?? payload;
        const body: string = data.text ?? data.body ?? data.html ?? "";
        const from: string = data.from?.email ?? data.from ?? "";
        const trackingId: string | undefined =
          data.tracking_id ??
          data.headers?.["x-matchai-tracking-id"] ??
          data.custom_headers?.["x-matchai-tracking-id"];
        const inReplyTo: string | undefined = data.in_reply_to ?? data.headers?.["in-reply-to"];

        if (!body) return Response.json({ ok: true, matched: false, reason: "empty" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Match outreach row.
        let q = supabaseAdmin.from("outreach_emails").select("id, user_id, brand_match_id, to_email, subject");
        if (trackingId) q = q.eq("tracking_id", trackingId);
        else if (inReplyTo) q = q.eq("provider_message_id", inReplyTo);
        else q = q.eq("to_email", from);
        const { data: outreach } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!outreach) return Response.json({ ok: true, matched: false });

        // Classify.
        const rb = ruleBased(body);
        const cls = rb ?? (await llmClassify(body, outreach.subject));
        const classification: Cls = cls.cls;
        const conf = "conf" in cls ? cls.conf : 0;
        const reason = "reason" in cls ? cls.reason : "rule-based";

        await supabaseAdmin
          .from("outreach_emails")
          .update({
            replied: true,
            brand_reply_text: body,
            reply_classification: classification,
            reply_classified_at: new Date().toISOString(),
            qualification_confidence: conf,
            qualification_reason: String(reason ?? ""),
          })
          .eq("id", outreach.id);

        // Gate flip (idempotent).
        const qualifying = QUALIFYING.includes(classification) && conf >= 0.7;
        let gated = false;
        if (qualifying) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("free_access_status, qualified_reply_received_at")
            .eq("user_id", outreach.user_id)
            .maybeSingle();
          if (prof?.free_access_status === "unrestricted") {
            await supabaseAdmin
              .from("profiles")
              .update({
                free_access_status: "pricing_decision_required",
                qualified_reply_received_at: prof.qualified_reply_received_at ?? new Date().toISOString(),
              })
              .eq("user_id", outreach.user_id);
            gated = true;
          }
          await supabaseAdmin.from("agent_activity").insert({
            user_id: outreach.user_id,
            activity_type: "brand_replied",
            title: "Qualified brand reply — choose how to proceed",
            description: "A brand is interested in a paid collaboration. Pick Stay Free (20% only if it closes) or a paid plan (0% fee).",
            related_id: outreach.id,
            action_label: "Open opportunity",
            action_route: "/dashboard/approvals",
          });
        }

        return Response.json({ ok: true, matched: true, classification, confidence: conf, gated });
      },
    },
  },
});
