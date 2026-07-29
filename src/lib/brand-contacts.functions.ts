import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";

/**
 * Stage 4 — Brand contact auto-fill (pattern-guess + AI guidance).
 *
 * We have no Hunter/Apollo keys yet. So we ask Gemini for:
 *   - the brand's most likely root domain (e.g. "nike.com")
 *   - the team most likely to handle creator/influencer partnerships
 *   - a department fallback email (partnerships@, influencers@, marketing@, hello@…)
 *   - up to 2 alternate department emails
 *
 * We persist the best candidate to `brand_contacts` with confidence="low" or
 * "medium" + source="department" | "ai_guess". The approval card then prefills
 * "Send to" with this email so the human can confirm before sending.
 *
 * When the user later adds HUNTER_API_KEY / APOLLO_API_KEY we extend this with
 * a cascade in the same function; the table + UI stay the same.
 */

const DiscoverySchema = z.object({
  domain: z.string().nullable(),
  contact_name: z.string().nullable().optional(),
  contact_title: z.string().nullable().optional(),
  primary_email: z.string().nullable(),
  alternate_emails: z.array(z.string()).max(3).optional().default([]),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
  source: z.enum(["department", "ai_guess", "pattern"]).default("department"),
  notes: z.string().nullable().optional(),
});

function sanitizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

async function discoverViaAi(args: {
  brand_name: string;
  industry: string | null;
  market_type: string | null;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) return null;

  const system = `You help a creator find the best contact email at a brand for a partnership pitch.
Return ONLY a JSON object (no prose, no code fences) with this exact shape:
{
  "domain": string | null,                // root domain only, e.g. "nike.com"
  "contact_name": string | null,          // only if you are confident the head of influencer/creator partnerships is publicly known
  "contact_title": string | null,         // matching title
  "primary_email": string | null,         // best department email at the domain (e.g. partnerships@nike.com)
  "alternate_emails": string[],           // up to 2 other reasonable departments at the same domain
  "confidence": "low" | "medium" | "high",
  "source": "department" | "ai_guess" | "pattern",
  "notes": string | null
}
Rules:
- Prefer departments that handle creators: partnerships@, influencers@, creators@, marketing@, pr@, brand@, hello@.
- Never fabricate a personal email. Only use contact_name/title if widely public.
- If you can't determine the domain, set domain and primary_email to null.
- confidence "high" only when you used a known public department address; otherwise "low" or "medium".`;

  const prompt = `Brand: ${args.brand_name}
Industry: ${args.industry ?? "unknown"}
Market: ${args.market_type ?? "unknown"}`;

  try {
    const gateway = createLovableAiGatewayProvider(lovableKey);
    const model = gateway("google/gemini-2.5-flash");
    const { text } = await generateText({ model, system, prompt });
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = DiscoverySchema.parse(JSON.parse(cleaned));
    return parsed;
  } catch (e) {
    console.error("[brand-contacts] ai discovery failed", e);
    return null;
  }
}

function patternFallback(domain: string | null) {
  if (!domain) return null;
  return {
    domain,
    contact_name: null,
    contact_title: null,
    primary_email: `partnerships@${domain}`,
    alternate_emails: [`marketing@${domain}`, `hello@${domain}`],
    confidence: "low" as const,
    source: "pattern" as const,
    notes: "Pattern guess — verify before sending.",
  };
}

/** Hunter.io domain-search cascade. Returns the best contact at a brand domain. */
async function discoverViaHunter(args: {
  brand_name: string;
  domain_hint?: string | null;
}): Promise<z.infer<typeof DiscoverySchema> | null> {
  if (process.env.LEAD_PROVIDER !== "hunter") return null;
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
  try {
    type HunterEmail = {
      value: string;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
      seniority?: string | null;
      department?: string | null;
      confidence?: number | null;
      type?: string | null;
    };
    type HunterResp = { data?: { domain?: string; emails?: HunterEmail[] } };

    async function fetchHunter(extra: Record<string, string>): Promise<HunterResp | null> {
      const params = new URLSearchParams({ api_key: key as string, limit: "25", ...extra });
      if (args.domain_hint) params.set("domain", args.domain_hint);
      else params.set("company", args.brand_name);
      const res = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
      if (!res.ok) {
        console.error(
          "[hunter] domain-search failed",
          res.status,
          await res.text().catch(() => ""),
        );
        return null;
      }
      return (await res.json()) as HunterResp;
    }

    // 1) Ask Hunter explicitly for executives first.
    const execResp = await fetchHunter({ seniority: "executive" });
    const fallbackResp =
      (execResp?.data?.emails?.length ?? 0) > 0 ? execResp : await fetchHunter({});
    const j = fallbackResp;
    const domain = j?.data?.domain ?? args.domain_hint ?? null;
    const emails = j?.data?.emails ?? [];
    if (!domain || emails.length === 0) return null;

    // C-suite / founder titles — highest priority per user spec.
    const C_SUITE =
      /\b(ceo|cfo|coo|cmo|cto|cpo|cro|cso|chief\s+\w+\s+officer|founder|co[-\s]?founder|owner|president|vp|vice\s+president|head\s+of)\b/i;
    const PARTNER_ROLE = /partnership|influencer|creator|brand|pr\b|press|marketing|communication/i;

    const score = (e: HunterEmail) => {
      let s = 0;
      const title = `${e.position ?? ""} ${e.seniority ?? ""} ${e.department ?? ""}`;
      if (C_SUITE.test(title)) s += 100;
      if (e.seniority === "executive") s += 60;
      if (PARTNER_ROLE.test(title)) s += 20;
      if (e.type === "personal") s += 10;
      s += (e.confidence ?? 0) / 10;
      return s;
    };

    const ranked = [...emails].sort((a, b) => score(b) - score(a));
    const top = ranked[0];
    const alts = ranked.slice(1, 3).map((e) => e.value);
    const isCSuite = C_SUITE.test(`${top.position ?? ""} ${top.seniority ?? ""}`);
    const conf =
      isCSuite || (top.confidence ?? 0) >= 80
        ? "high"
        : (top.confidence ?? 0) >= 50
          ? "medium"
          : "low";
    const name = [top.first_name, top.last_name].filter(Boolean).join(" ").trim() || null;
    return {
      domain,
      contact_name: name,
      contact_title: top.position ?? null,
      primary_email: top.value,
      alternate_emails: alts,
      confidence: conf,
      source: "department",
      notes: `Hunter.io${isCSuite ? " · C-suite" : ""} · score ${top.confidence ?? "?"}`,
    };
  } catch (e) {
    console.error("[hunter] error", e);
    return null;
  }
}

