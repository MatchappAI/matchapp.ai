import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  TrendingUp,
  Sparkles,
  Inbox,
  Mail,
  Reply,
  Check,
  MessageSquare,
  Copy,
  Loader2,
  Send,
  Wand2,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendOutreachFromChat, saveDraftFromChat } from "@/lib/matchai.functions";
import { cn } from "@/lib/utils";

type Props = {
  type: string;
  output: unknown;
  messageId?: string;
  onQuickPrompt: (prompt: string) => void;
  onNavigate: (to: string) => void;
};

type BrandItem = {
  id: string;
  brand_name: string;
  brand_industry?: string | null;
  fit_score?: number | null;
  fit_quality_score?: number | null;
  estimated_deal_min?: number | null;
  estimated_deal_max?: number | null;
  my_take?: string | null;
};

type ReplyItem = {
  id: string;
  approval_type: string;
  brand_name?: string | null;
  amount?: number | null;
};

type Earnings = {
  monthEarned: number;
  yearEarned: number;
  pendingRelease: number;
  inFlight: number;
  paidDeals: number;
  totalDeals: number;
};

/**
 * Renders inline visual cards produced by non-approval agent tools:
 *  - brand_list, reply_list, earnings, next_prompts, outreach_draft, reply_draft,
 *    attachment_suggestion, email_thread
 * Everything is actionable in place so the creator never has to leave chat.
 */
