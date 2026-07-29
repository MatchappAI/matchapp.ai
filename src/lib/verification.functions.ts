import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateCode,
  generateNumericCode,
  hashCode,
  isPodcastLike,
  maskEmail,
  scrapeBio,
  scrapeContactEmail,
  sendVerificationEmail,
} from "./verification.server";

const PLATFORM = z.string().min(1).max(40);
const HANDLE = z.string().min(1).max(200);

const TEN_MIN_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type VerificationRow = {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
  verification_code: string;
  status: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  apify_run_id: string | null;
  created_at: string;
};

function publicRow(r: VerificationRow) {
  return {
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    code: r.verification_code,
    status: r.status,
    attempts: r.attempts,
    max_attempts: r.max_attempts,
    expires_at: r.expires_at,
    created_at: r.created_at,
  };
}

/** Auto-skip podcast/RSS — verification not supported via bio scrape. */
async function autoSkip(userId: string, platform: string, handle: string) {
  const { data } = await supabaseAdmin
    .from("platform_verifications")
    .insert({
      user_id: userId,
      platform,
      handle,
      verification_code: "N/A",
      status: "skipped",
      expires_at: new Date(Date.now() + TEN_MIN_MS).toISOString(),
    })
    .select("*")
    .single();
  await supabaseAdmin
    .from("creator_profiles")
    .update({
      verification_status: "skipped",
      verification_skipped: true,
      verified: false,
    })
    .eq("user_id", userId);
  return data as VerificationRow;
}

export const generateVerificationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ platform: PLATFORM, handle: HANDLE }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const platform = data.platform.toLowerCase();
    const handle = data.handle.trim().replace(/^@+/, "");

    if (isPodcastLike(platform)) {
      const row = await autoSkip(userId, platform, handle);
      return {
        unsupported: true as const,
        verification: publicRow(row),
        message:
          "Podcast verification isn't available yet. You can skip this step.",
      };
    }

    // Rate limit: max 5 generations per user per hour
    const sinceHour = new Date(Date.now() - HOUR_MS).toISOString();
    const { count: hourCount } = await supabaseAdmin
      .from("platform_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", sinceHour);
    if ((hourCount ?? 0) >= 5) {
      return {
        rateLimited: true as const,
        message: "You've requested too many codes. Try again in an hour.",
      };
    }

    // Reuse active pending if exists
    const { data: existing } = await supabaseAdmin
      .from("platform_verifications")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Make sure handle reflects current intent
      if (existing.handle !== handle) {
        await supabaseAdmin
          .from("platform_verifications")
          .update({ handle })
          .eq("id", existing.id);
        existing.handle = handle;
      }
      return { verification: publicRow(existing as VerificationRow) };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + TEN_MIN_MS).toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("platform_verifications")
      .insert({
        user_id: userId,
        platform,
        handle,
        verification_code: code,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error || !inserted) {
      console.error("[verify] insert failed", error);
      throw new Error("Could not create verification");
    }

    await supabaseAdmin
      .from("creator_profiles")
      .update({ verification_status: "pending" })
      .eq("user_id", userId);

    return { verification: publicRow(inserted as VerificationRow) };
  });

