import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCreatorEmailTransport } from "@/lib/creator-email-transport.server";

const db = supabaseAdmin as unknown as SupabaseClient;
const email = z.string().trim().email().max(320);
const emailList = z.array(email).max(50).default([]);

export const syncEmailInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const result = await getCreatorEmailTransport().synchronize();
    return result.ok
      ? { ...result, reconnect: false, error: null }
      : { ...result, synced: 0, failed: 0, reconnect: false };
  });

export const listInboxThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        folder: z.enum(["inbox", "sent", "drafts", "archive", "trash"]).default("inbox"),
        query: z.string().trim().max(200).default(""),
        unreadOnly: z.boolean().default(false),
        sort: z.enum(["newest", "oldest"]).default("newest"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = db
      .from("email_threads")
      .select(
        "id,provider_thread_id,subject,snippet,folder,is_unread,message_count,last_message_at,brand_match_id,contact_id,deal_id,sync_status,sync_error",
      )
      .eq("user_id", context.userId)
      .eq("folder", data.folder)
      .order("last_message_at", { ascending: data.sort === "oldest" })
      .limit(100);
    if (data.unreadOnly) query = query.eq("is_unread", true);
    if (data.query) {
      const safe = data.query.replace(/[%_,()]/g, " ").trim();
      if (safe) query = query.or(`subject.ilike.%${safe}%,snippet.ilike.%${safe}%`);
    }
    const { data: threads, error: listError } = await query;
    if (listError) throw new Error("Could not load Inbox");
    return { threads: threads ?? [] };
  });

export const getInboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: thread } = await db
      .from("email_threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    const [{ data: messages }, { data: attachments }] = await Promise.all([
      db
        .from("email_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true }),
      db
        .from("email_attachments")
        .select("id,message_id,draft_id,filename,mime_type,size_bytes,provider_attachment_id")
        .eq("user_id", context.userId),
    ]);
    return { thread, messages: messages ?? [], attachments: attachments ?? [] };
  });

const DraftSchema = z
  .object({
    draftId: z.string().uuid().optional(),
    threadId: z.string().uuid().nullable().optional(),
    from: email,
    to: emailList,
    cc: emailList,
    bcc: emailList,
    replyTo: emailList,
    subject: z.string().max(998).default(""),
    body: z.string().max(500_000).default(""),
    inReplyTo: z.string().max(998).nullable().optional(),
    references: z.string().max(8_000).nullable().optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().trim().min(1).max(255),
          mimeType: z.string().trim().min(1).max(255),
          contentBase64: z.string().max(14_000_000),
          sizeBytes: z.number().int().min(0).max(10_000_000),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine((draft) => draft.to.length + draft.cc.length + draft.bcc.length > 0, {
    message: "Add at least one recipient",
  });

export const saveInboxDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftSchema.parse(input))
  .handler(async ({ context, data }) => {
    const values = {
      user_id: context.userId,
      thread_id: data.threadId ?? null,
      from_address: data.from,
      to_addresses: data.to,
      cc_addresses: data.cc,
      bcc_addresses: data.bcc,
      reply_to_addresses: data.replyTo,
      subject: data.subject,
      text_body: data.body,
      in_reply_to: data.inReplyTo ?? null,
      references_header: data.references ?? null,
      status: "draft",
      sync_status: "pending",
      sync_error: null,
    };
    const operation = data.draftId
      ? db.from("email_drafts").update(values).eq("id", data.draftId).eq("user_id", context.userId)
      : db.from("email_drafts").insert(values);
    const { data: draft, error: draftError } = await operation.select("*").single();
    if (draftError || !draft) throw new Error("Could not save draft");

    await db.from("email_attachments").delete().eq("draft_id", draft.id);
    if (data.attachments.length > 0) {
      await db.from("email_attachments").insert(
        data.attachments.map((attachment) => ({
          user_id: context.userId,
          draft_id: draft.id,
          filename: attachment.filename,
          mime_type: attachment.mimeType,
          size_bytes: attachment.sizeBytes,
          content_base64: attachment.contentBase64,
        })),
      );
    }
    return { draft };
  });

export const proposeEmailAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        action: z.enum(["send", "reply", "reply_all", "forward"]),
        draftId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        brandId: z.string().uuid().nullable().optional(),
        contactId: z.string().uuid().nullable().optional(),
        dealId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const [{ data: draft }, { data: attachments }] = await Promise.all([
      db
        .from("email_drafts")
        .select("*")
        .eq("id", data.draftId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      db
        .from("email_attachments")
        .select("id,filename,mime_type,size_bytes")
        .eq("draft_id", data.draftId)
        .eq("user_id", context.userId),
    ]);
    if (!draft) throw new Error("Draft not found");
    const snapshot = {
      action: data.action,
      from: draft.from_address,
      to: draft.to_addresses,
      cc: draft.cc_addresses,
      bcc: draft.bcc_addresses,
      replyTo: draft.reply_to_addresses,
      subject: draft.subject,
      body: draft.text_body,
      attachments: attachments ?? [],
      associatedBrandId: data.brandId ?? null,
      associatedContactId: data.contactId ?? null,
      associatedDealId: data.dealId ?? null,
    };
    const { data: request, error: requestError } = await db
      .from("email_action_requests")
      .upsert(
        {
          user_id: context.userId,
          action: data.action,
          draft_id: draft.id,
          thread_id: draft.thread_id,
          confirmation_snapshot: snapshot,
          idempotency_key: data.idempotencyKey,
          status: "pending",
        },
        { onConflict: "user_id,idempotency_key", ignoreDuplicates: true },
      )
      .select("*")
      .maybeSingle();
    if (requestError) throw new Error("Could not prepare confirmation");
    const existing =
      request ??
      (
        await db
          .from("email_action_requests")
          .select("*")
          .eq("user_id", context.userId)
          .eq("idempotency_key", data.idempotencyKey)
          .single()
      ).data;
    return { request: existing, confirmation: snapshot };
  });

