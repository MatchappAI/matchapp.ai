import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronLeft,
  File,
  Forward,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  executeEmailAction,
  executeThreadAction,
  getInboxThread,
  listInboxThreads,
  markThreadReadState,
  proposeEmailAction,
  proposeThreadAction,
  saveInboxDraft,
  syncGmailInbox,
} from "@/lib/gmail-inbox.functions";
import { getConnectedAccounts, startGmailConnect } from "@/lib/gmail.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/inbox")({
  head: () => ({ meta: [{ title: "Inbox — MatchAI" }] }),
  component: InboxPage,
});

type Folder = "inbox" | "sent" | "drafts" | "archive" | "trash";
type ComposerMode = "send" | "reply" | "reply_all" | "forward";

type AttachmentInput = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  sizeBytes: number;
};

type ComposerState = {
  mode: ComposerMode;
  draftId?: string;
  threadId?: string | null;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  attachments: AttachmentInput[];
};

type Confirmation =
  | {
      kind: "email";
      requestId: string;
      snapshot: Record<string, unknown>;
    }
  | {
      kind: "thread";
      requestId: string;
      snapshot: Record<string, unknown>;
    };

const FOLDERS: Array<{
  id: Folder;
  label: string;
  icon: typeof InboxIcon;
}> = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: File },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