export const checkVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ verificationId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: row } = await supabaseAdmin
      .from("platform_verifications")
      .select("*")
      .eq("id", data.verificationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return { status: "not_found" as const };

    if (row.status !== "pending") {
      return { status: row.status as "verified" | "failed" | "expired" | "skipped" };
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("platform_verifications")
        .update({ status: "expired" })
        .eq("id", row.id);
      return { status: "expired" as const };
    }

    const newAttempts = (row.attempts ?? 0) + 1;
    await supabaseAdmin
      .from("platform_verifications")
      .update({ attempts: newAttempts })
      .eq("id", row.id);

    if (newAttempts > (row.max_attempts ?? 3)) {
      await supabaseAdmin
        .from("platform_verifications")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", row.id);
      await supabaseAdmin
        .from("creator_profiles")
        .update({ verification_status: "failed" })
        .eq("user_id", userId);
      return {
        status: "failed" as const,
        reason: "max_attempts_exceeded" as const,
      };
    }

    const scrape = await scrapeBio(row.platform, row.handle);

    if (scrape.ok) {
      await supabaseAdmin
        .from("platform_verifications")
        .update({ apify_run_id: scrape.apifyRunId })
        .eq("id", row.id);

      const found = scrape.bio.toLowerCase().includes(row.verification_code.toLowerCase());
      if (found) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("platform_verifications")
          .update({ status: "verified", verified_at: now })
          .eq("id", row.id);
        await supabaseAdmin
          .from("creator_profiles")
          .update({
            verified: true,
            verification_status: "verified",
            verified_platform: row.platform,
            verified_handle: row.handle,
            verified_at: now,
            verification_skipped: false,
          })
          .eq("user_id", userId);
        return {
          status: "verified" as const,
          verified_at: now,
          platform: row.platform,
          handle: row.handle,
        };
      }
    }

    const remaining = Math.max(0, (row.max_attempts ?? 3) - newAttempts);
    const reason =
      !scrape.ok && scrape.reason === "private_or_empty"
        ? ("private_or_empty" as const)
        : !scrape.ok && scrape.reason === "scrape_timeout"
        ? ("scrape_timeout" as const)
        : ("not_found" as const);

    return {
      status: "not_found" as const,
      attempts_remaining: remaining,
      reason,
    };
  });

export const skipVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ verificationId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("platform_verifications")
      .update({ status: "skipped" })
      .eq("id", data.verificationId)
      .eq("user_id", userId);
    await supabaseAdmin
      .from("creator_profiles")
      .update({
        verification_status: "skipped",
        verification_skipped: true,
        verified: false,
      })
      .eq("user_id", userId);
    return { status: "skipped" as const };
  });

export const resendVerificationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ platform: PLATFORM, handle: HANDLE }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const platform = data.platform.toLowerCase();
    const handle = data.handle.trim().replace(/^@+/, "");

    // Rate limit: 3 resends per platform per day
    const sinceDay = new Date(Date.now() - DAY_MS).toISOString();
    const { count: dayCount } = await supabaseAdmin
      .from("platform_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("platform", platform)
      .gte("created_at", sinceDay);
    if ((dayCount ?? 0) >= 8) {
      return {
        rateLimited: true as const,
        message: "Too many resends today. Try again tomorrow.",
      };
    }

    // Expire all pending
    await supabaseAdmin
      .from("platform_verifications")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("status", "pending");

    const code = generateCode();
    const expiresAt = new Date(Date.now() + TEN_MIN_MS).toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("platform_verifications")
      .insert({
        user_id: userId,
        platform,
        handle,
        verification_code: code,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error("Could not regenerate code");

    await supabaseAdmin
      .from("creator_profiles")
      .update({ verification_status: "pending" })
      .eq("user_id", userId);

    return { verification: publicRow(inserted as VerificationRow) };
  });

/** Read current verification status for the UI. */
export const getVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("creator_profiles")
      .select("verified, verification_status, verified_platform, verified_handle, verified_at, verification_skipped")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      verified: !!data?.verified,
      status: (data?.verification_status as string) ?? "unverified",
      platform: data?.verified_platform ?? null,
      handle: data?.verified_handle ?? null,
      verified_at: data?.verified_at ?? null,
      skipped: !!data?.verification_skipped,
    };
  });

/**
 * No-edit method: scrape the profile's public contact email and send a 6-digit
 * code to it. Owning that inbox proves account ownership without any bio edits.
 */