export const executeEmailAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: claimed } = await db
      .from("email_action_requests")
      .update({
        status: "executing",
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (!claimed) {
      const { data: existing } = await db
        .from("email_action_requests")
        .select("status,result,error_message")
        .eq("id", data.requestId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (existing?.status === "completed") {
        return { ok: true, replay: true, result: existing.result };
      }
      throw new Error(
        existing?.error_message ?? "This action is already processing or unavailable",
      );
    }

    try {
      const [{ data: draft }, { data: attachments }] = await Promise.all([
        db
          .from("email_drafts")
          .select("*")
          .eq("id", claimed.draft_id)
          .eq("user_id", context.userId)
          .single(),
        db
          .from("email_attachments")
          .select("filename,mime_type,content_base64")
          .eq("draft_id", claimed.draft_id)
          .eq("user_id", context.userId),
      ]);
      if (!draft) throw new Error("Draft not found");
      let providerThreadId: string | undefined;
      if (draft.thread_id) {
        const { data: thread } = await db
          .from("email_threads")
          .select("provider_thread_id")
          .eq("id", draft.thread_id)
          .eq("user_id", context.userId)
          .maybeSingle();
        providerThreadId = thread?.provider_thread_id;
      }
      const sent = await getCreatorEmailTransport().send({
        from: draft.from_address,
        to: draft.to_addresses as string[],
        cc: draft.cc_addresses as string[],
        bcc: draft.bcc_addresses as string[],
        replyTo: draft.reply_to_addresses as string[],
        subject: draft.subject,
        body: draft.text_body,
        inReplyTo: draft.in_reply_to ?? undefined,
        references: draft.references_header ?? undefined,
        providerThreadId,
        idempotencyKey: claimed.idempotency_key,
        attachments: (attachments ?? []).map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mime_type,
          contentBase64: attachment.content_base64,
        })),
      });
      if (!sent.ok) throw new Error(sent.error);

      const now = new Date().toISOString();
      const { data: storedThread, error: threadError } = await db
        .from("email_threads")
        .upsert(
          {
            user_id: context.userId,
            provider_thread_id: sent.providerThreadId,
            subject: draft.subject,
            snippet: draft.text_body.slice(0, 240),
            folder: "sent",
            is_unread: false,
            message_count: 1,
            last_message_at: now,
            last_synced_at: now,
            sync_status: "synced",
            sync_error: null,
          },
          { onConflict: "user_id,provider_thread_id" },
        )
        .select("id")
        .single();
      if (threadError || !storedThread) {
        throw new Error("Provider sent the message, but local synchronization failed");
      }
      await db.from("email_messages").upsert(
        {
          user_id: context.userId,
          thread_id: storedThread.id,
          provider_message_id: sent.providerMessageId,
          direction: "outbound",
          from_address: draft.from_address,
          to_addresses: draft.to_addresses,
          cc_addresses: draft.cc_addresses,
          bcc_addresses: draft.bcc_addresses,
          reply_to_addresses: draft.reply_to_addresses,
          subject: draft.subject,
          text_body: draft.text_body,
          sent_at: now,
          provider_labels: ["sent"],
          in_reply_to: draft.in_reply_to,
          references_header: draft.references_header,
          sync_status: "synced",
          sync_error: null,
        },
        { onConflict: "user_id,provider_message_id" },
      );
      const result = {
        providerMessageId: sent.providerMessageId,
        providerThreadId: sent.providerThreadId,
      };
      await Promise.all([
        db
          .from("email_drafts")
          .update({ status: "sent", sync_status: "synced", sync_error: null })
          .eq("id", draft.id),
        db
          .from("email_action_requests")
          .update({
            status: "completed",
            executed_at: new Date().toISOString(),
            result,
            error_message: null,
          })
          .eq("id", claimed.id),
        db.from("agent_audit_log").insert({
          user_id: context.userId,
          action: `email_${claimed.action}`,
          target_type: "email_thread",
          target_id: sent.providerThreadId,
          metadata: {
            idempotency_key: claimed.idempotency_key,
            request_id: claimed.id,
            confirmation_snapshot: claimed.confirmation_snapshot,
            provider_message_id: sent.providerMessageId,
          },
        }),
      ]);
      return { ok: true, replay: false, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email action failed";
      await db
        .from("email_action_requests")
        .update({ status: "failed", error_message: message })
        .eq("id", claimed.id);
      await db
        .from("email_drafts")
        .update({ status: "failed", sync_status: "failed", sync_error: message })
        .eq("id", claimed.draft_id);
      throw new Error(message);
    }
  });