export function InlineToolCard({ type, output, messageId, onQuickPrompt, onNavigate }: Props) {
  if (!output || typeof output !== "object") return null;
  const data = output as Record<string, unknown>;
  const kind = (data.kind as string | undefined) ?? type;

  if (kind === "brand_list") {
    const items = (data.items as BrandItem[] | undefined) ?? [];
    if (!items.length) {
      return (
        <div className="mt-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          No brand matches yet. Ask me to find some.
        </div>
      );
    }
    return (
      <div className="mt-2 space-y-1.5">
        {items.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="h-7 rounded-full px-3 text-[11px]"
              onClick={() =>
                onQuickPrompt(
                  `Draft personalized pitches for all ${items.length} of these brands — one at a time, show me each in chat so I can review and hit Send.`,
                )
              }
            >
              <Zap className="mr-1 h-3 w-3" /> Draft all {items.length}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-3 text-[11px]"
              onClick={() =>
                onQuickPrompt(
                  `Review my whole pipeline — rank these ${items.length} brands by fastest-to-cash and tell me which 3 to hit first.`,
                )
              }
            >
              <Sparkles className="mr-1 h-3 w-3" /> Rank & pick top 3
            </Button>
          </div>
        )}
        {items.map((b) => {
          const score = b.fit_quality_score ?? b.fit_score;
          const range =
            b.estimated_deal_min && b.estimated_deal_max
              ? `$${b.estimated_deal_min.toLocaleString()}–$${b.estimated_deal_max.toLocaleString()}`
              : null;
          return (
            <div
              key={b.id}
              className="rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground break-words">{b.brand_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground break-words">
                    {b.brand_industry ?? "—"}
                    {range ? ` · ${range}` : ""}
                  </p>
                </div>
                {typeof score === "number" && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {Math.round(score)}%
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  className="h-6 rounded-full px-2.5 text-[10.5px]"
                  onClick={() => onQuickPrompt(`Draft the pitch to ${b.brand_name}`)}
                >
                  <Mail className="mr-1 h-3 w-3" /> Draft pitch
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-full px-2.5 text-[10.5px]"
                  onClick={() =>
                    onQuickPrompt(
                      `Tell me more about ${b.brand_name} — why it fits and what to lead with`,
                    )
                  }
                >
                  Why it fits
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-full px-2.5 text-[10.5px]"
                  onClick={() => onQuickPrompt(`What should I charge ${b.brand_name}?`)}
                >
                  Set price
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === "reply_list") {
    const items = (data.items as ReplyItem[] | undefined) ?? [];
    if (!items.length) {
      return (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          <Inbox className="h-3.5 w-3.5" />
          Nothing waiting on you right now.
        </div>
      );
    }
    const replyCount = items.filter((r) => r.approval_type === "reply_received").length;
    return (
      <div className="mt-2 space-y-1.5">
        {items.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {replyCount > 1 && (
              <Button
                size="sm"
                className="h-7 rounded-full px-3 text-[11px]"
                onClick={() =>
                  onQuickPrompt(
                    `Draft replies for all ${replyCount} pending brand replies — walk me through them one by one in chat so I can approve each.`,
                  )
                }
              >
                <Zap className="mr-1 h-3 w-3" /> Draft all {replyCount} replies
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-3 text-[11px]"
              onClick={() =>
                onQuickPrompt(
                  `Go through every pending item here one by one — show me the context, your recommendation, and let me approve or skip inline.`,
                )
              }
            >
              <ArrowRight className="mr-1 h-3 w-3" /> Handle all inline
            </Button>
          </div>
        )}
        {items.map((r) => {
          const brand = r.brand_name ?? "brand";
          const isReply = r.approval_type === "reply_received";
          return (
            <div
              key={r.id}
              className="rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{brand}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-muted-foreground break-words">
                    {r.approval_type.replace(/_/g, " ")}
                    {r.amount ? ` · $${Number(r.amount).toLocaleString()}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  className="h-6 rounded-full px-2.5 text-[10.5px]"
                  onClick={() =>
                    onQuickPrompt(
                      isReply
                        ? `Show the ${brand} thread and draft my reply`
                        : `Open the ${brand} approval and walk me through it`,
                    )
                  }
                >
                  {isReply ? (
                    <>
                      <Reply className="mr-1 h-3 w-3" /> Draft reply
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-1 h-3 w-3" /> Handle it
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-full px-2.5 text-[10.5px]"
                  onClick={() => onQuickPrompt(`Show me the full ${brand} email thread`)}
                >
                  <MessageSquare className="mr-1 h-3 w-3" /> View thread
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === "earnings") {
    const e = data as unknown as Earnings;
    const items: Array<{ label: string; value: string; tone?: "good" | "warn" }> = [
      { label: "Earned this month", value: `$${e.monthEarned.toLocaleString()}`, tone: "good" },
      { label: "Year to date", value: `$${e.yearEarned.toLocaleString()}` },
      {
        label: "Awaiting external update",
        value: `$${e.pendingRelease.toLocaleString()}`,
        tone: "warn",
      },
      { label: "In flight", value: `$${e.inFlight.toLocaleString()}` },
    ];
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          Earnings snapshot
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {items.map((i) => (
            <div key={i.label} className="rounded-lg bg-foreground/[0.03] px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {i.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-semibold",
                  i.tone === "good" && "text-emerald-500",
                  i.tone === "warn" && "text-amber-500",
                )}
              >
                {i.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {e.paidDeals} of {e.totalDeals} deals paid.
        </p>
      </div>
    );
  }

  if (kind === "next_prompts") {
    const prompts = (data.prompts as string[] | undefined) ?? [];
    if (!prompts.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <Button
            key={p}
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() => onQuickPrompt(p)}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {p}
          </Button>
        ))}
      </div>
    );
  }

  if (kind === "outreach_draft" || kind === "reply_draft") {
    return (
      <InlineDraftCard
        data={data}
        kind={kind}
        messageId={messageId}
        onQuickPrompt={onQuickPrompt}
        onNavigate={onNavigate}
      />
    );
  }

  if (kind === "attachment_suggestion") {
    const names = (data.names as string[] | undefined) ?? [];
    const reason = data.reason as string | undefined;
    const brandName = (data.brandName as string | undefined) ?? "this brand";
    if (!names.length) return null;
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-xs">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Attach to {brandName}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <span
              key={n}
              className="rounded-full border border-border/60 bg-foreground/[0.03] px-2 py-0.5 text-[11px] text-foreground"
            >
              {n}
            </span>
          ))}
        </div>
        {reason && <p className="mt-1.5 text-[11px] text-muted-foreground">{reason}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="h-6 rounded-full px-2.5 text-[10.5px]"
            onClick={() =>
              onQuickPrompt(`Attach those to the ${brandName} draft and show me the updated email`)
            }
          >
            <Check className="mr-1 h-3 w-3" /> Attach & show
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "email_thread") {
    const brandName = (data.brandName as string | undefined) ?? "Brand";
    const subject = data.subject as string | undefined;
    const body = data.body as string | undefined;
    const sentAt = data.sentAt as string | null | undefined;
    const brandReply = data.brandReply as string | null | undefined;
    const replied = Boolean(data.replied);
    const error = data.error as string | undefined;
    if (error) {
      return (
        <div className="mt-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          <MessageSquare className="mr-1 inline h-3 w-3" />
          {error}
        </div>
      );
    }
    const fmt = (iso?: string | null) =>
      iso
        ? new Date(iso).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null;
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-card/80 text-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-foreground/[0.03] px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Conversation with {brandName}
          </div>
          {sentAt && <span className="text-[10px] text-muted-foreground">{fmt(sentAt)}</span>}
        </div>
        <div className="space-y-1 border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Check className="h-3 w-3" />
            You sent
          </div>
          {subject && <p className="text-[12.5px] font-semibold text-foreground">{subject}</p>}
          {body && (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
              {body}
            </p>
          )}
        </div>
        <div className="space-y-1 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            <Reply className="h-3 w-3" />
            {brandName} replied
          </div>
          {replied && brandReply ? (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
              {brandReply}
            </p>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">
              No reply yet — I'll ping you the second it lands.
            </p>
          )}
        </div>
        {replied && (
          <div className="flex items-center justify-end gap-1.5 border-t border-border/60 bg-foreground/[0.02] px-2 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-full px-3 text-[11px]"
              onClick={() => onQuickPrompt(`Draft my reply to ${brandName}`)}
            >
              <Reply className="mr-1 h-3 w-3" />
              Draft reply
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

/* ---------------- Inline draft (Copy / Mark sent / Send from chat) ---------------- */

function InlineDraftCard({
  data,
  kind,
  messageId,
  onQuickPrompt,
  onNavigate,
}: {
  data: Record<string, unknown>;
  kind: "outreach_draft" | "reply_draft";
  messageId?: string;
  onQuickPrompt: (prompt: string) => void;
  onNavigate: (to: string) => void;
}) {
  const isReply = kind === "reply_draft";
  const brandName = (data.brandName as string | undefined) ?? "Brand";
  const outreachId = data.outreachId as string | undefined;
  const approvalId = (data.approvalId as string | null | undefined) ?? null;
  const initialSubject =
    (data.subject as string | undefined) ?? (isReply ? `Re: ${brandName}` : "");
  const initialBody = (data.body as string | undefined) ?? "";
  const initialTo = (data.toEmail as string | undefined) ?? "";

  const send = useServerFn(sendOutreachFromChat);
  const saveDraft = useServerFn(saveDraftFromChat);

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [to, setTo] = useState(initialTo);

  const [busy, setBusy] = useState<"send" | "mark" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "sent" | "marked">("pending");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isFirstRun = useRef(true);

  const Icon = isReply ? Reply : Mail;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const canServerAct = Boolean(messageId && outreachId);
  const isDoneForSave = status !== "pending";

  // Debounced autosave — only when we have an outreachId, still pending, and edits happened.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!outreachId || isDoneForSave) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const res = await saveDraft({
          data: { outreachId, to, subject, body },
        });
        if (res.ok) {
          setSavedAt(res.savedAt);
          setSaveState("saved");
        } else {
          setSaveState("idle");
        }
      } catch {
        setSaveState("idle");
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, to, outreachId, isDoneForSave]);

  const handleCopy = async () => {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  const handleAct = async (mode: "send" | "mark") => {
    if (!canServerAct) {
      onNavigate("/dashboard/approvals");
      return;
    }
    setError(null);
    if (mode === "send" && !emailValid) {
      setError("Add a valid recipient email to send.");
      return;
    }
    setBusy(mode);
    try {
      const res = await send({
        data: {
          messageId: messageId!,
          outreachId: outreachId!,
          approvalId,
          to: to.trim(),
          subject: subject.trim(),
          body,
          mode: mode === "send" ? "send" : "mark_sent",
          autonomyLevel:
            typeof window !== "undefined"
              ? Math.max(
                  0,
                  Math.min(3, Number(localStorage.getItem("matchai:autonomy") ?? "2") || 0),
                )
              : undefined,
        },
      });
      if (res.ok) {
        setStatus(mode === "send" ? "sent" : "marked");
        setSentAt(res.sentAt ?? new Date().toISOString());
      } else {
        setError(res.error ?? "Action failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const isDone = status !== "pending";

  return (
    <div
      className={cn(
        "mt-2 overflow-hidden rounded-xl border bg-card/80 text-xs",
        isDone ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-foreground/[0.03] px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" />
          {isReply ? `Reply to ${brandName}` : `Pitch to ${brandName}`}
        </div>
        {isDone ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
            <Check className="h-3 w-3" />
            {status === "sent" ? "Sent" : "Logged"}
            {sentAt
              ? ` · ${new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
        ) : outreachId ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px]",
              saveState === "saving" ? "text-muted-foreground" : "text-emerald-600/80",
            )}
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : saveState === "saved" && savedAt ? (
              <>
                <Check className="h-3 w-3" />
                Saved ·{" "}
                {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </>
            ) : (
              <span className="text-muted-foreground">Draft</span>
            )}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 px-3 py-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isReply ? "Reply to" : "Send to"}
          </label>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="contact@brand.com"
            disabled={isDone}
            className="h-7 text-[12px]"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={isReply ? `Re: ${brandName}` : "Subject line"}
            disabled={isDone}
            className="h-7 text-[12.5px] font-semibold"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            disabled={isDone}
            placeholder="Write your email…"
            className="min-h-[160px] text-[12.5px] leading-relaxed"
          />
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      {!isDone && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/60 bg-foreground/[0.02] px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() =>
              onQuickPrompt(
                isReply
                  ? `Review my ${brandName} reply — check tone, clarity, and whether the ask/next step is strong. Suggest tweaks inline.`
                  : `Review my ${brandName} pitch — check hook, personalization, tone, and CTA. Suggest tweaks inline.`,
              )
            }
            disabled={busy !== null}
          >
            <Wand2 className="mr-1 h-3 w-3" />
            Review
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() =>
              onQuickPrompt(
                isReply
                  ? `Regenerate my reply to ${brandName} — fresh angle, keep it warm and specific. Show the new version inline so I can edit.`
                  : `Regenerate the pitch to ${brandName} — new hook and angle, keep tone natural and specific. Show the new version inline so I can edit.`,
              )
            }
            disabled={busy !== null}
            title="Regenerate this email"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={handleCopy}
            disabled={busy !== null}
          >
            <Copy className="mr-1 h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() =>
              onQuickPrompt(
                isReply
                  ? `Suggest attachments for the ${brandName} reply`
                  : `Suggest attachments for the ${brandName} pitch`,
              )
            }
            disabled={busy !== null}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Attach
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() => handleAct("mark")}
            disabled={busy !== null || !canServerAct}
          >
            {busy === "mark" ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            {isReply ? "Mark as sent" : "Mark sent"}
          </Button>
          <Button
            size="sm"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() => handleAct("send")}
            disabled={busy !== null || !canServerAct || !emailValid}
          >
            {busy === "send" ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1 h-3 w-3" />
            )}
            Send now
          </Button>
        </div>
      )}

      {isDone && (
        <div className="border-t border-border/60 bg-foreground/[0.02] px-3 py-1.5 text-[11px] text-muted-foreground">
          {status === "sent"
            ? `Sent${to ? ` to ${to}` : ""}. I'll watch for the reply and surface it here.`
            : "Logged as sent — I'll schedule the follow-ups from here."}
        </div>
      )}
    </div>
  );
}
