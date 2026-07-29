import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  MailOpen,
  MessageSquareText,
  FileSignature,
  ShieldCheck,
  Receipt,
  Handshake,
  Sparkles,
  ShieldAlert,
  Loader2,
  Inbox as InboxIcon,
  Lock,
} from "lucide-react";
import { listInboxThreads, getInboxThread, type InboxEvent } from "@/lib/inbox.functions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";
import { openEmailInChat, askAgentInChat } from "@/lib/open-email-in-chat";


export const Route = createFileRoute("/dashboard/inbox")({
  head: () => ({ meta: [{ title: "Inbox — MatchAI" }] }),
  component: InboxPage,
});

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function InboxPage() {
  const list = useServerFn(listInboxThreads);
  const { data, isLoading } = useQuery({
    queryKey: ["inbox-threads"],
    queryFn: () => list({ data: {} as never }),
    refetchOnWindowFocus: true,
  });

  const threads = data?.threads ?? [];
  const inbound = data?.inbound;
  const showInboundBanner =
    !!inbound && inbound.limit != null && inbound.locked > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && threads.length) {
      const firstUnlocked = threads.find((t) => !t.locked) ?? threads[0];
      setSelectedId(firstUnlocked.brand_match_id);
    }
  }, [threads, selectedId]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <InboxIcon className="h-6 w-6 text-primary" />
          Inbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One thread per brand. Everything — pitches, replies, negotiation, contracts, funds, and payments — in one place.
        </p>
      </div>

      {showInboundBanner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              You've hit your inbound brand limit on Free
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground break-words">
              {inbound!.locked} additional brand{inbound!.locked === 1 ? "" : "s"} you brought in {inbound!.locked === 1 ? "is" : "are"} locked. Upgrade to Starter to manage unlimited inbound threads with 0% success fee.
            </p>
          </div>
          <Link
            to="/pricing"
            className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
          >
            Upgrade to Starter
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading inbox…
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-6 w-6" />}
          title="No brand threads yet"
          description="Once MatchAI finds brand matches and you start outreach, every conversation lives here."
          cta={{ label: "Find brand matches", to: "/dashboard/brands" }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <ThreadList
            threads={threads}
            selectedId={selectedId}
            onSelect={(id, locked) => {
              if (locked) return;
              setSelectedId(id);
            }}
          />
          <ThreadView brandMatchId={selectedId} />
        </div>
      )}
    </div>
  );
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: NonNullable<Awaited<ReturnType<typeof listInboxThreads>>>["threads"];
  selectedId: string | null;
  onSelect: (id: string, locked: boolean) => void;
}) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-foreground/10 bg-background">
      <ul className="divide-y divide-foreground/5">
        {threads.map((t) => {
          const active = t.brand_match_id === selectedId;
          return (
            <li key={t.brand_match_id}>
              <button
                type="button"
                onClick={() => onSelect(t.brand_match_id, t.locked)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  t.locked
                    ? "cursor-not-allowed opacity-55"
                    : active
                      ? "bg-primary/8"
                      : "hover:bg-foreground/[0.04]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {t.locked && (
                      <Lock className="h-3 w-3 flex-none text-muted-foreground" aria-label="locked" />
                    )}
                    {!t.locked && t.unread_reply && (
                      <span className="h-2 w-2 flex-none rounded-full bg-primary" aria-label="unread" />
                    )}
                    <span className="truncate font-medium text-foreground">{t.brand_name}</span>
                  </div>
                  <span className="flex-none text-[11px] text-muted-foreground">{timeAgo(t.last_activity_at)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-medium text-foreground/80">
                    {t.locked ? "Upgrade to unlock" : t.stage_label}
                  </span>
                  {t.deal_value != null && !t.locked && (
                    <span className="text-emerald-600 dark:text-emerald-400">{money(t.deal_value)}</span>
                  )}
                </div>
                {!t.locked && (
                  <p className="mt-1 line-clamp-1 break-words text-xs text-muted-foreground">
                    {t.last_activity_preview}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}



function ThreadView({ brandMatchId }: { brandMatchId: string | null }) {
  const get = useServerFn(getInboxThread);
  const { data, isLoading } = useQuery({
    queryKey: ["inbox-thread", brandMatchId],
    queryFn: () => get({ data: { brand_match_id: brandMatchId! } }),
    enabled: !!brandMatchId,
  });

  if (!brandMatchId) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-foreground/10 py-24 text-muted-foreground">
        Select a brand to see the full thread
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-foreground/10 py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading thread…
      </div>
    );
  }
  const brand = data.brand;
  if (!brand) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-foreground/10 py-24 text-muted-foreground">
        Thread not found
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/5 p-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground break-words">{brand.brand_name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {brand.brand_industry ?? "—"}
            {brand.fit_score != null && <> · Fit {Math.round(brand.fit_score)}/100</>}
            {brand.estimated_deal_min != null && (
              <> · {money(brand.estimated_deal_min)}–{money(brand.estimated_deal_max)}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              askAgentInChat(
                `Give me a status update on ${brand.brand_name} and what I should do next.`,
              )
            }
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Ask MatchAI
          </Button>
        </div>
      </header>

      <BadOfferBanner events={data.events} brandName={brand.brand_name} />

      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
        {data.events.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity yet. Draft a pitch to start this thread.
          </p>
        ) : (
          data.events.map((e) => <EventCard key={e.id} event={e} brandName={brand.brand_name} />)
        )}
      </div>
    </div>
  );
}

// Client-side bad-offer detector — surfaces one banner when the latest reply
// looks unfavorable (low-cash, gifted-only, perpetual usage, exclusivity
// without pay bump). No new tables; reads the classification + reply text
// already on the InboxEvent stream.
function BadOfferBanner({ events, brandName }: { events: InboxEvent[]; brandName: string }) {
  const latestReply = [...events]
    .reverse()
    .find((e): e is Extract<InboxEvent, { kind: "reply_received" }> => e.kind === "reply_received");
  if (!latestReply) return null;

  const t = (latestReply.reply_text ?? "").toLowerCase();
  const cls = (latestReply.classification ?? "").toLowerCase();
  const flags: string[] = [];

  if (/gifted|gifting|free product|in exchange for|complimentary|product only/.test(t)) {
    flags.push("Gifted product only — no cash offer");
  }
  if (/perpetual|in perpetuity|forever|unlimited use|all media|worldwide/.test(t)) {
    flags.push("Perpetual / broad usage rights");
  }
  if (/(exclusive|exclusivity|no competitors|category exclusive)/.test(t) && !/premium|bonus|additional/.test(t)) {
    flags.push("Exclusivity without a pay bump");
  }
  const dollar = t.match(/\$\s?([\d,]+)/);
  if (dollar) {
    const n = Number(dollar[1].replace(/,/g, ""));
    if (n > 0 && n < 150) flags.push(`Sub-$150 flat fee ($${n})`);
  }
  if (/(low_confidence|low|unfavorable|spam|not.?a.?fit|reject)/.test(cls)) {
    flags.push("MatchAI flagged this reply as low-confidence");
  }

  if (flags.length === 0) return null;

  return (
    <div className="mx-5 mt-4 rounded-xl border border-amber-400/50 bg-amber-500/[0.08] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-3.5 w-3.5" /> Watch this one
      </div>
      <p className="mt-1 text-sm text-foreground">
        The latest reply from <span className="font-medium">{brandName}</span> has terms that usually cost creators money. Ask MatchAI to draft a counter before you agree.
      </p>
      <ul className="mt-2 space-y-1 text-xs text-foreground/80">
        {flags.slice(0, 3).map((f) => (
          <li key={f} className="flex gap-1.5">
            <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button
          size="sm"
          onClick={() =>
            askAgentInChat(
              `Review the latest reply from ${brandName}. Flag anything off-market (usage rights, exclusivity, cash rate, deadline), then draft a counter that keeps the door open.`,
            )
          }
          className="rounded-xl"
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Draft a counter
        </Button>
      </div>
    </div>
  );
}

function EventCard({ event, brandName }: { event: InboxEvent; brandName: string }) {
  const shell =
    "rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 break-words";

  if (event.kind === "outreach_draft") {
    return (
      <div className={shell}>
        <Row icon={<Mail className="h-4 w-4 text-amber-500" />} label="Draft pitch" at={event.at} />
        <p className="mt-1 text-sm font-medium break-words">{event.subject}</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {event.body}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              openEmailInChat({ kind: "outreach", outreachId: event.id, brandName })
            }
          >
            Review in chat
          </Button>
        </div>
      </div>
    );
  }
  if (event.kind === "outreach_sent") {
    return (
      <div className={shell}>
        <Row
          icon={
            event.opened ? (
              <MailOpen className="h-4 w-4 text-sky-500" />
            ) : (
              <Mail className="h-4 w-4 text-sky-500" />
            )
          }
          label={
            event.opened
              ? `You sent · opened ${event.open_count}×`
              : "You sent"
          }
          at={event.at}
        />
        <p className="mt-1 text-sm font-medium break-words">{event.subject}</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {event.body}
        </p>
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEmailInChat({ kind: "thread", outreachId: event.id, brandName })}
          >
            Open thread in chat
          </Button>
        </div>
      </div>
    );
  }
  if (event.kind === "reply_received") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-4">
        <Row
          icon={<MessageSquareText className="h-4 w-4 text-primary" />}
          label={`Reply from ${brandName}${event.classification ? ` · ${event.classification}` : ""}`}
          at={event.at}
        />
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
          {event.reply_text}
        </p>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() =>
              openEmailInChat({ kind: "reply", outreachId: event.outreach_id, brandName })
            }
          >
            Draft reply in chat
          </Button>
        </div>
      </div>
    );
  }
  if (event.kind === "negotiation") {
    return (
      <div className={shell}>
        <Row icon={<Handshake className="h-4 w-4 text-violet-500" />} label={`Negotiation · ${event.stage}`} at={event.at} />
        {event.current_counter != null && (
          <p className="mt-1 text-sm">Current counter: <strong>{money(event.current_counter)}</strong></p>
        )}
        {event.next_action && (
          <p className="mt-1 text-xs text-muted-foreground break-words">Next: {event.next_action}</p>
        )}
      </div>
    );
  }
  if (event.kind === "deal_created") {
    return (
      <div className={shell}>
        <Row icon={<Handshake className="h-4 w-4 text-emerald-500" />} label="Deal created" at={event.at} />
        <p className="mt-1 text-sm">
          {event.package_name ?? "Package"} · {money(event.deal_value)}
        </p>
      </div>
    );
  }
  if (event.kind === "contract") {
    return (
      <div className={shell}>
        <Row icon={<FileSignature className="h-4 w-4 text-blue-500" />} label={`Contract · ${event.status}`} at={event.at} />
      </div>
    );
  }
  if (event.kind === "escrow") {
    return (
      <div className={shell}>
        <Row icon={<ShieldCheck className="h-4 w-4 text-cyan-500" />} label={`Payment protection · ${event.status}`} at={event.at} />
      </div>
    );
  }
  return (
    <div className={shell}>
      <Row icon={<Receipt className="h-4 w-4 text-primary" />} label={`Invoice · ${event.status}`} at={event.at} />
      {event.amount != null && <p className="mt-1 text-sm">{money(event.amount)}</p>}
    </div>
  );
}

function Row({ icon, label, at }: { icon: React.ReactNode; label: string; at: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 font-medium text-foreground/80">
        {icon} {label}
      </span>
      <span className="text-muted-foreground">{timeAgo(at)}</span>
    </div>
  );
}
