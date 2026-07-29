import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const email = z.string().trim().email().max(320);
const optionalEmail = z.union([email, z.literal("")]).optional();
const optionalUrl = z.union([z.string().trim().url().max(2_000), z.literal("")]).optional();

const BrandInput = z.object({
  brandName: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(120).optional().default(""),
  website: optionalUrl,
  contactName: z.string().trim().max(200).optional().default(""),
  contactTitle: z.string().trim().max(200).optional().default(""),
  contactEmail: optionalEmail,
  notes: z.string().trim().max(2_000).optional().default(""),
  source: z.enum(["manual", "csv_import"]).default("manual"),
});

export type BrandImportRow = z.infer<typeof BrandInput>;

function normalizeBrandName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

async function existingBrandNames(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("brand_matches").select("brand_name").eq("user_id", userId);
  return new Set((data ?? []).map((row) => normalizeBrandName(row.brand_name)));
}

export const getLeadProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    configured: false,
    provider: null as string | null,
    message:
      "No lead-generation or enrichment provider is configured. Add brands and contacts manually or import a CSV.",
  }));

export const createManualBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BrandInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const existing = await existingBrandNames(supabase, userId);
    if (existing.has(normalizeBrandName(data.brandName))) {
      return {
        ok: false as const,
        code: "duplicate" as const,
        error: "That brand already exists.",
      };
    }
    const { data: brand, error: brandError } = await supabase
      .from("brand_matches")
      .insert({
        user_id: userId,
        brand_name: data.brandName,
        brand_industry: data.industry || null,
        data_source: "manual",
        evidence: {
          provenance: "manual",
          website: data.website || null,
          notes: data.notes || null,
          imported_at: new Date().toISOString(),
        },
        status: "new",
        creator_verified: true,
      })
      .select("*")
      .single();
    if (brandError || !brand) throw new Error("Could not create brand");

    if (data.contactEmail) {
      const { error: contactError } = await supabase.from("brand_contacts").insert({
        user_id: userId,
        brand_match_id: brand.id,
        contact_name: data.contactName || null,
        contact_title: data.contactTitle || null,
        email: data.contactEmail,
        source: "manual",
        data_source: "manual",
        confidence: "high",
        verification_status: "creator_entered",
        notes: data.notes || null,
      });
      if (contactError) {
        throw new Error("Brand saved, but the contact could not be saved");
      }
    }
    return { ok: true as const, brand };
  });

const PreviewSchema = z.object({
  rows: z.array(BrandInput.extend({ rowNumber: z.number().int().positive() })).max(2_000),
});

export const previewBrandImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    const existing = await existingBrandNames(context.supabase, context.userId);
    const seen = new Set<string>();
    const rows = data.rows.map((row) => {
      const normalized = normalizeBrandName(row.brandName);
      const errors: string[] = [];
      if (!normalized) errors.push("Brand name is required");
      if (row.contactEmail && !email.safeParse(row.contactEmail).success) {
        errors.push("Contact email is invalid");
      }
      const duplicateExisting = existing.has(normalized);
      const duplicateInFile = seen.has(normalized);
      if (duplicateExisting) errors.push("Brand already exists");
      if (duplicateInFile) errors.push("Duplicate row in this CSV");
      seen.add(normalized);
      return {
        ...row,
        source: "csv_import" as const,
        duplicateExisting,
        duplicateInFile,
        valid: errors.length === 0,
        errors,
      };
    });
    return {
      rows,
      validCount: rows.filter((row) => row.valid).length,
      invalidCount: rows.filter((row) => !row.valid).length,
    };
  });

export const importBrandRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    const previewExisting = await existingBrandNames(context.supabase, context.userId);
    const seen = new Set<string>();
    let imported = 0;
    let skipped = 0;
    const failures: Array<{ rowNumber: number; error: string }> = [];

    for (const row of data.rows) {
      const normalized = normalizeBrandName(row.brandName);
      if (!normalized || previewExisting.has(normalized) || seen.has(normalized)) {
        skipped += 1;
        continue;
      }
      seen.add(normalized);
      try {
        const parsed = BrandInput.parse({ ...row, source: "csv_import" });
        const { data: brand, error: brandError } = await context.supabase
          .from("brand_matches")
          .insert({
            user_id: context.userId,
            brand_name: parsed.brandName,
            brand_industry: parsed.industry || null,
            data_source: "csv_import",
            evidence: {
              provenance: "csv_import",
              source_row: row.rowNumber,
              website: parsed.website || null,
              notes: parsed.notes || null,
              imported_at: new Date().toISOString(),
            },
            status: "new",
            creator_verified: true,
          })
          .select("id")
          .single();
        if (brandError || !brand) throw new Error("Brand insert failed");
        if (parsed.contactEmail) {
          const { error: contactError } = await context.supabase.from("brand_contacts").insert({
            user_id: context.userId,
            brand_match_id: brand.id,
            contact_name: parsed.contactName || null,
            contact_title: parsed.contactTitle || null,
            email: parsed.contactEmail,
            source: "csv_import",
            data_source: "csv_import",
            confidence: "high",
            verification_status: "creator_entered",
            notes: parsed.notes || null,
          });
          if (contactError) throw new Error("Contact insert failed");
        }
        imported += 1;
      } catch (error) {
        failures.push({
          rowNumber: row.rowNumber,
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }
    return { imported, skipped, failures };
  });
