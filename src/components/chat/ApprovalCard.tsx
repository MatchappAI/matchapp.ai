import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Loader2, Pencil, AlertTriangle, Mail, Copy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approveAndExecute, declineApproval } from "@/lib/agent-chat.functions";
import { sendOutreachFromChat } from "@/lib/matchai.functions";
import { cn } from "@/lib/utils";

type GenericCardData = {
  card?: { title?: string; details?: { label: string; value: string }[] };
  action?: string;
};

type SignalCategory = "brand_fit" | "creator_content" | "personalization" | "pricing_offer";
type SignalUsage = "subject" | "hook" | "why_me" | "idea" | "offer" | "ask";

type StructuredSignal = {
  category: SignalCategory;
  signal: string;
  value_from_context: string;
  used_in: SignalUsage;
  how_it_shaped_the_email: string;
};

type SendTimeSuggestion = {
  day_of_week: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  local_hour_24: number;
  why: string;
} | null;

type OutreachCardData = {
  outreachId: string;
  approvalId: string | null;
  brand_name: string;
  to_email: string;
  subject: string;
  subject_variants?: string[];
  body: string;


  contact_name?: string | null;
  contact_title?: string | null;
  contact_source?: string | null;
  contact_confidence?: string | null;
  personalization_used?: string | null;
  signals_structured?: StructuredSignal[];
  send_time_suggestion?: SendTimeSuggestion;
  ai_reason?: string | null;
};

type Props = {
  messageId: string;
  data: unknown;
  cardType?: string | null;
  status: "pending" | "executed" | "declined" | "failed" | null;
  onChange?: () => void;
};

function isOutreachCard(data: unknown, cardType?: string | null): data is OutreachCardData {
  if (cardType === "outreach_review") return true;
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.outreachId === "string" && typeof d.subject === "string" && typeof d.body === "string";
}

export function ApprovalCard({ messageId, data, cardType, status, onChange }: Props) {
  if (isOutreachCard(data, cardType)) {
    return (
      <OutreachReviewCard
        messageId={messageId}
        data={data as OutreachCardData}
        status={status}
        onChange={onChange}
      />
    );
  }
  return (
    <GenericApprovalCard
      messageId={messageId}
      data={data as GenericCardData | null}
      status={status}
      onChange={onChange}
    />
  );
}

/* ---------------- Outreach review (the human-in-the-loop send gate) ---------------- */