function splitEmails(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function messageTime(message: Record<string, unknown>): string | null {
  return (
    (message.received_at as string | null) ??
    (message.sent_at as string | null) ??
    (message.created_at as string | null)
  );
}

function InboxPage() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(getConnectedAccounts);
  const beginConnect = useServerFn(startGmailConnect);
  const syncInbox = useServerFn(syncGmailInbox);
  const listThreads = useServerFn(listInboxThreads);
  const fetchThread = useServerFn(getInboxThread);
  const saveDraft = useServerFn(saveInboxDraft);
  const proposeEmail = useServerFn(proposeEmailAction);
  const executeEmail = useServerFn(executeEmailAction);
  const proposeThread = useServerFn(proposeThreadAction);
  const executeThread = useServerFn(executeThreadAction);
  const markRead = useServerFn(markThreadReadState);

  const [folder, setFolder] = useState<Folder>("inbox");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: () => fetchAccounts(),
  });
  const gmailAccount = accountsQuery.data?.accounts.find(
    (account) => account.service === "gmail" && account.connected,
  );
  const connected = Boolean(gmailAccount);
  const accountEmail = gmailAccount?.account_email ?? "";

  const threadsQuery = useQuery({
    queryKey: ["gmail-threads", folder, search, unreadOnly, sort],
    queryFn: () =>
      listThreads({
        data: { folder, query: search, unreadOnly, sort },
      }),
    enabled: connected,
  });
  const threads = threadsQuery.data?.threads ?? [];

  const threadQuery = useQuery({
    queryKey: ["gmail-thread", selectedId],
    queryFn: () => fetchThread({ data: { threadId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const connectMutation = useMutation({
    mutationFn: () => beginConnect({ data: { origin: window.location.origin } }),
    onSuccess: (result) => {
      if (result.ok) window.location.assign(result.authorizationUrl);
      else toast.error(result.error);
    },
    onError: (error) => toast.error(String(error)),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncInbox(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-thread"] });
      if (result.ok) toast.success(`Gmail synchronized (${result.synced} threads)`);
      else toast.error(result.error ?? "Some Gmail threads could not synchronize");
    },
    onError: (error) => toast.error(String(error)),
  });

  const readMutation = useMutation({
    mutationFn: (input: { threadId: string; unread: boolean }) => markRead({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-thread"] });
    },
    onError: (error) => toast.error(String(error)),
  });

  const saveMutation = useMutation({
    mutationFn: (state: ComposerState) =>
      saveDraft({
        data: {
          draftId: state.draftId,
          threadId: state.threadId,
          from: state.from,
          to: splitEmails(state.to),
          cc: splitEmails(state.cc),
          bcc: splitEmails(state.bcc),
          replyTo: splitEmails(state.replyTo),
          subject: state.subject,
          body: state.body,
          inReplyTo: state.inReplyTo,
          references: state.references,
          attachments: state.attachments,
        },
      }),
    onSuccess: (result) => {
      setComposer((current) => (current ? { ...current, draftId: result.draft.id } : current));
      toast.success("Draft saved");
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const reviewMutation = useMutation({
    mutationFn: async (state: ComposerState) => {
      const saved = await saveDraft({
        data: {
          draftId: state.draftId,
          threadId: state.threadId,
          from: state.from,
          to: splitEmails(state.to),
          cc: splitEmails(state.cc),
          bcc: splitEmails(state.bcc),
          replyTo: splitEmails(state.replyTo),
          subject: state.subject,
          body: state.body,
          inReplyTo: state.inReplyTo,
          references: state.references,
          attachments: state.attachments,
        },
      });
      return proposeEmail({
        data: {
          action: state.mode,
          draftId: saved.draft.id,
          idempotencyKey: crypto.randomUUID(),
          brandId: threadQuery.data?.thread.brand_match_id ?? null,
          contactId: threadQuery.data?.thread.contact_id ?? null,
          dealId: threadQuery.data?.thread.deal_id ?? null,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.request) {
        toast.error("Could not prepare confirmation");
        return;
      }
      setConfirmation({
        kind: "email",
        requestId: result.request.id,
        snapshot: result.confirmation as Record<string, unknown>,
      });
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const executeMutation = useMutation({
    mutationFn: async (pending: Confirmation) => {
      const result =
        pending.kind === "email"
          ? await executeEmail({ data: { requestId: pending.requestId } })
          : await executeThread({ data: { requestId: pending.requestId } });
      return { ok: result.ok, replay: result.replay };
    },
    onSuccess: (result, pending) => {
      toast.success(
        result.replay
          ? "This approved action was already completed"
          : pending.kind === "email"
            ? "Sent through Gmail"
            : "Gmail thread updated",
      );
      setConfirmation(null);
      if (pending.kind === "email") setComposer(null);
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-thread"] });
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const threadActionMutation = useMutation({
    mutationFn: (input: { action: "archive" | "trash"; threadId: string }) =>
      proposeThread({
        data: {
          ...input,
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    onSuccess: (result) => {
      setConfirmation({
        kind: "thread",
        requestId: result.request.id,
        snapshot: result.confirmation as Record<string, unknown>,
      });
    },
    onError: (error) => toast.error(String(error)),
  });

  const selectedThread = threadQuery.data?.thread as Record<string, unknown> | undefined;
  const messages = (threadQuery.data?.messages ?? []) as Array<Record<string, unknown>>;
  const latestMessage = messages[messages.length - 1];

  function openComposer(mode: ComposerMode) {
    const from = accountEmail;
    if (mode === "send" || !latestMessage || !selectedThread) {
      setComposer({
        mode: "send",
        from,
        to: "",
        cc: "",
        bcc: "",
        replyTo: "",
        subject: "",
        body: "",
        attachments: [],
      });
      return;
    }
    const latestFrom = String(latestMessage.from_address ?? "");
    const originalTo = (latestMessage.to_addresses ?? []) as string[];
    const originalCc = (latestMessage.cc_addresses ?? []) as string[];
    const myAddress = from.toLowerCase();
    const replyAllRecipients = [latestFrom, ...originalTo, ...originalCc].filter(
      (address, index, all) =>
        !address.toLowerCase().includes(myAddress) &&
        all.findIndex((other) => other.toLowerCase() === address.toLowerCase()) === index,
    );
    const subject = String(selectedThread.subject ?? "");
    const messageId = String(latestMessage.gmail_message_id ?? "");
    const references = [String(latestMessage.references_header ?? ""), messageId]
      .filter(Boolean)
      .join(" ");
    setComposer({
      mode,
      threadId: String(selectedThread.id),
      from,
      to:
        mode === "forward" ? "" : mode === "reply_all" ? replyAllRecipients.join(", ") : latestFrom,
      cc:
        mode === "reply_all"
          ? originalCc.filter((address) => !address.toLowerCase().includes(myAddress)).join(", ")
          : "",
      bcc: "",
      replyTo: "",
      subject:
        mode === "forward"
          ? subject.startsWith("Fwd:")
            ? subject
            : `Fwd: ${subject}`
          : subject.startsWith("Re:")
            ? subject
            : `Re: ${subject}`,
      body:
        mode === "forward"
          ? `\n\n---------- Forwarded message ----------\nFrom: ${latestFrom}\nSubject: ${subject}\n\n${String(latestMessage.text_body ?? "")}`
          : "",
      inReplyTo: mode === "forward" ? null : messageId,
      references: mode === "forward" ? null : references,
      attachments: [],
    });
  }

  function selectThread(threadId: string, unread: boolean) {
    setSelectedId(threadId);
    if (unread) readMutation.mutate({ threadId, unread: false });
  }

  if (accountsQuery.isLoading) {
    return <CenteredStatus label="Checking Gmail connection…" />;
  }

  if (!connected) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">Connect Gmail to open your Inbox</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            MatchAI uses your Gmail account for creator outreach, drafts, replies, threads,
            attachments, and delivery state. Sending always requires your exact confirmation.
          </p>
          <Button
            className="mt-6 rounded-xl"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Gmail
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Resend is used only for MatchAI product emails, never creator outreach.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <aside className="hidden w-48 shrink-0 border-r border-border p-3 md:block">
        <Button
          className="mb-4 w-full justify-start rounded-xl"
          onClick={() => openComposer("send")}
        >
          <PenLine className="mr-2 h-4 w-4" /> Compose
        </Button>
        <nav aria-label="Mailbox folders" className="space-y-1">
          {FOLDERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFolder(id);
                setSelectedId(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                folder === id
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section
        className={cn(
          "flex min-w-0 w-full flex-col border-r border-border md:w-[22rem]",
          selectedId && "hidden md:flex",
        )}
      >
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold capitalize">{folder}</h1>
              <p className="text-xs text-muted-foreground">{accountEmail}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label="Compose"
                onClick={() => openComposer("send")}
              >
                <PenLine className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Synchronize Gmail"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
              </Button>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subject or message"
              aria-label="Search Inbox"
              className="rounded-xl pl-9"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setUnreadOnly((value) => !value)}
              className={cn(
                "rounded-lg px-2 py-1 text-xs",
                unreadOnly
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Unread only
            </button>
            <button
              type="button"
              onClick={() => setSort((value) => (value === "newest" ? "oldest" : "newest"))}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {sort === "newest" ? (
                <ArrowDownAZ className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpAZ className="h-3.5 w-3.5" />
              )}
              {sort}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threadsQuery.isLoading ? (
            <CenteredStatus label="Loading Gmail threads…" compact />
          ) : threadsQuery.isError ? (
            <RetryState message="Inbox could not load." onRetry={() => threadsQuery.refetch()} />
          ) : threads.length === 0 ? (
            <div className="p-8 text-center">
              <MailOpen className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No {folder} threads</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Synchronize Gmail or compose a new message.
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => selectThread(thread.id, thread.is_unread)}
                className={cn(
                  "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  selectedId === thread.id && "bg-primary/[0.06]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      "truncate text-sm",
                      thread.is_unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {thread.subject || "(no subject)"}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {displayDate(thread.last_message_at)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 line-clamp-2 text-xs text-muted-foreground",
                    thread.is_unread && "font-medium text-foreground/75",
                  )}
                >
                  {thread.snippet || "No preview available"}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{thread.message_count} messages</span>
                  {thread.sync_status === "failed" && (
                    <span className="text-destructive">Sync failed</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1">
        {!selectedId ? (
          <div className="hidden h-full items-center justify-center p-8 text-center md:flex">
            <div>
              <InboxIcon className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Select a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Threads are synchronized from Gmail.
              </p>
            </div>
          </div>
        ) : threadQuery.isLoading ? (
          <CenteredStatus label="Loading conversation…" />
        ) : threadQuery.isError || !selectedThread ? (
          <RetryState
            message="This conversation could not load."
            onRetry={() => threadQuery.refetch()}
          />
        ) : (
          <div className="flex h-full flex-col">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                  aria-label="Back to thread list"
                  onClick={() => setSelectedId(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    {String(selectedThread.subject || "(no subject)")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {String(selectedThread.message_count)} messages ·{" "}
                    {String(selectedThread.sync_status)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={selectedThread.is_unread ? "Mark read" : "Mark unread"}
                  onClick={() =>
                    readMutation.mutate({
                      threadId: String(selectedThread.id),
                      unread: !selectedThread.is_unread,
                    })
                  }
                >
                  {selectedThread.is_unread ? (
                    <MailOpen className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Archive thread"
                  onClick={() =>
                    threadActionMutation.mutate({
                      action: "archive",
                      threadId: String(selectedThread.id),
                    })
                  }
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move thread to trash"
                  onClick={() =>
                    threadActionMutation.mutate({
                      action: "trash",
                      threadId: String(selectedThread.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3 sm:p-5">
              {messages.map((message) => {
                const outbound = message.direction === "outbound";
                const attachments = (threadQuery.data?.attachments ?? []).filter(
                  (attachment) => attachment.message_id === message.id,
                );
                return (
                  <article
                    key={String(message.id)}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">
                          {String(message.from_address || "Unknown sender")}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          To: {((message.to_addresses ?? []) as string[]).join(", ") || "—"}
                        </p>
                        {((message.cc_addresses ?? []) as string[]).length > 0 && (
                          <p className="break-words text-xs text-muted-foreground">
                            CC: {((message.cc_addresses ?? []) as string[]).join(", ")}
                          </p>
                        )}
                        {outbound && ((message.bcc_addresses ?? []) as string[]).length > 0 && (
                          <p className="break-words text-xs text-muted-foreground">
                            BCC: {((message.bcc_addresses ?? []) as string[]).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {displayDate(messageTime(message))}
                      </span>
                    </div>
                    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {String(message.text_body || "No plain-text body available.")}
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {attachments.map((attachment) => (
                          <span
                            key={attachment.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
                          >
                            <Paperclip className="h-3 w-3" />
                            {attachment.filename}
                          </span>
                        ))}
                      </div>
                    )}
                    {message.sync_status === "failed" && (
                      <p className="mt-3 text-xs text-destructive">
                        Synchronization failed: {String(message.sync_error ?? "Retry sync")}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>

            <footer className="flex flex-wrap gap-2 border-t border-border p-3 sm:px-5">
              <Button variant="outline" onClick={() => openComposer("reply")}>
                <Reply className="mr-2 h-4 w-4" /> Reply
              </Button>
              <Button variant="outline" onClick={() => openComposer("reply_all")}>
                <ReplyAll className="mr-2 h-4 w-4" /> Reply all
              </Button>
              <Button variant="outline" onClick={() => openComposer("forward")}>
                <Forward className="mr-2 h-4 w-4" /> Forward
              </Button>
            </footer>
          </div>
        )}
      </section>

      {composer && (
        <Composer
          state={composer}
          setState={setComposer}
          onClose={() => setComposer(null)}
          onSave={() => saveMutation.mutate(composer)}
          onReview={() => reviewMutation.mutate(composer)}
          busy={saveMutation.isPending || reviewMutation.isPending}
        />
      )}

      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          busy={executeMutation.isPending}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => executeMutation.mutate(confirmation)}
        />
      )}
    </div>
  );
}

function CenteredStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-sm text-muted-foreground",
        compact ? "py-12" : "min-h-64",
      )}
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-medium">{message}</p>
      <Button className="mt-3" variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

function Composer({
  state,
  setState,
  onClose,
  onSave,
  onReview,
  busy,
}: {
  state: ComposerState;
  setState: React.Dispatch<React.SetStateAction<ComposerState | null>>;
  onClose: () => void;
  onSave: () => void;
  onReview: () => void;
  busy: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCopies, setShowCopies] = useState(Boolean(state.cc || state.bcc || state.replyTo));

  function patch(values: Partial<ComposerState>) {
    setState((current) => (current ? { ...current, ...values } : current));
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const additions: AttachmentInput[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10_000_000) {
        toast.error(`${file.name} is larger than 10 MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      additions.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: dataUrl.split(",")[1] ?? "",
        sizeBytes: file.size,
      });
    }
    patch({ attachments: [...state.attachments, ...additions] });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="compose-title" className="font-semibold capitalize">
              {state.mode.replace("_", " ")}
            </h2>
            <p className="text-xs text-muted-foreground">
              Sends through connected Gmail after confirmation
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close composer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <LabeledInput label="From" value={state.from} readOnly />
          <LabeledInput
            label="To"
            value={state.to}
            onChange={(value) => patch({ to: value })}
            placeholder="brand@example.com"
            trailing={
              !showCopies ? (
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={() => setShowCopies(true)}
                >
                  CC · BCC · Reply-To
                </button>
              ) : null
            }
          />
          {showCopies && (
            <>
              <LabeledInput
                label="CC"
                value={state.cc}
                onChange={(value) => patch({ cc: value })}
                placeholder="Comma-separated recipients"
              />
              <LabeledInput
                label="BCC"
                value={state.bcc}
                onChange={(value) => patch({ bcc: value })}
                placeholder="Private recipients"
              />
              <LabeledInput
                label="Reply-To"
                value={state.replyTo}
                onChange={(value) => patch({ replyTo: value })}
                placeholder="Optional reply address"
              />
            </>
          )}
          <LabeledInput
            label="Subject"
            value={state.subject}
            onChange={(value) => patch({ subject: value })}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
            <textarea
              value={state.body}
              onChange={(event) => patch({ body: event.target.value })}
              rows={12}
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {state.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.attachments.map((attachment, index) => (
                <span
                  key={`${attachment.filename}-${index}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3" />
                  {attachment.filename}
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.filename}`}
                    onClick={() =>
                      patch({
                        attachments: state.attachments.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void addFiles(event.target.files)}
          />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Paperclip className="mr-2 h-4 w-4" /> Attach
            </Button>
            <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
              Save draft
            </Button>
          </div>
          <Button
            type="button"
            onClick={onReview}
            disabled={busy || !state.from || !state.to || !state.subject}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Review exact message
          </Button>
        </footer>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  trailing,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        {trailing}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="rounded-xl"
      />
    </label>
  );
}

function ConfirmationDialog({
  confirmation,
  busy,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const snapshot = confirmation.snapshot;
  const fields =
    confirmation.kind === "email"
      ? [
          ["Exact action", snapshot.action],
          ["From", snapshot.from],
          ["To", snapshot.to],
          ["CC", snapshot.cc],
          ["BCC", snapshot.bcc],
          ["Reply-To", snapshot.replyTo],
          ["Subject", snapshot.subject],
          ["Final body", snapshot.body],
          [
            "Attachments",
            (snapshot.attachments as Array<{ filename: string }> | undefined)?.map(
              (attachment) => attachment.filename,
            ),
          ],
          ["Associated brand", snapshot.associatedBrandId],
          ["Associated contact", snapshot.associatedContactId],
          ["Associated deal", snapshot.associatedDealId],
        ]
      : [
          ["Exact action", snapshot.action],
          ["Subject", snapshot.subject],
          ["Associated brand", snapshot.associatedBrandId],
          ["Associated contact", snapshot.associatedContactId],
          ["Associated deal", snapshot.associatedDealId],
        ];
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-semibold">
          Confirm exact action
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review every field. The approved action executes exactly once and is recorded in the audit
          log.
        </p>
        <dl className="mt-4 space-y-3">
          {fields.map(([label, rawValue]) => {
            const value = Array.isArray(rawValue)
              ? rawValue.join(", ")
              : rawValue == null || rawValue === ""
                ? "—"
                : String(rawValue);
            return (
              <div key={String(label)}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {String(label)}
                </dt>
                <dd
                  className={cn(
                    "mt-1 break-words text-sm",
                    label === "Final body" &&
                      "max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted p-3",
                  )}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm and execute once
          </Button>
        </div>
      </div>
    </div>
  );
}
