import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBestContactEmail } from "@/lib/brand-contacts.functions";
import { indexBrandDiscoveryRecord } from "@/lib/discovery-engine.functions";

type Row = Record<string, string | null | undefined>;

const db = supabaseAdmin as typeof supabaseAdmin;

const KindSchema = z.enum([
  "brand",
  "creator",
  "contact",
  "buying_intent_signal",
  "brand_opportunity",
  "campaign_brief",
  "product_drop",
  "outreach_target",
]);

const PreviewSchema = z.object({
  kind: KindSchema,
  sourceLabel: z.enum(["manual", "csv"]).default("csv"),
  rows: z.array(z.record(z.string(), z.unknown())).max(2000),
});

const ImportSchema = PreviewSchema.extend({
  dryRun: z.boolean().default(false),
});

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeKey(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join("|");
}

function splitList(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(/[\n,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function csvConfidence(row: Row, required: string[]): "low" | "medium" | "high" {
  const present = required.filter((key) => Boolean(normalizeText(row[key])));
  if (present.length === required.length) return "high";
  if (present.length >= Math.ceil(required.length / 2)) return "medium";
  return "low";
}

async function existingKeys(table: string, userId: string, column: string): Promise<Set<string>> {
  const { data } = await db.from(table).select(column).eq("user_id", userId).limit(5000);
  return new Set(
    (data ?? []).map((row) =>
      normalizeText((row as Record<string, unknown>)[column] as string | null),
    ),
  );
}

async function lookupBrandMatch(userId: string, brandName: string | null | undefined) {
  const normalized = normalizeText(brandName);
  if (!normalized) return null;
  const { data } = await db
    .from("brand_matches")
    .select("*")
    .eq("user_id", userId)
    .ilike("brand_name", brandName!.trim())
    .maybeSingle();
  if (data) return data as Record<string, unknown>;
  const { data: fallback } = await db
    .from("brand_matches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((fallback ?? []).find(
    (row) =>
      normalizeText((row as Record<string, unknown>).brand_name as string | null) === normalized,
  ) ?? null) as Record<string, unknown> | null;
}

function parseIntOrNull(value: string | null | undefined): number | null {
  if (!normalizeText(value)) return null;
  const parsed = Number(String(value).replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseDateOrNull(value: string | null | undefined): string | null {
  if (!normalizeText(value)) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function previewShape(
  kind: z.infer<typeof KindSchema>,
  row: Row,
  seen: Set<string>,
  existing: Set<string>,
) {
  const common = {
    sourceLabel: row.sourceLabel ?? "csv",
    confidence: "medium" as const,
    duplicateExisting: false,
    duplicateInFile: false,
    valid: true,
    errors: [] as string[],
  };

  if (kind === "brand") {
    const key = normalizeKey(row.brand_name, row.website);
    const errors: string[] = [];
    if (!normalizeText(row.brand_name)) errors.push("Brand name is required");
    if (existing.has(normalizeText(row.brand_name))) errors.push("Brand already exists");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["brand_name", "website", "contact_email"]),
      duplicateExisting: existing.has(normalizeText(row.brand_name)),
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "creator") {
    const key = normalizeKey(row.creator_name, row.handle, row.platform);
    const errors: string[] = [];
    if (!normalizeText(row.creator_name) && !normalizeText(row.handle))
      errors.push("Creator name or handle is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["creator_name", "platform", "rate_floor"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "contact") {
    const key = normalizeKey(row.email, row.company_name, row.display_name);
    const errors: string[] = [];
    if (!normalizeText(row.email)) errors.push("Email is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["email", "company_name"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "buying_intent_signal") {
    const key = normalizeKey(row.brand_name, row.signal_type, row.signal_summary, row.source_url);
    const errors: string[] = [];
    if (!normalizeText(row.brand_name)) errors.push("Brand name is required");
    if (!normalizeText(row.signal_type)) errors.push("Signal type is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["brand_name", "signal_type", "signal_summary"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "brand_opportunity") {
    const key = normalizeKey(row.brand_name, row.opportunity_title, row.signal_type);
    const errors: string[] = [];
    if (!normalizeText(row.brand_name)) errors.push("Brand name is required");
    if (!normalizeText(row.opportunity_title)) errors.push("Opportunity title is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["brand_name", "opportunity_title", "signal_type"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "campaign_brief") {
    const key = normalizeKey(row.title, row.direction, row.brand_name);
    const errors: string[] = [];
    if (!normalizeText(row.title)) errors.push("Title is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["title", "direction"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  if (kind === "product_drop") {
    const key = normalizeKey(row.brand_name, row.product_drop_name, row.signal_date);
    const errors: string[] = [];
    if (!normalizeText(row.brand_name)) errors.push("Brand name is required");
    if (!normalizeText(row.product_drop_name)) errors.push("Product drop name is required");
    const duplicateInFile = seen.has(key);
    if (duplicateInFile) errors.push("Duplicate row in file");
    if (!duplicateInFile) seen.add(key);
    return {
      ...common,
      confidence: csvConfidence(row, ["brand_name", "product_drop_name", "signal_summary"]),
      duplicateExisting: false,
      duplicateInFile,
      valid: errors.length === 0,
      errors,
      normalizedKey: key,
    };
  }

  const key = normalizeKey(row.display_name, row.email, row.target_type, row.direction);
  const errors: string[] = [];
  if (!normalizeText(row.display_name) && !normalizeText(row.email))
    errors.push("Display name or email is required");
  const duplicateInFile = seen.has(key);
  if (duplicateInFile) errors.push("Duplicate row in file");
  if (!duplicateInFile) seen.add(key);
  return {
    ...common,
    confidence: csvConfidence(row, ["target_type", "direction", "display_name"]),
    duplicateExisting: false,
    duplicateInFile,
    valid: errors.length === 0,
    errors,
    normalizedKey: key,
  };
}

function summarizeOpportunity(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    brand_name: row.brand_name as string,
    category: (row.category as string | null) ?? (row.brand_industry as string | null) ?? null,
    opportunity_title: row.opportunity_title as string,
    why_now: row.why_now as string | null,
    signal_type: row.signal_type as string | null,
    signal_summary: row.signal_summary as string | null,
    fit_score: Number(row.fit_score ?? 0),
    cash_likelihood_score: Number(row.cash_likelihood_score ?? 0),
    fast_pay_score: Number(row.fast_pay_score ?? 0),
    estimated_pay_min: row.estimated_pay_min == null ? null : Number(row.estimated_pay_min),
    estimated_pay_max: row.estimated_pay_max == null ? null : Number(row.estimated_pay_max),
    effort: (row.effort as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? (row.deadline_at as string | null) ?? null,
    timing: (row.timing as string | null) ?? (row.why_now as string | null) ?? null,
    pitch_angle: row.pitch_angle as string | null,
    contact_readiness: Number(row.contact_readiness ?? 0),
    risks: (row.risks as string[] | null) ?? [],
    brand_match_id: row.brand_match_id as string | null,
    buying_intent_signal_id: row.buying_intent_signal_id as string | null,
    status: row.status as string,
    source_record_type: row.source_record_type as string,
  };
}

export async function makeInternalDraft(args: {
  userId: string;
  target: Record<string, unknown>;
  opportunity?: Record<string, unknown> | null;
  senderEmail?: string | null;
}) {
  const target = args.target;
  const opportunity = args.opportunity ?? null;
  const brandMatchId =
    (target.brand_match_id as string | null) ?? (opportunity?.brand_match_id as string | null);
  const brandName =
    (target.company_name as string | null) ??
    (opportunity?.brand_name as string | null) ??
    (target.display_name as string | null) ??
    "Brand";

  const [{ data: profile }, { data: brand }] = await Promise.all([
    db
      .from("profiles")
      .select("email,sender_email,full_name")
      .eq("user_id", args.userId)
      .maybeSingle(),
    brandMatchId
      ? db
          .from("brand_matches")
          .select("*")
          .eq("user_id", args.userId)
          .eq("id", brandMatchId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contact = brandMatchId
    ? await getBestContactEmail(brandMatchId)
    : { email: null, name: null, title: null, source: null, confidence: null };
  const toEmail =
    (target.email as string | null) ??
    contact.email ??
    (target.cc_addresses as string[] | null)?.[0] ??
    null;
  const sender =
    args.senderEmail ??
    ((profile as Record<string, unknown> | null)?.sender_email as string | null) ??
    ((profile as Record<string, unknown> | null)?.email as string | null) ??
    "outreach@matchapp.ai";
  const subject =
    (opportunity?.opportunity_title as string | null) ??
    (target.display_name as string | null) ??
    `${brandName} opportunity`;
  const pitchAngle =
    (opportunity?.pitch_angle as string | null) ??
    (target.notes as string | null) ??
    "Open with a direct, specific angle.";
  const evidence = {
    target,
    opportunity,
    contact,
  };
  const body = [
    `Hi ${contact.name ?? brandName} team,`,
    "",
    `I saw ${opportunity?.signal_summary ?? target.notes ?? "a fit worth acting on"}.`,
    `Why now: ${(opportunity?.why_now as string | null) ?? "the timing looks active and practical."}`,
    `Pitch angle: ${pitchAngle}`,
    "",
    `If this is the right person, I can share a quick plan and keep it concise.`,
    "",
    `Thanks,`,
    (profile as Record<string, unknown> | null)?.full_name
      ? String((profile as Record<string, unknown>).full_name)
      : "MatchAI",
  ].join("\n");

  const draft = await db
    .from("email_drafts")
    .insert({
      user_id: args.userId,
      thread_id: null,
      provider_draft_id: `internal:${crypto.randomUUID()}`,
      from_address: sender,
      to_addresses: toEmail ? [toEmail] : [],
      cc_addresses: (target.cc_addresses as string[] | null) ?? [],
      bcc_addresses: (target.bcc_addresses as string[] | null) ?? [],
      reply_to_addresses: (target.reply_to_addresses as string[] | null) ?? [],
      subject,
      text_body: body,
      html_body: null,
      in_reply_to: null,
      references_header: null,
      status: "draft",
      sync_status: "pending",
      sync_error: null,
    })
    .select("*")
    .single();
  if (draft.error || !draft.data) throw new Error("Could not create inbox draft");

  const thread = await db
    .from("email_threads")
    .insert({
      user_id: args.userId,
      provider_thread_id: `internal:${draft.data.id}`,
      subject,
      snippet: body.slice(0, 240),
      folder: "drafts",
      is_unread: false,
      message_count: 0,
      last_message_at: new Date().toISOString(),
      brand_match_id: brandMatchId,
      contact_id: null,
      deal_id: null,
      last_synced_at: new Date().toISOString(),
      sync_status: "pending",
      sync_error: null,
    })
    .select("id")
    .single();
  if (thread.error || !thread.data) throw new Error("Could not create inbox thread");

  await db
    .from("email_drafts")
    .update({ thread_id: thread.data.id })
    .eq("id", draft.data.id)
    .eq("user_id", args.userId);

  return {
    draft_id: draft.data.id as string,
    thread_id: thread.data.id as string,
    to_email: toEmail,
    subject,
    pitch_angle: pitchAngle,
    source_evidence: evidence,
  };
}

function mapBrandOpportunity(row: Row, brandMatchId: string | null, signalId: string | null) {
  const estimatedMin = parseIntOrNull(row.estimated_pay_min);
  const estimatedMax = parseIntOrNull(row.estimated_pay_max);
  const urgency = parseIntOrNull(row.urgency_score) ?? 50;
  const ease = parseIntOrNull(row.ease_to_close_score) ?? 50;
  const fast = parseIntOrNull(row.fast_pay_score) ?? 50;
  const fit = parseIntOrNull(row.fit_score) ?? Math.round((urgency + ease + fast) / 3);
  const cash = parseIntOrNull(row.cash_likelihood_score) ?? Math.round((urgency + fast) / 2);
  const contactReady = parseIntOrNull(row.contact_readiness) ?? Math.round((ease + fast) / 2);
  return {
    brand_match_id: brandMatchId,
    buying_intent_signal_id: signalId,
    source_record_type: row.source_record_type ?? "csv",
    source_record_id: row.source_record_id ?? null,
    outreach_direction: (row.outreach_direction as string | null) ?? "creator_to_brand",
    brand_name: row.brand_name ?? "",
    website: row.website ?? null,
    opportunity_title:
      row.opportunity_title ?? row.signal_summary ?? row.signal_type ?? "Opportunity",
    opportunity_type: (row.opportunity_type as string | null) ?? "partnership",
    signal_type: row.signal_type ?? null,
    signal_summary: row.signal_summary ?? null,
    why_now: row.why_now ?? null,
    source_evidence: {
      source_url: row.source_url ?? null,
      notes: row.notes ?? null,
      product_drop_name: row.product_drop_name ?? null,
    },
    estimated_pay_min: estimatedMin,
    estimated_pay_max: estimatedMax,
    fit_score: fit,
    cash_likelihood_score: cash,
    fast_pay_score: fast,
    pitch_angle: row.pitch_angle ?? null,
    contact_readiness: contactReady,
    risks: splitList(row.risks),
    competition_risk: parseIntOrNull(row.competition_risk) ?? 50,
    creator_preference_fit: parseIntOrNull(row.creator_preference_fit) ?? fit,
    status: row.status ?? "pending",
  };
}

export const previewInternalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    const seen = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    const brandExisting =
      data.kind === "brand"
        ? await existingKeys("brand_matches", context.userId, "brand_name")
        : new Set<string>();
    const contactExisting =
      data.kind === "contact"
        ? await existingKeys("contacts", context.userId, "email")
        : new Set<string>();
    for (const row of data.rows) {
      const preview = previewShape(
        data.kind,
        row as Row,
        seen,
        data.kind === "brand" ? brandExisting : contactExisting,
      );
      rows.push({
        ...row,
        confidence: preview.confidence,
        duplicateExisting: preview.duplicateExisting,
        duplicateInFile: preview.duplicateInFile,
        valid: preview.valid,
        errors: preview.errors,
        normalizedKey: preview.normalizedKey,
      });
    }
    return {
      rows,
      validCount: rows.filter((row) => row.valid).length,
      invalidCount: rows.filter((row) => !row.valid).length,
    };
  });

export const importInternalRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportSchema.parse(input))
  .handler(async ({ context, data }) => {
    const seen = new Set<string>();
    const existingBrands = await existingKeys("brand_matches", context.userId, "brand_name");
    const existingContacts = await existingKeys("contacts", context.userId, "email");
    const existingTargets = await existingKeys("outreach_targets", context.userId, "display_name");
    const result = {
      imported: 0,
      skipped: 0,
      failures: [] as Array<{ rowNumber: number; error: string }>,
    };

    for (const raw of data.rows) {
      const row = raw as Row;
      const key = normalizeKey(
        row.brand_name,
        row.website,
        row.email,
        row.display_name,
        row.opportunity_title,
        row.signal_type,
        row.target_type,
      );
      if (!key || seen.has(key)) {
        result.skipped += 1;
        continue;
      }
      seen.add(key);

      try {
        if (data.kind === "brand") {
          const brandName = String(row.brand_name ?? "").trim();
          if (!brandName) throw new Error("Brand name is required");
          if (existingBrands.has(normalizeText(brandName))) {
            result.skipped += 1;
            continue;
          }
          const inserted = await db
            .from("brand_matches")
            .insert({
              user_id: context.userId,
              brand_name: brandName,
              brand_industry: row.industry ?? null,
              fit_score: parseIntOrNull(row.fit_score) ?? null,
              fit_quality_score:
                parseIntOrNull(row.fit_quality_score) ?? parseIntOrNull(row.fit_score) ?? null,
              fit_reasoning: row.fit_reasoning ?? row.notes ?? null,
              suggested_package: row.suggested_package ?? null,
              outreach_angle: row.outreach_angle ?? null,
              estimated_deal_min: parseIntOrNull(row.estimated_deal_min),
              estimated_deal_max: parseIntOrNull(row.estimated_deal_max),
              market_type: (row.market_type as "local" | "international" | null) ?? null,
              my_take: row.my_take ?? null,
              partnership_angle: row.partnership_angle ?? null,
              potential_risk: row.potential_risk ?? null,
              recommended_next_move: row.recommended_next_move ?? null,
              match_label: row.match_label ?? null,
              score_breakdown: row.score_breakdown ? JSON.parse(String(row.score_breakdown)) : null,
              why_creator_fits: row.why_creator_fits ?? null,
              why_brand_cares: row.why_brand_cares ?? null,
              top_reasons: splitList(row.top_reasons),
              suggested_deliverables: splitList(row.suggested_deliverables),
              best_outreach_channel: row.best_outreach_channel ?? null,
              contact_path: row.contact_path ?? null,
              what_to_avoid: row.what_to_avoid ?? null,
              data_source: data.sourceLabel === "csv" ? "csv_import" : "manual",
              evidence: {
                imported_via: data.sourceLabel,
                source_url: row.source_url ?? null,
                notes: row.notes ?? null,
              },
              status: "new",
              creator_verified: true,
            })
            .select("id")
            .single();
          if (!inserted.data) throw new Error("Brand insert failed");
          void indexBrandDiscoveryRecord({
            userId: context.userId,
            brandMatchId: inserted.data.id as string,
            sourceType: data.sourceLabel === "csv" ? "csv" : "manual",
          }).catch((error) => console.error("[internal-import] brand discovery failed", error));
          const contactEmail = normalizeText(row.contact_email);
          if (contactEmail) {
            await db.from("brand_contacts").insert({
              user_id: context.userId,
              brand_match_id: inserted.data.id,
              contact_name: row.contact_name ?? null,
              contact_title: row.contact_title ?? null,
              email: contactEmail,
              source: data.sourceLabel === "csv" ? "csv_import" : "manual",
              data_source: data.sourceLabel === "csv" ? "csv_import" : "manual",
              confidence: "high",
              verification_status: "creator_entered",
              notes: row.notes ?? null,
            });
          }
          result.imported += 1;
          continue;
        }

        if (data.kind === "contact") {
          const email = normalizeText(row.email);
          if (!email) throw new Error("Email is required");
          if (existingContacts.has(email)) {
            result.skipped += 1;
            continue;
          }
          await db.from("contacts").insert({
            user_id: context.userId,
            target_type: (row.target_type as string | null) ?? "contact",
            outreach_direction: (row.direction as string | null) ?? "matchai_to_brand",
            source_record_type: row.source_record_type ?? "manual",
            source_record_id: row.source_record_id ?? null,
            display_name: row.display_name ?? row.contact_name ?? email,
            company_name: row.company_name ?? null,
            email,
            cc: splitList(row.cc),
            bcc: splitList(row.bcc),
            reply_to: splitList(row.reply_to),
            platform: row.platform ?? null,
            audience_tags: splitList(row.audience_tags),
            tone_tags: splitList(row.tone_tags),
            notes: row.notes ?? null,
            source_evidence: {
              source_url: row.source_url ?? null,
              notes: row.notes ?? null,
            },
            confidence:
              parseIntOrNull(row.confidence) ??
              (csvConfidence(row, ["email", "company_name"]) === "high" ? 85 : 65),
            status: (row.status as string | null) ?? "active",
          });
          result.imported += 1;
          continue;
        }

        if (data.kind === "creator") {
          const targetName = row.creator_name ?? row.display_name ?? row.handle ?? "Creator";
          if (existingTargets.has(normalizeText(targetName))) {
            result.skipped += 1;
            continue;
          }
          await db.from("outreach_targets").insert({
            user_id: context.userId,
            target_type: "creator",
            outreach_direction: (row.direction as string | null) ?? "brand_to_creator",
            source_record_type: row.source_record_type ?? "csv_import",
            source_record_id: row.source_record_id ?? null,
            display_name: targetName,
            company_name: row.company_name ?? null,
            email: normalizeText(row.email) || null,
            cc_addresses: splitList(row.cc),
            bcc_addresses: splitList(row.bcc),
            reply_to_addresses: splitList(row.reply_to),
            attachments: [],
            personalization_evidence: {
              niche: row.niche ?? null,
              platform: row.platform ?? null,
              audience_tags: splitList(row.audience_tags),
              tone_tags: splitList(row.tone_tags),
              rate_floor: parseIntOrNull(row.rate_floor),
            },
            source_evidence: {
              notes: row.notes ?? null,
            },
            owner_user_id: context.userId,
            assignee: row.assignee ?? null,
            status: "draft",
            bounce_state: "none",
            compliance_footer: true,
            follow_up_state: {},
            contact_readiness: parseIntOrNull(row.contact_readiness) ?? 60,
            confidence: parseIntOrNull(row.confidence) ?? 60,
            notes: row.notes ?? null,
          });
          result.imported += 1;
          continue;
        }

        if (data.kind === "buying_intent_signal" || data.kind === "product_drop") {
          const brand = await lookupBrandMatch(context.userId, row.brand_name);
          const signalType =
            (row.signal_type as string | null) ??
            (data.kind === "product_drop" ? "product_drop" : "manual_research");
          const signal = await db
            .from("buying_intent_signals")
            .insert({
              user_id: context.userId,
              brand_match_id: (brand?.id as string | undefined) ?? null,
              source_record_type: row.source_record_type ?? data.sourceLabel,
              source_record_id: row.source_record_id ?? null,
              signal_type: signalType,
              signal_name: row.signal_name ?? row.product_drop_name ?? row.brand_name ?? signalType,
              signal_summary: row.signal_summary ?? row.notes ?? "",
              signal_date: parseDateOrNull(row.signal_date),
              source_url: row.source_url ?? null,
              brand_name: row.brand_name ?? null,
              website: row.website ?? null,
              product_name: row.product_drop_name ?? null,
              audience_tags: splitList(row.audience_tags),
              evidence: {
                notes: row.notes ?? null,
                source_url: row.source_url ?? null,
              },
              urgency_score: parseIntOrNull(row.urgency_score) ?? 60,
              ease_to_close_score: parseIntOrNull(row.ease_to_close_score) ?? 55,
              fast_pay_score: parseIntOrNull(row.fast_pay_score) ?? 60,
              confidence: parseIntOrNull(row.confidence) ?? 60,
              status: (row.status as string | null) ?? "confirmed",
            })
            .select("id")
            .single();
          if (!signal.data) throw new Error("Signal insert failed");

          const opportunity = await db
            .from("brand_opportunities")
            .insert({
              user_id: context.userId,
              brand_match_id: (brand?.id as string | undefined) ?? null,
              buying_intent_signal_id: signal.data.id,
              source_record_type: row.source_record_type ?? data.sourceLabel,
              source_record_id: row.source_record_id ?? null,
              outreach_direction: (row.outreach_direction as string | null) ?? "creator_to_brand",
              brand_name: row.brand_name ?? "",
              website: row.website ?? null,
              opportunity_title:
                row.opportunity_title ??
                row.signal_summary ??
                row.product_drop_name ??
                row.signal_name ??
                "Paid opportunity",
              opportunity_type: (row.opportunity_type as string | null) ?? "partnership",
              signal_type: signalType,
              signal_summary: row.signal_summary ?? row.notes ?? null,
              why_now: row.why_now ?? row.signal_summary ?? null,
              source_evidence: {
                source_url: row.source_url ?? null,
                notes: row.notes ?? null,
                product_drop_name: row.product_drop_name ?? null,
              },
              estimated_pay_min: parseIntOrNull(row.estimated_pay_min),
              estimated_pay_max: parseIntOrNull(row.estimated_pay_max),
              fit_score: parseIntOrNull(row.fit_score) ?? parseIntOrNull(row.urgency_score) ?? 60,
              cash_likelihood_score:
                parseIntOrNull(row.cash_likelihood_score) ??
                parseIntOrNull(row.ease_to_close_score) ??
                60,
              fast_pay_score: parseIntOrNull(row.fast_pay_score) ?? 60,
              pitch_angle: row.pitch_angle ?? null,
              contact_readiness: parseIntOrNull(row.contact_readiness) ?? 60,
              risks: splitList(row.risks),
              competition_risk: parseIntOrNull(row.competition_risk) ?? 50,
              creator_preference_fit: parseIntOrNull(row.creator_preference_fit) ?? 60,
              status: "pending",
            })
            .select("id")
            .single();

          await db.from("review_queue").upsert(
            {
              user_id: context.userId,
              direction: "creator_to_brand",
              queue_type: "analysis",
              match_score_id: null,
              campaign_brief_id: null,
              title: row.opportunity_title ?? row.signal_summary ?? "Buying intent review",
              status: "pending",
              priority: parseIntOrNull(row.urgency_score) ?? 60,
              reason: row.signal_summary ?? row.notes ?? "Buying intent signal imported",
              next_action:
                "Review the signal, confirm the contact path, and decide whether to draft outreach.",
              payload: {
                buying_intent_signal_id: signal.data.id,
                brand_opportunity_id: opportunity.data?.id ?? null,
                brand_match_id: (brand?.id as string | undefined) ?? null,
              },
            },
            { onConflict: "match_score_id" },
          );

          result.imported += 1;
          continue;
        }

        if (data.kind === "brand_opportunity") {
          const brand = await lookupBrandMatch(context.userId, row.brand_name);
          const mapped = mapBrandOpportunity(row, (brand?.id as string | null) ?? null, null);
          const opportunity = await db
            .from("brand_opportunities")
            .insert({
              user_id: context.userId,
              ...mapped,
              source_evidence: {
                source_url: row.source_url ?? null,
                notes: row.notes ?? null,
              },
            })
            .select("id")
            .single();
          await db.from("review_queue").insert({
            user_id: context.userId,
            direction: mapped.outreach_direction,
            queue_type: "analysis",
            title: mapped.opportunity_title,
            status: "pending",
            priority: mapped.fit_score,
            reason: mapped.signal_summary ?? mapped.why_now ?? "Imported opportunity",
            next_action:
              "Approve the opportunity, then open or create the internal outreach draft.",
            payload: {
              brand_opportunity_id: opportunity.data?.id ?? null,
              brand_match_id: (brand?.id as string | undefined) ?? null,
            },
          });
          result.imported += 1;
          continue;
        }

        if (data.kind === "campaign_brief") {
          const brand = await lookupBrandMatch(context.userId, row.brand_name);
          const { error } = await db.from("campaign_briefs").insert({
            user_id: context.userId,
            direction:
              (row.direction as "creator_to_brand" | "brand_to_creator" | null) ??
              "creator_to_brand",
            title: row.title ?? row.brand_name ?? "Campaign brief",
            summary: row.summary ?? row.notes ?? null,
            objective: row.objective ?? null,
            audience: row.audience ?? null,
            deliverables: splitList(row.deliverables),
            budget_min: parseIntOrNull(row.budget_min),
            budget_max: parseIntOrNull(row.budget_max),
            pitch_angle: row.pitch_angle ?? null,
            contact_hint: row.contact_hint ?? null,
            source_evidence: { notes: row.notes ?? null, source_url: row.source_url ?? null },
            creator_content_profile_id: null,
            brand_content_profile_id: null,
            match_score_id: null,
          });
          if (error) throw new Error(error.message);
          await db.from("review_queue").insert({
            user_id: context.userId,
            direction:
              (row.direction as "creator_to_brand" | "brand_to_creator" | null) ??
              "creator_to_brand",
            queue_type: "campaign_brief",
            title: row.title ?? "Campaign brief",
            status: "pending",
            priority: parseIntOrNull(row.priority) ?? 60,
            reason: row.summary ?? row.objective ?? "Campaign brief imported",
            next_action: "Review the brief, then generate the outreach draft.",
            payload: {
              brand_match_id: (brand?.id as string | undefined) ?? null,
              campaign_brief_title: row.title ?? null,
            },
          });
          result.imported += 1;
          continue;
        }

        if (data.kind === "outreach_target") {
          const target = await db
            .from("outreach_targets")
            .insert({
              user_id: context.userId,
              target_type: (row.target_type as string | null) ?? "contact",
              outreach_direction: (row.direction as string | null) ?? "matchai_to_brand",
              source_record_type: row.source_record_type ?? data.sourceLabel,
              source_record_id: row.source_record_id ?? null,
              display_name: row.display_name ?? row.company_name ?? row.email ?? "Target",
              company_name: row.company_name ?? null,
              email: normalizeText(row.email) || null,
              cc_addresses: splitList(row.cc),
              bcc_addresses: splitList(row.bcc),
              reply_to_addresses: splitList(row.reply_to),
              attachments: [],
              personalization_evidence: {
                notes: row.notes ?? null,
                audience_tags: splitList(row.audience_tags),
                tone_tags: splitList(row.tone_tags),
              },
              source_evidence: { source_url: row.source_url ?? null, notes: row.notes ?? null },
              owner_user_id: context.userId,
              assignee: row.assignee ?? null,
              status: (row.status as string | null) ?? "draft",
              bounce_state: "none",
              compliance_footer: true,
              follow_up_state: {},
              contact_readiness: parseIntOrNull(row.contact_readiness) ?? 60,
              confidence: parseIntOrNull(row.confidence) ?? 60,
              notes: row.notes ?? null,
            })
            .select("id")
            .single();
          await db.from("review_queue").insert({
            user_id: context.userId,
            direction:
              (row.direction as
                | "creator_to_brand"
                | "matchai_to_creator"
                | "matchai_to_brand"
                | "brand_to_creator"
                | null) ?? "matchai_to_brand",
            queue_type: "analysis",
            title: row.display_name ?? row.company_name ?? row.email ?? "Outreach target",
            status: "pending",
            priority: parseIntOrNull(row.contact_readiness) ?? 60,
            reason: row.notes ?? "Outreach target imported",
            next_action: "Approve to create an internal inbox draft.",
            payload: {
              outreach_target_id: target.data?.id ?? null,
            },
          });
          result.imported += 1;
          continue;
        }

        result.skipped += 1;
      } catch (error) {
        result.failures.push({
          rowNumber: Number(row.rowNumber ?? 0),
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    return result;
  });

export const listCreatorDealOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [opportunities, brandMatches, analysis] = await Promise.all([
      db
        .from("brand_opportunities")
        .select("*")
        .eq("user_id", context.userId)
        .order("fit_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("brand_matches")
        .select(
          "id,brand_name,brand_industry,fit_score,fit_quality_score,fit_reasoning,estimated_deal_min,estimated_deal_max,suggested_package,outreach_angle,market_type,my_take,partnership_angle,potential_risk,recommended_next_move,contact_path,what_to_avoid,data_source,evidence",
        )
        .eq("user_id", context.userId)
        .order("fit_quality_score", { ascending: false, nullsFirst: false })
        .order("fit_score", { ascending: false })
        .limit(40),
      db.from("ai_analysis").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);

    const cards = (opportunities.data ?? []).map((row) =>
      summarizeOpportunity(row as Record<string, unknown>),
    );
    const existing = new Set(
      cards.map((row) => normalizeKey(row.brand_name, row.opportunity_title)),
    );
    for (const row of brandMatches.data ?? []) {
      const brand = row as Record<string, unknown>;
      const key = normalizeKey(
        brand.brand_name as string | null,
        brand.suggested_package as string | null,
      );
      if (existing.has(key)) continue;
      cards.push({
        id: String(brand.id),
        brand_name: String(brand.brand_name ?? "Brand"),
        category: (brand.brand_industry as string | null) ?? null,
        opportunity_title: String(
          brand.suggested_package ?? brand.fit_reasoning ?? "Best chance to get paid this week",
        ),
        why_now: String(
          brand.recommended_next_move ?? brand.outreach_angle ?? "Brand match already exists",
        ),
        signal_type: "manual_research",
        signal_summary: String(brand.fit_reasoning ?? brand.outreach_angle ?? "Existing match"),
        fit_score: Number(brand.fit_score ?? brand.fit_quality_score ?? 0),
        cash_likelihood_score: Number(brand.fit_score ?? brand.fit_quality_score ?? 0),
        fast_pay_score: Number(brand.fit_score ?? brand.fit_quality_score ?? 0),
        estimated_pay_min:
          brand.estimated_deal_min == null ? null : Number(brand.estimated_deal_min),
        estimated_pay_max:
          brand.estimated_deal_max == null ? null : Number(brand.estimated_deal_max),
        effort: null,
        deadline: null,
        timing: null,
        pitch_angle: String(brand.outreach_angle ?? brand.partnership_angle ?? brand.my_take ?? ""),
        contact_readiness: brand.contact_path ? 80 : 50,
        risks: brand.what_to_avoid ? [String(brand.what_to_avoid)] : [],
        brand_match_id: String(brand.id),
        buying_intent_signal_id: null,
        status: String(brand.data_source ?? "brand_match"),
        source_record_type: "brand_match",
      });
    }

    const analysisRows = (
      (analysis?.first_brand_opportunities as Array<{
        brand_name: string;
        brand_industry: string;
        fit_score: number;
        fit_reasoning: string;
        estimated_deal_min: number;
        estimated_deal_max: number;
        suggested_package: string;
        outreach_angle: string;
        market_type: "local" | "international";
      }>) ?? []
    ).map((row) => ({
      id: normalizeKey(row.brand_name, row.suggested_package),
      brand_name: row.brand_name,
      category: row.brand_industry ?? null,
      opportunity_title: row.suggested_package,
      why_now: row.fit_reasoning,
      signal_type: "onboarding",
      signal_summary: row.fit_reasoning,
      fit_score: row.fit_score,
      cash_likelihood_score: row.fit_score,
      fast_pay_score: row.fit_score,
      estimated_pay_min: row.estimated_deal_min,
      estimated_pay_max: row.estimated_deal_max,
      effort: null,
      deadline: null,
      timing: null,
      pitch_angle: row.outreach_angle,
      contact_readiness: row.fit_score,
      risks: [],
      brand_match_id: null,
      buying_intent_signal_id: null,
      status: row.market_type,
      source_record_type: "ai_analysis",
    }));

    const all = [...cards, ...analysisRows].sort((a, b) => b.fit_score - a.fit_score);
    return {
      opportunities: all.slice(0, 40),
      ai_analysis: analysis ?? null,
    };
  });

export const createInternalOutreachDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        opportunity_id: z.string().uuid().optional(),
        brand_match_id: z.string().uuid().optional(),
        brand_name: z.string().trim().min(1).max(200).optional(),
        outreach_target_id: z.string().uuid().optional(),
      })
      .refine((value) =>
        Boolean(
          value.opportunity_id ||
          value.brand_match_id ||
          value.brand_name ||
          value.outreach_target_id,
        ),
      )
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let opportunity: Record<string, unknown> | null = null;
    let target: Record<string, unknown> | null = null;

    if (data.opportunity_id) {
      const { data: row } = await db
        .from("brand_opportunities")
        .select("*")
        .eq("user_id", context.userId)
        .eq("id", data.opportunity_id)
        .maybeSingle();
      if (!row) throw new Error("Opportunity not found");
      opportunity = row as Record<string, unknown>;
      const { data: existingTarget } = await db
        .from("outreach_targets")
        .select("*")
        .eq("user_id", context.userId)
        .eq("source_record_type", "brand_opportunity")
        .eq("source_record_id", data.opportunity_id)
        .maybeSingle();
      target = existingTarget as Record<string, unknown> | null;
      if (!target) {
        const contact = await getBestContactEmail(
          (opportunity.brand_match_id as string | null) ?? "",
        );
        const inserted = await db
          .from("outreach_targets")
          .insert({
            user_id: context.userId,
            target_type: "opportunity",
            outreach_direction:
              (opportunity.outreach_direction as string | null) ?? "creator_to_brand",
            source_record_type: "brand_opportunity",
            source_record_id: data.opportunity_id,
            display_name: String(opportunity.brand_name ?? "Opportunity"),
            company_name: String(opportunity.brand_name ?? "Opportunity"),
            email: contact.email ?? null,
            cc_addresses: [],
            bcc_addresses: [],
            reply_to_addresses: [],
            attachments: [],
            personalization_evidence: {
              pitch_angle: opportunity.pitch_angle ?? null,
              why_now: opportunity.why_now ?? null,
              signal_summary: opportunity.signal_summary ?? null,
            },
            source_evidence: opportunity.source_evidence ?? {},
            owner_user_id: context.userId,
            assignee: null,
            status: "pending_approval",
            bounce_state: "none",
            compliance_footer: true,
            follow_up_state: {},
            contact_readiness: Number(opportunity.contact_readiness ?? 60),
            confidence: Number(opportunity.fit_score ?? 60),
            notes: String(opportunity.signal_summary ?? opportunity.why_now ?? ""),
          })
          .select("*")
          .single();
        if (!inserted.data) throw new Error("Could not create outreach target");
        target = inserted.data as Record<string, unknown>;
        await db
          .from("outreach_targets")
          .update({ status: "approved" })
          .eq("id", inserted.data.id)
          .eq("user_id", context.userId);
      }
    } else if (data.brand_match_id || data.brand_name) {
      const brandId = data.brand_match_id ?? null;
      const resolvedBrand = brandId
        ? ((
            await db
              .from("brand_matches")
              .select("*")
              .eq("user_id", context.userId)
              .eq("id", brandId)
              .maybeSingle()
          ).data ?? null)
        : await lookupBrandMatch(context.userId, data.brand_name);
      if (!resolvedBrand) throw new Error("Brand not found");
      const { data: existingOpportunity } = await db
        .from("brand_opportunities")
        .select("*")
        .eq("user_id", context.userId)
        .eq("brand_match_id", resolvedBrand.id as string)
        .order("fit_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      opportunity = (existingOpportunity as Record<string, unknown> | null) ?? {
        brand_match_id: resolvedBrand.id,
        brand_name: resolvedBrand.brand_name,
        opportunity_title:
          resolvedBrand.suggested_package ??
          resolvedBrand.fit_reasoning ??
          resolvedBrand.brand_name,
        why_now:
          resolvedBrand.recommended_next_move ??
          resolvedBrand.outreach_angle ??
          resolvedBrand.fit_reasoning ??
          null,
        signal_summary: resolvedBrand.fit_reasoning ?? null,
        pitch_angle: resolvedBrand.outreach_angle ?? resolvedBrand.partnership_angle ?? null,
        source_evidence: resolvedBrand.evidence ?? {},
      };
      const { data: existingTarget } = await db
        .from("outreach_targets")
        .select("*")
        .eq("user_id", context.userId)
        .eq("source_record_type", "brand_match")
        .eq("source_record_id", resolvedBrand.id as string)
        .maybeSingle();
      target = existingTarget as Record<string, unknown> | null;
      if (!target) {
        const contact = await getBestContactEmail(resolvedBrand.id as string);
        const inserted = await db
          .from("outreach_targets")
          .insert({
            user_id: context.userId,
            target_type: "brand",
            outreach_direction: "creator_to_brand",
            source_record_type: "brand_match",
            source_record_id: resolvedBrand.id,
            display_name: String(resolvedBrand.brand_name ?? "Brand"),
            company_name: String(resolvedBrand.brand_name ?? "Brand"),
            email: contact.email ?? null,
            cc_addresses: [],
            bcc_addresses: [],
            reply_to_addresses: [],
            attachments: [],
            personalization_evidence: {
              pitch_angle: resolvedBrand.outreach_angle ?? null,
              why_now: resolvedBrand.recommended_next_move ?? resolvedBrand.fit_reasoning ?? null,
              fit_reasoning: resolvedBrand.fit_reasoning ?? null,
            },
            source_evidence: resolvedBrand.evidence ?? {},
            owner_user_id: context.userId,
            assignee: null,
            status: "pending_approval",
            bounce_state: "none",
            compliance_footer: true,
            follow_up_state: {},
            contact_readiness: Number(
              resolvedBrand.fit_score ?? resolvedBrand.fit_quality_score ?? 60,
            ),
            confidence: Number(resolvedBrand.fit_score ?? resolvedBrand.fit_quality_score ?? 60),
            notes: String(resolvedBrand.fit_reasoning ?? ""),
          })
          .select("*")
          .single();
        if (!inserted.data) throw new Error("Could not create outreach target");
        target = inserted.data as Record<string, unknown>;
        await db
          .from("outreach_targets")
          .update({ status: "approved" })
          .eq("id", inserted.data.id)
          .eq("user_id", context.userId);
      }
    } else if (data.outreach_target_id) {
      const { data: row } = await db
        .from("outreach_targets")
        .select("*")
        .eq("user_id", context.userId)
        .eq("id", data.outreach_target_id)
        .maybeSingle();
      if (!row) throw new Error("Outreach target not found");
      target = row as Record<string, unknown>;
      const { data: existingOpportunity } = await db
        .from("brand_opportunities")
        .select("*")
        .eq("user_id", context.userId)
        .eq("id", target.source_record_id as string)
        .maybeSingle();
      opportunity = (existingOpportunity as Record<string, unknown> | null) ?? null;
    }

    if (!target) throw new Error("Outreach target not found");
    const draft = await makeInternalDraft({
      userId: context.userId,
      target,
      opportunity,
      senderEmail: null,
    });
    await db
      .from("outreach_targets")
      .update({
        inbox_draft_id: draft.draft_id,
        status: "pending_approval",
        source_evidence: {
          ...(target.source_evidence as Record<string, unknown> | undefined),
          draft: draft.source_evidence,
        },
      })
      .eq("id", target.id as string)
      .eq("user_id", context.userId);
    return { ok: true as const, ...draft };
  });

export const listInternalOutreachTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [targets, opportunities, signals, contacts] = await Promise.all([
      db
        .from("outreach_targets")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("brand_opportunities")
        .select("*")
        .eq("user_id", context.userId)
        .order("fit_score", { ascending: false })
        .limit(100),
      db
        .from("buying_intent_signals")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("contacts")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return {
      outreach_targets: targets.data ?? [],
      brand_opportunities: opportunities.data ?? [],
      buying_intent_signals: signals.data ?? [],
      contacts: contacts.data ?? [],
    };
  });

export const createOutreachTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        target_type: z
          .enum(["creator", "brand", "contact", "opportunity", "campaign"])
          .default("contact"),
        direction: z
          .enum(["creator_to_brand", "matchai_to_creator", "matchai_to_brand", "brand_to_creator"])
          .default("matchai_to_brand"),
        source_record_type: z.string().trim().max(120).optional(),
        source_record_id: z.string().uuid().nullable().optional(),
        display_name: z.string().trim().max(200).default("Outreach target"),
        company_name: z.string().trim().max(200).optional(),
        email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
        cc_addresses: z.array(z.string().trim().email().max(320)).default([]),
        bcc_addresses: z.array(z.string().trim().email().max(320)).default([]),
        reply_to_addresses: z.array(z.string().trim().email().max(320)).default([]),
        attachments: z.array(z.record(z.string(), z.unknown())).default([]),
        personalization_evidence: z.record(z.string(), z.unknown()).default({}),
        source_evidence: z.record(z.string(), z.unknown()).default({}),
        owner_user_id: z.string().uuid().optional(),
        assignee: z.string().trim().max(200).nullable().optional(),
        status: z
          .enum([
            "draft",
            "pending_approval",
            "approved",
            "sending",
            "sent",
            "failed",
            "suppressed",
            "retry",
          ])
          .default("draft"),
        compliance_footer: z.boolean().default(true),
        contact_readiness: z.number().int().min(0).max(100).default(50),
        confidence: z.number().int().min(0).max(100).default(50),
        notes: z.string().trim().max(2_000).nullable().optional(),
      })
      .passthrough()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const target = await db
      .from("outreach_targets")
      .insert({
        user_id: context.userId,
        target_type: (data.target_type as string | null) ?? "contact",
        outreach_direction: (data.direction as string | null) ?? "matchai_to_brand",
        source_record_type: (data.source_record_type as string | null) ?? "manual",
        source_record_id: (data.source_record_id as string | null) ?? null,
        display_name: (data.display_name as string | null) ?? "Outreach target",
        company_name: (data.company_name as string | null) ?? null,
        email: normalizeText(data.email as string | null) || null,
        cc_addresses: Array.isArray(data.cc_addresses) ? data.cc_addresses : [],
        bcc_addresses: Array.isArray(data.bcc_addresses) ? data.bcc_addresses : [],
        reply_to_addresses: Array.isArray(data.reply_to_addresses) ? data.reply_to_addresses : [],
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        personalization_evidence:
          (data.personalization_evidence as Record<string, unknown> | null) ?? {},
        source_evidence: (data.source_evidence as Record<string, unknown> | null) ?? {},
        owner_user_id: context.userId,
        assignee: (data.assignee as string | null) ?? null,
        status: (data.status as string | null) ?? "draft",
        bounce_state: "none",
        compliance_footer: data.compliance_footer ?? true,
        follow_up_state: {},
        contact_readiness: Number(data.contact_readiness ?? 50),
        confidence: Number(data.confidence ?? 50),
        notes: (data.notes as string | null) ?? null,
      })
      .select("*")
      .single();
    if (target.error || !target.data) throw new Error("Could not save outreach target");
    return { ok: true as const, target: target.data };
  });