export const proposeThreadAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        action: z.enum(["archive", "trash"]),
        threadId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: thread } = await db
      .from("email_threads")
      .select("id,subject,provider_thread_id,brand_match_id,contact_id,deal_id")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    const snapshot = {
      action: data.action,
      subject: thread.subject,
      associatedBrandId: thread.brand_match_id,
      associatedContactId: thread.contact_id,
      associatedDealId: thread.deal_id,
    };
    const { data: request } = await db
      .from("email_action_requests")
      .upsert(
        {
          user_id: context.userId,
          action: data.action,
          thread_id: thread.id,
          confirmation_snapshot: snapshot,
          idempotency_key: data.idempotencyKey,
          status: "pending",
        },
        { onConflict: "user_id,idempotency_key" },
      )
      .select("*")
      .single();
    return { request, confirmation: snapshot };
  });

export const executeThreadAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: request } = await db
      .from("email_action_requests")
      .update({ status: "executing", approved_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .in("action", ["archive", "trash"])
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (!request) {
      const { data: existing } = await db
        .from("email_action_requests")
        .select("status,result")
        .eq("id", data.requestId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (existing?.status === "completed") {
        return { ok: true, replay: true, result: existing.result };
      }
      throw new Error("This action is already processing or unavailable");
    }
    const { data: thread } = await db
      .from("email_threads")
      .select("provider_thread_id")
      .eq("id", request.thread_id)
      .eq("user_id", context.userId)
      .single();
    if (!thread) throw new Error("Thread not found");
    const folder = request.action === "trash" ? "trash" : "archive";
    await Promise.all([
      db
        .from("email_threads")
        .update({ folder, sync_status: "synced", sync_error: null })
        .eq("id", request.thread_id),
      db
        .from("email_action_requests")
        .update({
          status: "completed",
          executed_at: new Date().toISOString(),
          result: { folder },
        })
        .eq("id", request.id),
      db.from("agent_audit_log").insert({
        user_id: context.userId,
        action: `email_${request.action}`,
        target_type: "email_thread",
        target_id: thread.provider_thread_id,
        metadata: {
          idempotency_key: request.idempotency_key,
          request_id: request.id,
        },
      }),
    ]);
    return { ok: true, replay: false, result: { folder } };
  });

export const markThreadReadState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threadId: z.string().uuid(), unread: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: thread } = await db
      .from("email_threads")
      .select("provider_thread_id")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    await db
      .from("email_threads")
      .update({ is_unread: data.unread })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    await db.from("agent_audit_log").insert({
      user_id: context.userId,
      action: data.unread ? "email_mark_unread" : "email_mark_read",
      target_type: "email_thread",
      target_id: thread.provider_thread_id,
      metadata: {},
    });
    return { ok: true };
  });