function OutreachReviewCard({
  messageId,
  data,
  status,
  onChange,
}: {
  messageId: string;
  data: OutreachCardData;
  status: "pending" | "executed" | "declined" | "failed" | null;
  onChange?: () => void;
}) {
  const send = useServerFn(sendOutreachFromChat);
  const decline = useServerFn(declineApproval);

  const [to, setTo] = useState(data.to_email ?? "");
  const [subject, setSubject] = useState(data.subject);
  const [body, setBody] = useState(data.body);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"send" | "mark" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status ?? "pending");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  const isDone = localStatus === "executed" || localStatus === "declined";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  const handleSend = async (mode: "send" | "mark") => {
    setError(null);
    if (mode === "send" && !emailValid) {
      setError("Add a valid recipient email to send.");
      return;
    }
    setBusy(mode);
    try {
      const res = await send({
        data: {
          messageId,
          outreachId: data.outreachId,
          approvalId: data.approvalId,
          to: to.trim(),
          subject: subject.trim(),
          body,
          mode: mode === "send" ? "send" : "mark_sent",
        },
      });
      if (res.ok) {
        setLocalStatus("executed");
        setSentAt(res.sentAt ?? new Date().toISOString());
        setEditing(false);
        onChange?.();
      } else {
        setError(res.error ?? "Send failed.");
        setLocalStatus("failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
      setLocalStatus("failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy("decline");
    try {
      await decline({ data: { messageId } });
      setLocalStatus("declined");
      onChange?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "mt-2 w-full rounded-xl border bg-card/80 p-3 text-sm",
        localStatus === "executed" && "border-emerald-500/40 bg-emerald-500/5",
        localStatus === "declined" && "opacity-70",
        localStatus === "failed" && "border-destructive/40",
        localStatus === "pending" && "border-border/60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium leading-tight">
          {localStatus === "executed"
            ? "Marked sent"
            : `Draft ready — outreach to ${data.brand_name}`}
        </p>
        {localStatus === "executed" && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
            <Check className="h-3 w-3" />
            {sentAt ? new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Logged"}
          </span>
        )}
        {localStatus === "declined" && (
          <span className="text-xs text-muted-foreground">Dismissed</span>
        )}
      </div>
      {!isDone && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Internal draft. MatchAI doesn't send email for you — copy the message, send it from your own inbox, then mark it as sent so the agent can track replies and follow-ups.
        </p>
      )}

      {!isDone && (
        <>
          {(data.ai_reason ||
            data.personalization_used ||
            (data.signals_structured && data.signals_structured.length > 0) ||
            (data.subject_variants && data.subject_variants.length > 0) ||
            data.send_time_suggestion) && (
            <details className="mb-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs" open>
              <summary className="cursor-pointer font-medium text-primary/90 hover:text-primary">
                Every signal I used in this pitch
              </summary>
              {data.ai_reason && (
                <p className="mt-2 leading-relaxed text-foreground/90">{data.ai_reason}</p>
              )}

              {data.signals_structured && data.signals_structured.length > 0 ? (
                <StructuredSignals signals={data.signals_structured} />
              ) : data.personalization_used ? (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Personalization used
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">
                    {data.personalization_used}
                  </pre>
                </div>
              ) : null}

              {data.subject_variants && data.subject_variants.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Alternate subject lines
                  </p>
                  <ul className="space-y-1">
                    {data.subject_variants.map((sv, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-foreground/10 bg-foreground/[0.03] px-2 py-1">
                        <span className="min-w-0 flex-1 break-words text-[11px] text-foreground/90">{sv}</span>
                        <button
                          type="button"
                          onClick={() => setSubject(sv)}
                          className="shrink-0 text-[10px] text-primary hover:underline"
                        >
                          Use
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.send_time_suggestion && (
                <div className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.03] px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Best send time
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground/90">
                    {data.send_time_suggestion.day_of_week}{" "}
                    {formatHour(data.send_time_suggestion.local_hour_24)} — {data.send_time_suggestion.why}
                  </p>
                </div>
              )}
            </details>
          )}



          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Send to
          </label>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="contact@brand.com"
            className="mb-1 h-8 text-xs"
          />
          {(data.contact_name || data.contact_source) ? (
            <p className="mb-3 text-[10px] text-muted-foreground">
              {data.contact_name ? (
                <>
                  {data.contact_name}
                  {data.contact_title ? ` · ${data.contact_title}` : ""}
                  {" · "}
                </>
              ) : null}
              <span className="uppercase tracking-wider">
                {data.contact_source === "pattern"
                  ? "guessed"
                  : data.contact_source === "department"
                  ? "department"
                  : data.contact_source ?? ""}
              </span>
              {data.contact_confidence ? ` · ${data.contact_confidence} confidence` : ""}
              {" — verify before sending."}
            </p>
          ) : (
            <p className="mb-3 text-[10px] text-muted-foreground">
              Add the contact's email. We couldn't auto-find one.
            </p>
          )}

          <div className="mb-1 flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </label>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Pencil className="h-2.5 w-2.5" /> Edit
              </button>
            )}
          </div>
          {editing ? (
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mb-3 h-8 text-xs"
            />
          ) : (
            <p className="mb-3 break-words rounded-md bg-foreground/[0.03] px-2 py-1.5 text-xs">{subject}</p>
          )}

          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </label>
          {editing ? (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="mb-3 min-h-[140px] text-xs"
            />
          ) : (
            <div className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-foreground/[0.03] px-2 py-1.5 text-xs leading-relaxed">
              {body}
            </div>
          )}

          {/* Internal-only action row — no external email sending */}
          <div className="mb-3 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-2.5 text-xs">
            <p className="mb-2 text-foreground/80">
              Copy the message and send it from your own inbox, then mark it as sent so I can schedule follow-ups and watch for replies.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                className="h-7 text-[11px]"
                disabled={busy !== null}
                onClick={handleCopy}
              >
                <Copy className="mr-1 h-3 w-3" />
                {copied ? "Copied" : "Copy message"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={busy !== null}
                onClick={() => handleSend("mark")}
              >
                {busy === "mark" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Mark as sent
              </Button>
              {editing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  disabled={busy !== null}
                  onClick={() => {
                    setEditing(false);
                    setSubject(data.subject);
                    setBody(data.body);
                  }}
                >
                  Cancel edit
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  disabled={busy !== null}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-muted-foreground"
                disabled={busy !== null}
                onClick={handleDecline}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-[11px] text-destructive">{error}</p>
          )}
        </>
      )}

      {localStatus === "executed" && (
        <p className="text-xs text-muted-foreground">
          {to ? `Logged as sent to ${to}.` : "Recorded as sent."} I'll schedule follow-ups and watch for replies.
        </p>
      )}
    </div>
  );
}

/* ---------------- Generic fallback (existing inline cards) ---------------- */

function GenericApprovalCard({
  messageId,
  data,
  status,
  onChange,
}: {
  messageId: string;
  data: GenericCardData | null;
  status: "pending" | "executed" | "declined" | "failed" | null;
  onChange?: () => void;
}) {
  const approve = useServerFn(approveAndExecute);
  const decline = useServerFn(declineApproval);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [localStatus, setLocalStatus] = useState(status ?? "pending");

  const title = data?.card?.title ?? "Action required";
  const details = data?.card?.details ?? [];

  const handle = async (kind: "approve" | "decline") => {
    setBusy(kind);
    try {
      if (kind === "approve") {
        const res = await approve({ data: { messageId } });
        setLocalStatus(res.ok ? "executed" : "failed");
      } else {
        await decline({ data: { messageId } });
        setLocalStatus("declined");
      }
      onChange?.();
    } finally {
      setBusy(null);
    }
  };

  const isDone = localStatus === "executed" || localStatus === "declined";

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border bg-card/80 p-3 text-sm",
        localStatus === "executed" && "border-emerald-500/40 bg-emerald-500/5",
        localStatus === "declined" && "opacity-70",
        localStatus === "failed" && "border-destructive/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium leading-tight">{title}</p>
        {localStatus === "executed" && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
            <Check className="h-3 w-3" /> Confirmed
          </span>
        )}
        {localStatus === "declined" && (
          <span className="text-xs text-muted-foreground">Dismissed</span>
        )}
      </div>
      {details.length > 0 && (
        <dl className="mb-3 space-y-1 text-xs text-muted-foreground">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between gap-3">
              <dt>{d.label}</dt>
              <dd className="text-foreground">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!isDone && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 flex-1"
            disabled={busy !== null}
            onClick={() => handle("approve")}
          >
            {busy === "approve" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={busy !== null}
            onClick={() => handle("decline")}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Structured signal breakdown ---------------- */

const CATEGORY_META: Record<SignalCategory, { label: string; caption: string; dot: string }> = {
  brand_fit: {
    label: "Brand fit",
    caption: "Why THIS brand, right now",
    dot: "bg-[hsl(217_100%_72%)]",
  },
  creator_content: {
    label: "Your content & audience",
    caption: "What I read about you",
    dot: "bg-emerald-400",
  },
  personalization: {
    label: "Personalization stitched in",
    caption: "Specific hooks in the email",
    dot: "bg-violet-400",
  },
  pricing_offer: {
    label: "Pricing & offer shape",
    caption: "How I framed the ask",
    dot: "bg-amber-400",
  },
};

const USED_IN_LABEL: Record<SignalUsage, string> = {
  subject: "Subject",
  hook: "Hook",
  why_me: "Why me",
  idea: "Idea",
  offer: "Offer",
  ask: "Ask",
};

function StructuredSignals({ signals }: { signals: StructuredSignal[] }) {
  const grouped = (Object.keys(CATEGORY_META) as SignalCategory[])
    .map((cat) => ({ cat, items: signals.filter((s) => s.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mt-2 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {signals.length} signals — nothing generic, nothing invented
      </p>
      {grouped.map(({ cat, items }) => {
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat} className="rounded-md border border-foreground/10 bg-foreground/[0.03] p-2">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
              <span className="text-[11px] font-semibold text-foreground">{meta.label}</span>
              <span className="text-[10px] text-muted-foreground">{meta.caption}</span>
            </div>
            <ul className="space-y-1.5">
              {items.map((s, i) => (
                <li key={i} className="rounded border border-foreground/5 bg-black/20 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-foreground/90">{s.signal}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary/90 ring-1 ring-primary/20">
                      {USED_IN_LABEL[s.used_in]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] italic text-muted-foreground">
                    “{s.value_from_context}”
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-foreground/70">
                    {s.how_it_shaped_the_email}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh < 12 ? "am" : "pm";
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}${suffix}`;
}