/** Fire-and-forget discovery. Called from generateBrandMatches in the background. */
export async function backgroundDiscoverContacts(
  userId: string,
  brandMatches: Array<{
    id: string;
    brand_name: string;
    brand_industry: string | null;
    market_type: string | null;
  }>,
) {
  if (process.env.LEAD_PROVIDER !== "hunter") {
    return {
      ok: false as const,
      code: "provider_not_configured" as const,
    };
  }
  // Sequential to stay in rate budget. Capped to 10.
  for (const bm of brandMatches.slice(0, 10)) {
    try {
      // 1) AI gives us the likely root domain (+ a starter candidate).
      const ai = await discoverViaAi({
        brand_name: bm.brand_name,
        industry: bm.brand_industry,
        market_type: bm.market_type,
      });
      // 2) Hunter.io cascade — uses the AI-suggested domain when present.
      const hunter = await discoverViaHunter({
        brand_name: bm.brand_name,
        domain_hint: ai?.domain ?? null,
      });
      const candidate =
        (hunter && sanitizeEmail(hunter.primary_email) ? hunter : null) ??
        (ai && sanitizeEmail(ai.primary_email) ? ai : null) ??
        patternFallback(ai?.domain ?? null);
      if (!candidate || !sanitizeEmail(candidate.primary_email)) continue;

      const alts = (candidate.alternate_emails ?? [])
        .map(sanitizeEmail)
        .filter((e): e is string => Boolean(e));

      await supabaseAdmin.from("brand_contacts").insert({
        user_id: userId,
        brand_match_id: bm.id,
        contact_name: candidate.contact_name ?? null,
        contact_title: candidate.contact_title ?? null,
        email: sanitizeEmail(candidate.primary_email)!,
        domain: candidate.domain ?? null,
        source: candidate.source,
        confidence: candidate.confidence,
        alternate_emails: alts,
        notes: candidate.notes ?? null,
      });
    } catch (e) {
      console.error("[brand-contacts] insert failed", e);
    }
  }
}

/* ---------------- Public server fns ---------------- */

export const listBrandContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ brand_match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("brand_contacts")
      .select("*")
      .eq("brand_match_id", data.brand_match_id)
      .order("created_at", { ascending: true });
    return { contacts: rows ?? [] };
  });

/** Manual re-run for a single brand match (used by approval card "Find contact"). */
export const findContactForBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ brand_match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (process.env.LEAD_PROVIDER !== "hunter") {
      return {
        ok: false as const,
        code: "provider_not_configured" as const,
        error: "No contact provider is configured. Enter the contact manually or import a CSV.",
      };
    }
    const { data: bm } = await supabaseAdmin
      .from("brand_matches")
      .select("id,brand_name,brand_industry,market_type,user_id")
      .eq("id", data.brand_match_id)
      .maybeSingle();
    if (!bm || bm.user_id !== userId) {
      return { ok: false as const, error: "Brand not found" };
    }
    await backgroundDiscoverContacts(userId, [
      {
        id: bm.id,
        brand_name: bm.brand_name,
        brand_industry: bm.brand_industry,
        market_type: bm.market_type,
      },
    ]);
    const { data: rows } = await supabaseAdmin
      .from("brand_contacts")
      .select("*")
      .eq("brand_match_id", bm.id)
      .order("created_at", { ascending: false })
      .limit(1);
    return { ok: true as const, contact: rows?.[0] ?? null };
  });

/** Best contact lookup used when drafting outreach. */
export async function getBestContactEmail(brandMatchId: string): Promise<{
  email: string | null;
  name: string | null;
  title: string | null;
  source: string | null;
  confidence: string | null;
}> {
  const { data } = await supabaseAdmin
    .from("brand_contacts")
    .select("email,contact_name,contact_title,source,confidence")
    .eq("brand_match_id", brandMatchId)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);
  const row = data?.[0];
  if (!row) return { email: null, name: null, title: null, source: null, confidence: null };
  return {
    email: row.email ?? null,
    name: row.contact_name ?? null,
    title: row.contact_title ?? null,
    source: row.source ?? null,
    confidence: row.confidence ?? null,
  };
}
