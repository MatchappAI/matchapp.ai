import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Info, Copy, Check } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listApprovals,
  getOutreachForApproval,
  updateOutreachDraft,
  markOutreachSentManually,
  sendOutreachInternal,
  rejectApproval,
} from "@/lib/matchai.functions";
import { getReplyReview, acknowledgeReplyApproval } from "@/lib/matchai-extra.functions";
import { findContactForBrand } from "@/lib/brand-contacts.functions";

import { cn } from "@/lib/utils";
import { AttachmentPicker, type Attachment } from "@/components/email/AttachmentPicker";
import { openEmailInChat } from "@/lib/open-email-in-chat";

export const Route = createFileRoute("/dashboard/approvals")({
  head: () => ({ meta: [{ title: "Replies — MatchAI" }] }),
  component: ApprovalsPage,
});

type Approval = {
  id: string;
  approval_type: string;
  brand_name: string | null;
  status: string;
  related_id: string | null;
  ai_recommendation: string | null;
  what_happens_next: string | null;
  amount: number | null;
  created_at: string;
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listApprovals);
  const reject = useServerFn(rejectApproval);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => list({ data: {} as never }),
  });

  const rejectMut = useMutation({
    mutationFn: (approval_id: string) => reject({ data: { approval_id } }),
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["home-panels"] });
      qc.invalidateQueries({ queryKey: ["home-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reject"),
  });

  // Replies page shows only brand replies. Draft-outreach approvals live on Brand Matches.
  const all: Approval[] = (data?.approvals ?? []).filter(
    (a: Approval) => a.approval_type === "reply_received",
  );
  const items = tab === "pending" ? all.filter((a) => a.status === "pending") : all;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Replies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brand replies to your outreach. Drafts you haven't sent yet live on{" "}
          <a
            href="/dashboard/brands"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Brand Matches
          </a>
          .
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-foreground/5 bg-foreground/[0.03] p-1 w-fit">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-foreground/[0.04]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Info className="h-10 w-10" />}
          title="No replies yet"
          description="When a brand replies to your outreach, I'll surface it here with my read on their intent and a suggested response you can edit."
          cta={{ label: "Go to Brand Matches", to: "/dashboard/brands" }}
        />
      ) : (
        <div className="space-y-6">
          {tab === "pending" && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm">
              <span className="font-medium text-foreground">My take:</span>
              <span className="text-muted-foreground">
                {items.length === 1
                  ? "One brand replied — open it to see my read and a suggested response."
                  : `${items.length} brand replies waiting. Open each to see my read and a suggested response.`}
              </span>
            </div>
          )}
          {Object.entries(
            items.reduce<Record<string, Approval[]>>((acc, a) => {
              (acc[a.approval_type] ||= []).push(a);
              return acc;
            }, {}),
          ).map(([type, group]) => (
            <section key={type} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {type.replace(/_/g, " ")}
                </h2>
                <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {group.length}
                </span>
              </div>
              <ul className="space-y-2">
                {group.map((a) => {
                  const locked = a.status !== "pending";
                  return (
                    <li
                      key={a.id}
                      data-agent-id={`approvals:${a.id}`}
                      className={cn(
                        "flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4 transition-colors",
                        locked && "opacity-60",
                      )}
                    >
                      <div className="min-w-[220px] flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-semibold text-foreground">
                            {a.brand_name ?? "—"}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              a.status === "pending"
                                ? "bg-amber-500/15 text-amber-300"
                                : a.status === "approved"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-foreground/[0.08] text-muted-foreground",
                            )}
                          >
                            {a.status}
                          </span>
                        </div>
                        {a.ai_recommendation && (
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            <span className="text-primary/80">AI:</span> {a.ai_recommendation}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {!locked && (
                          <Button
                            variant="outline"
                            size="sm"
                            data-agent-id={`approvals:${a.id}:reject`}
                            onClick={() => {
                              if (
                                typeof window !== "undefined" &&
                                !window.confirm("Reject this draft? You can't undo this.")
                              ) {
                                return;
                              }
                              rejectMut.mutate(a.id);
                            }}
                            disabled={rejectMut.isPending}
                            className="rounded-lg"
                          >
                            Reject
                          </Button>
                        )}

                        <Button
                          size="sm"
                          data-agent-id={`approvals:${a.id}:review`}
                          onClick={() =>
                            openEmailInChat({
                              kind: a.approval_type === "reply_received" ? "reply" : "outreach",
                              approvalId: a.id,
                              outreachId: a.related_id,
                              brandName: a.brand_name,
                            })
                          }
                          disabled={locked && a.approval_type !== "reply_received"}
                          className="rounded-lg"
                        >
                          {locked ? "Open in chat" : "Review in chat"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalDetail({ approval, onDone }: { approval: Approval; onDone: () => void }) {
  if (approval.approval_type === "outreach_draft" && approval.related_id) {
    return (
      <OutreachReview approvalId={approval.id} outreachId={approval.related_id} onDone={onDone} />
    );
  }
  if (approval.approval_type === "reply_received" && approval.related_id) {
    return (
      <ReplyReview approvalId={approval.id} outreachId={approval.related_id} onDone={onDone} />
    );
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold capitalize">
        {approval.approval_type.replace(/_/g, " ")}
      </h2>
      <p className="text-sm text-muted-foreground">{approval.what_happens_next}</p>
      {approval.ai_recommendation && (
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            AI recommendation
          </p>
          <p className="mt-1 text-sm text-foreground">{approval.ai_recommendation}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Open this in chat to take action — the agent will walk you through it.
      </p>
    </div>
  );
}

function ReplyReview({
  approvalId,
  outreachId,
  onDone,
}: {
  approvalId: string;
  outreachId: string;
  onDone: () => void;
}) {
  const get = useServerFn(getReplyReview);
  const ack = useServerFn(acknowledgeReplyApproval);
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [editable, setEditable] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["reply-review", outreachId],
    queryFn: () => get({ data: { outreach_id: outreachId } }),
  });

  useEffect(() => {
    if (data?.review.suggestedReply) setEditable(data.review.suggestedReply);
  }, [data?.review.suggestedReply]);

  const ackMut = useMutation({
    mutationFn: () => ack({ data: { approval_id: approvalId, outreach_id: outreachId } }),
    onSuccess: () => {
      toast.success("Marked handled.");
      qc.invalidateQueries({ queryKey: ["approvals"] });
      onDone();
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Reading the reply…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Not found.</p>;

  const intentLabel: Record<string, string> = {
    interested: "Interested",
    negotiating: "Negotiating",
    asking_questions: "Asking questions",
    soft_pass: "Soft pass",
    rejection: "Pass",
    unclear: "Unclear",
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Reply from</p>
        <h2 className="mt-1 text-2xl font-semibold">{data.brand?.name ?? "Brand"}</h2>
      </div>

      {data.locked ? (
        <LockedReplyCard brand={data.brand} intent={intentLabel[data.review.intent]} />
      ) : (
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">What they said</p>
          <p className="text-sm whitespace-pre-wrap text-foreground/90">
            {data.outreach.brand_reply_text || "(no text captured)"}
          </p>
        </div>
      )}

      {!data.locked && (
        <>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {intentLabel[data.review.intent] ?? data.review.intent}
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">My read</p>
            </div>
            {data.review.summary && (
              <p className="text-sm text-foreground/90">{data.review.summary}</p>
            )}
            {data.review.strategy && (
              <p className="text-sm text-muted-foreground">{data.review.strategy}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Suggested reply (edit before sending)
            </p>
            <Textarea
              value={editable}
              onChange={(e) => setEditable(e.target.value)}
              rows={9}
              className="bg-foreground/[0.04] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Attachments to include when you send from your inbox
            </p>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              suggestionsChannel={`reply:${outreachId}`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                const filesLine = attachments.length
                  ? `\n\n(Attach: ${attachments.map((a) => a.name).join(", ")})`
                  : "";
                navigator.clipboard.writeText(editable + filesLine);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copied" : "Copy reply"}
            </Button>
            <Button
              className="rounded-lg"
              onClick={() => ackMut.mutate()}
              disabled={ackMut.isPending}
            >
              Mark handled
            </Button>
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        I'll log this as handled. Send your reply from your own inbox — MatchAI keeps everything
        internal.
      </p>
    </div>
  );
}

function LockedReplyCard({
  brand,
  intent,
}: {
  brand: {
    name?: string;
    estimated_deal_min?: number | null;
    estimated_deal_max?: number | null;
  } | null;
  intent: string;
}) {
  const min = brand?.estimated_deal_min ?? 0;
  const max = brand?.estimated_deal_max ?? 0;
  const range =
    min && max ? `$${min.toLocaleString()}–$${max.toLocaleString()}` : "estimated deal value";
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Locked
        </div>
        <p className="text-sm font-medium">
          {brand?.name ?? "This brand"} replied — signal: {intent}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        A real reply landed with an estimated value of{" "}
        <span className="font-semibold text-foreground">{range}</span>. Upgrade to read the full
        reply and unlock the AI-drafted response tuned to your voice.
      </p>
      <a
        href="/dashboard/settings?tab=billing"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Upgrade to unlock reply
      </a>
    </div>
  );
}

export function OutreachReview({
  approvalId,
  outreachId,
  onDone,
}: {
  approvalId: string;
  outreachId: string;
  onDone: () => void;
}) {
  const get = useServerFn(getOutreachForApproval);
  const update = useServerFn(updateOutreachDraft);
  const markSent = useServerFn(markOutreachSentManually);
  const findContact = useServerFn(findContactForBrand);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["outreach-detail", outreachId],
    queryFn: () => get({ data: { outreach_id: outreachId } }),
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (data?.outreach) {
      setSubject(data.outreach.subject ?? "");
      setBody(data.outreach.body ?? "");
      // Prefill recipient: saved value → discovered C-suite contact → blank
      setToEmail(data.outreach.to_email ?? data.contact?.email ?? "");
    }
  }, [data]);

  const brandMatchId =
    (data?.outreach as { brand_match_id?: string | null } | null)?.brand_match_id ?? null;
  const findContactMut = useMutation({
    mutationFn: () => findContact({ data: { brand_match_id: brandMatchId as string } }),
    onSuccess: (res) => {
      if (res?.ok && res.contact?.email) {
        setToEmail(res.contact.email);
        toast.success(
          res.contact.contact_name
            ? `Found ${res.contact.contact_name}${res.contact.contact_title ? ` · ${res.contact.contact_title}` : ""}`
            : `Found ${res.contact.email}`,
        );
        qc.invalidateQueries({ queryKey: ["outreach-detail", outreachId] });
      } else {
        toast.error(
          res?.error ??
            "No contact provider is configured. Enter the contact manually or import a CSV.",
        );
      }
    },
    onError: (e) => toast.error(String(e)),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          outreach_id: outreachId,
          subject: subject.trim(),
          body: body.trim(),
          to_email: toEmail.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["outreach-detail", outreachId] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (/email/i.test(msg)) toast.error("Recipient must be a valid email address.");
      else if (/subject/i.test(msg)) toast.error("Subject can't be empty.");
      else if (/body/i.test(msg)) toast.error("Body can't be empty.");
      else toast.error(`Couldn't save draft: ${msg}`);
    },
  });

  const internalSend = useServerFn(sendOutreachInternal);
  const sendMut = useMutation({
    mutationFn: () =>
      internalSend({
        data: {
          outreach_id: outreachId,
          approval_id: approvalId,
          subject: subject.trim(),
          body: body.trim(),
          to_email: toEmail.trim(),
          attachments: attachments.map((a) => ({
            name: a.name,
            dataUrl: a.dataUrl,
            mime: a.mime,
            sizeBytes: a.sizeBytes,
          })),
        },
      }),

    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Sent to ${toEmail}. Follow-ups scheduled.`);
        onDone();
      } else {
        toast.error(res?.error ?? "Couldn't send. Try again.");
      }
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.outreach) return <p className="text-sm text-muted-foreground">Not found.</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Outreach to</p>
        <h2 className="mt-1 text-2xl font-semibold">{data.brand?.brand_name ?? "Brand"}</h2>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-xs text-emerald-100/80">
            Approved outreach sends from your internal MatchAI email identity once a creator-email
            provider is configured. Replies route back through the app — I'll surface them in
            Approvals and schedule follow-ups automatically.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Field label="Send to (brand contact email)">
          <div className="flex gap-2">
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="ceo@brand.com"
              className="bg-foreground/[0.04] flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg shrink-0"
              onClick={() => findContactMut.mutate()}
              disabled={!brandMatchId || findContactMut.isPending}
              title="Find a contact using the configured provider"
            >
              {findContactMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Find C-suite"
              )}
            </Button>
          </div>
          {data?.contact?.email && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Suggested: <span className="text-foreground">{data.contact.email}</span>
              {data.contact.name ? <> · {data.contact.name}</> : null}
              {data.contact.title ? <> · {data.contact.title}</> : null}
              {data.contact.confidence ? <> · {data.contact.confidence} confidence</> : null}
            </p>
          )}
        </Field>

        <Field label="Subject">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-foreground/[0.04]"
          />
        </Field>

        <Field label="Body">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="bg-foreground/[0.04] font-mono text-sm"
          />
        </Field>

        <Field label="Attachments">
          <AttachmentPicker
            value={attachments}
            onChange={setAttachments}
            suggestionsChannel={`outreach:${outreachId}`}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => updateMut.mutate()}
          disabled={updateMut.isPending}
          className="rounded-xl"
        >
          Save draft
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
              setCopied(true);
              toast.success("Copied. Paste it into your email and hit send.");
              setTimeout(() => setCopied(false), 1800);
            } catch {
              toast.error("Couldn't copy to clipboard.");
            }
          }}
          className="rounded-xl"
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy message"}
        </Button>
        <Button
          onClick={() => sendMut.mutate()}
          disabled={sendMut.isPending || !toEmail}
          className="flex-1 rounded-xl"
        >
          {sendMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Send now
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