export const startEmailCodeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ platform: PLATFORM, handle: HANDLE }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const platform = data.platform.toLowerCase();
    const handle = data.handle.trim().replace(/^@+/, "");

    if (isPodcastLike(platform)) {
      return { unsupported: true as const, message: "Email verification isn't available for this platform yet." };
    }

    // Rate limit: reuse the hourly cap on generations.
    const sinceHour = new Date(Date.now() - HOUR_MS).toISOString();
    const { count: hourCount } = await supabaseAdmin
      .from("platform_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", sinceHour);
    if ((hourCount ?? 0) >= 5) {
      return { rateLimited: true as const, message: "You've requested too many codes. Try again in an hour." };
    }

    const scrape = await scrapeContactEmail(platform, handle);
    if (!scrape.ok) {
      const msg =
        scrape.reason === "no_email"
          ? "We couldn't find a public contact email on your profile. Add one to your bio (or your Instagram business profile), or use the bio-code method instead."
          : scrape.reason === "private_or_empty"
          ? "Your profile looks private or empty — make it public and try again."
          : scrape.reason === "scrape_timeout"
          ? "Reading your profile took too long. Try again in a moment."
          : "We couldn't reach your profile right now. Try again in a moment.";
      return { noEmail: true as const, reason: scrape.reason, message: msg };
    }

    const code = generateNumericCode(6);
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + TEN_MIN_MS).toISOString();
    const email = scrape.email;
    const mask = maskEmail(email);

    // Expire pending records for this platform, then insert a fresh email-code row.
    await supabaseAdmin
      .from("platform_verifications")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("status", "pending");

    const { data: inserted, error } = await supabaseAdmin
      .from("platform_verifications")
      .insert({
        user_id: userId,
        platform,
        handle,
        verification_code: "EMAIL",
        status: "pending",
        expires_at: expiresAt,
        method: "email_code",
        contact_email: email,
        contact_email_mask: mask,
        email_code_hash: codeHash,
        email_code_sent_at: new Date().toISOString(),
        apify_run_id: scrape.apifyRunId,
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error("Could not start email verification");

    const send = await sendVerificationEmail(email, code, platform);
    if (!send.ok) {
      return { sendFailed: true as const, message: send.error ?? "Could not send email." };
    }

    await supabaseAdmin
      .from("creator_profiles")
      .update({ verification_status: "pending" })
      .eq("user_id", userId);

    return {
      ok: true as const,
      verificationId: inserted.id as string,
      emailMask: mask,
      expiresAt,
    };
  });

export const confirmEmailCodeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      verificationId: z.string().uuid(),
      code: z.string().min(4).max(12),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("platform_verifications")
      .select("*")
      .eq("id", data.verificationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return { status: "not_found" as const };
    if (row.method !== "email_code") return { status: "wrong_method" as const };
    if (row.status !== "pending") {
      return { status: row.status as "verified" | "failed" | "expired" | "skipped" };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("platform_verifications").update({ status: "expired" }).eq("id", row.id);
      return { status: "expired" as const };
    }

    const newAttempts = (row.attempts ?? 0) + 1;
    await supabaseAdmin.from("platform_verifications").update({ attempts: newAttempts }).eq("id", row.id);
    if (newAttempts > (row.max_attempts ?? 3)) {
      await supabaseAdmin
        .from("platform_verifications")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", row.id);
      await supabaseAdmin
        .from("creator_profiles")
        .update({ verification_status: "failed" })
        .eq("user_id", userId);
      return { status: "failed" as const, reason: "max_attempts_exceeded" as const };
    }

    const submitted = String(data.code).trim().replace(/\s+/g, "");
    const submittedHash = await hashCode(submitted);
    if (!row.email_code_hash || submittedHash !== row.email_code_hash) {
      const remaining = Math.max(0, (row.max_attempts ?? 3) - newAttempts);
      return { status: "not_found" as const, attempts_remaining: remaining, reason: "wrong_code" as const };
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("platform_verifications")
      .update({ status: "verified", verified_at: now })
      .eq("id", row.id);
    await supabaseAdmin
      .from("creator_profiles")
      .update({
        verified: true,
        verification_status: "verified",
        verified_platform: row.platform,
        verified_handle: row.handle,
        verified_at: now,
        verification_skipped: false,
      })
      .eq("user_id", userId);
    return {
      status: "verified" as const,
      verified_at: now,
      platform: row.platform as string,
      handle: row.handle as string,
    };
  });

