import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshGmailAccessToken, sendGmailFor } from "@/lib/gmail.functions";

const db = supabaseAdmin as unknown as SupabaseClient;
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const email = z.string().trim().email().max(320);
const emailList = z.array(email).max(50).default([]);

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

function decodeBase64Url(value?: string): string {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function header(part: GmailPart | undefined, name: string): string {
  return part?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function addresses(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function bodyFromPart(part: GmailPart | undefined): {
  text: string;
  html: string;
} {
  if (!part) return { text: "", html: "" };
  const children = part.parts ?? [];
  if (children.length === 0) {
    const decoded = decodeBase64Url(part.body?.data);
    return {
      text: part.mimeType === "text/plain" ? decoded : "",
      html: part.mimeType === "text/html" ? decoded : "",
    };
  }
  return children.reduce(
    (result, child) => {
      const nested = bodyFromPart(child);
      return {
        text: result.text || nested.text,
        html: result.html || nested.html,
      };
    },
    { text: "", html: "" },
  );
}

function attachmentParts(part: GmailPart | undefined): Array<{
  gmailAttachmentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (!part) return [];
  const own =
    part.filename && (part.body?.attachmentId || part.body?.data)
      ? [
          {
            gmailAttachmentId: part.body.attachmentId ?? null,
            filename: part.filename,
            mimeType: part.mimeType ?? "application/octet-stream",
            sizeBytes: part.body?.size ?? 0,
          },
        ]
      : [];
  return [...own, ...(part.parts ?? []).flatMap((child) => attachmentParts(child))];
}

function folderFor(labels: string[]): "inbox" | "sent" | "drafts" | "archive" | "trash" {
  if (labels.includes("TRASH")) return "trash";
  if (labels.includes("DRAFT")) return "drafts";
  if (labels.includes("INBOX")) return "inbox";
  if (labels.includes("SENT")) return "sent";
  return "archive";
}

async function gmailFetch<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T; accountEmail: string | null }
  | { ok: false; error: string; reconnect: boolean }
> {
  const token = await getFreshGmailAccessToken(userId);
  if (!token.ok) {
    return {
      ok: false,
      error: token.error,
      reconnect: token.error.toLowerCase().includes("reconnect"),
    };
  }
  const response = await fetch(`${GMAIL_API}/users/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[gmail-inbox]", path, response.status, detail);
    return {
      ok: false,
      error:
        response.status === 401
          ? "Gmail access expired. Reconnect Gmail."
          : "Gmail synchronization failed. Try again.",
      reconnect: response.status === 401,
    };
  }
  return {
    ok: true,
    data: (await response.json()) as T,
    accountEmail: token.email,
  };
}

async function syncOneThread(
  userId: string,
  gmailThreadId: string,
  accountEmail: string | null,
): Promise<void> {
  const response = await gmailFetch<{ messages?: GmailMessage[] }>(
    userId,
    `/threads/${encodeURIComponent(gmailThreadId)}?format=full`,
  );
  if (!response.ok) throw new Error(response.error);
  const messages = response.data.messages ?? [];
  if (messages.length === 0) return;
  const newest = messages[messages.length - 1];
  const allLabels = [...new Set(messages.flatMap((message) => message.labelIds ?? []))];
  const subject =
    [...messages]
      .reverse()
      .map((message) => header(message.payload, "Subject"))
      .find(Boolean) ?? "(no subject)";
  const { data: thread, error: threadError } = await db
    .from("email_threads")
    .upsert(
      {
        user_id: userId,
        gmail_thread_id: gmailThreadId,
        subject,
        snippet: newest.snippet ?? "",
        folder: folderFor(allLabels),
        is_unread: allLabels.includes("UNREAD"),
        message_count: messages.length,
        last_message_at: newest.internalDate
          ? new Date(Number(newest.internalDate)).toISOString()
          : new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
        sync_error: null,
      },
      { onConflict: "user_id,gmail_thread_id" },
    )
    .select("id")
    .single();
  if (threadError || !thread) throw new Error("Could not store Gmail thread");

  for (const message of messages) {
    const from = header(message.payload, "From");
    const mine = !!accountEmail && from.toLowerCase().includes(accountEmail.toLowerCase());
    const parsedBody = bodyFromPart(message.payload);
    const { data: storedMessage, error: messageError } = await db
      .from("email_messages")
      .upsert(
        {
          user_id: userId,
          thread_id: thread.id,
          gmail_message_id: message.id,
          direction: mine ? "outbound" : "inbound",
          from_address: from,
          to_addresses: addresses(header(message.payload, "To")),
          cc_addresses: addresses(header(message.payload, "Cc")),
          // Gmail does not reveal another sender's BCC list.
          bcc_addresses: mine ? addresses(header(message.payload, "Bcc")) : [],
          reply_to_addresses: addresses(header(message.payload, "Reply-To")),
          subject: header(message.payload, "Subject"),
          text_body: parsedBody.text,
          html_body: parsedBody.html,
          sent_at:
            mine && message.internalDate
              ? new Date(Number(message.internalDate)).toISOString()
              : null,
          received_at:
            !mine && message.internalDate
              ? new Date(Number(message.internalDate)).toISOString()
              : null,
          gmail_label_ids: message.labelIds ?? [],
          in_reply_to: header(message.payload, "In-Reply-To") || null,
          references_header: header(message.payload, "References") || null,
          sync_status: "synced",
          sync_error: null,
        },
        { onConflict: "user_id,gmail_message_id" },
      )
      .select("id")
      .single();
    if (messageError || !storedMessage) {
      throw new Error("Could not store Gmail message");
    }
    const attachments = attachmentParts(message.payload);
    if (attachments.length > 0) {
      await db.from("email_attachments").delete().eq("message_id", storedMessage.id);
      await db.from("email_attachments").insert(
        attachments.map((attachment) => ({
          user_id: userId,
          message_id: storedMessage.id,
          gmail_attachment_id: attachment.gmailAttachmentId,
          filename: attachment.filename,
          mime_type: attachment.mimeType,
          size_bytes: attachment.sizeBytes,
        })),
      );
    }
  }
}

export const syncGmailInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const list = await gmailFetch<{
      threads?: Array<{ id: string }>;
    }>(context.userId, "/threads?maxResults=100&q=newer_than:90d");
    if (!list.ok) return list;
    const threadIds = (list.data.threads ?? []).map((thread) => thread.id);
    let synced = 0;
    const errors: string[] = [];
    for (const threadId of threadIds) {
      try {
        await syncOneThread(context.userId, threadId, list.accountEmail);
        synced += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Sync failed");
      }
    }
    await supabaseAdmin
      .from("connected_accounts")
      .update({
        account_metadata: {
          sync_status: errors.length ? "failed" : "synced",
          last_synced_at: new Date().toISOString(),
          sync_error: errors[0] ?? null,
        },
      })
      .eq("user_id", context.userId)
      .eq("service", "gmail");
    return {
      ok: errors.length === 0,
      synced,
      failed: errors.length,
      error: errors[0] ?? null,
      reconnect: false,
    };
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
        "id,gmail_thread_id,subject,snippet,folder,is_unread,message_count,last_message_at,brand_match_id,contact_id,deal_id,sync_status,sync_error",
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
        .select("id,message_id,draft_id,filename,mime_type,size_bytes,gmail_attachment_id")
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
      let gmailThreadId: string | undefined;
      if (draft.thread_id) {
        const { data: thread } = await db
          .from("email_threads")
          .select("gmail_thread_id")
          .eq("id", draft.thread_id)
          .eq("user_id", context.userId)
          .maybeSingle();
        gmailThreadId = thread?.gmail_thread_id;
      }
      const sent = await sendGmailFor({
        userId: context.userId,
        fromOverride: draft.from_address,
        to: draft.to_addresses as string[],
        cc: draft.cc_addresses as string[],
        bcc: draft.bcc_addresses as string[],
        replyTo: draft.reply_to_addresses as string[],
        subject: draft.subject,
        body: draft.text_body,
        inReplyTo: draft.in_reply_to ?? undefined,
        references: draft.references_header ?? undefined,
        threadId: gmailThreadId,
        attachments: (attachments ?? []).map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mime_type,
          contentBase64: attachment.content_base64,
        })),
      });
      if (!sent.ok) throw new Error(sent.error);

      await syncOneThread(context.userId, sent.threadId, draft.from_address);
      const result = {
        gmailMessageId: sent.messageId,
        gmailThreadId: sent.threadId,
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
          action: `gmail_${claimed.action}`,
          target_type: "email_thread",
          target_id: sent.threadId,
          metadata: {
            idempotency_key: claimed.idempotency_key,
            request_id: claimed.id,
            confirmation_snapshot: claimed.confirmation_snapshot,
            gmail_message_id: sent.messageId,
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
      .select("id,subject,gmail_thread_id,brand_match_id,contact_id,deal_id")
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
      .select("gmail_thread_id")
      .eq("id", request.thread_id)
      .eq("user_id", context.userId)
      .single();
    if (!thread) throw new Error("Thread not found");
    const trash = request.action === "trash";
    const response = await gmailFetch(
      context.userId,
      `/threads/${encodeURIComponent(thread.gmail_thread_id)}/modify`,
      {
        method: "POST",
        body: JSON.stringify({
          addLabelIds: trash ? ["TRASH"] : [],
          removeLabelIds: trash ? ["INBOX"] : ["INBOX"],
        }),
      },
    );
    if (!response.ok) throw new Error(response.error);
    const folder = trash ? "trash" : "archive";
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
        action: `gmail_${request.action}`,
        target_type: "email_thread",
        target_id: thread.gmail_thread_id,
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
      .select("gmail_thread_id")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    const response = await gmailFetch(
      context.userId,
      `/threads/${encodeURIComponent(thread.gmail_thread_id)}/modify`,
      {
        method: "POST",
        body: JSON.stringify({
          addLabelIds: data.unread ? ["UNREAD"] : [],
          removeLabelIds: data.unread ? [] : ["UNREAD"],
        }),
      },
    );
    if (!response.ok) throw new Error(response.error);
    await db
      .from("email_threads")
      .update({ is_unread: data.unread })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    await db.from("agent_audit_log").insert({
      user_id: context.userId,
      action: data.unread ? "gmail_mark_unread" : "gmail_mark_read",
      target_type: "email_thread",
      target_id: thread.gmail_thread_id,
      metadata: {},
    });
    return { ok: true };
  });
