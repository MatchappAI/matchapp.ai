import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  MessageSquareReply,
  MousePointer2,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { DealChecker } from "@/components/hero/DealChecker";
import { RateHelperCard } from "@/components/settings/RateHelperCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAgentInChat } from "@/lib/open-email-in-chat";

export const Route = createFileRoute("/dashboard/tools")({
  head: () => ({ meta: [{ title: "Tools — MatchAI" }] }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Tools</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check, price, counter, reply</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          This is the working bench. Deal Checker and Rate Helper stay first-class, and the extra
          tools reuse the same chat + approval flow instead of inventing a separate product.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatusCard
          icon={ShieldCheck}
          title="Creator email"
          body="Not configured yet? That is honest and visible. Drafts still work, but sending waits for a real transport."
        />
        <StatusCard
          icon={AlertTriangle}
          title="Lead discovery"
          body="No provider is configured. Manual entry, CSV import, validation preview, and dedupe stay available."
        />
        <StatusCard
          icon={ClipboardList}
          title="Money story"
          body="Brand-to-creator payment stays external. No wallet, no escrow, no payout surface."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NavCard
          title="Open Deals"
          body="Move from analysis into live deal state, outreach, and negotiation."
          to="/dashboard/deals"
        />
        <NavCard
          title="Open Messages"
          body="Review threads, replies, and approval requests in one place."
          to="/dashboard/inbox"
        />
        <NavCard
          title="Open Tracker"
          body="Update stages, dates, and next actions when an opportunity moves."
          to="/dashboard/tracker"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <MiniToolCard
            icon={Wand2}
            title="Usage rights checker"
            body="Paste an offer and ask MatchAI to focus on paid ads, whitelisting, perpetual rights, exclusivity, and payment timing."
            actionLabel="Check usage rights"
            onAction={(text) =>
              askAgentInChat(
                `Check this offer for usage rights, exclusivity, whitelisting, perpetual rights, and payment timing. Give me a creator-safe read. Offer: ${text.trim()}`,
              )
            }
            placeholder="Paste the offer text here..."
          />
          <MiniToolCard
            icon={MousePointer2}
            title="Counteroffer generator"
            body="Use when the rate is low or the rights are too broad. MatchAI drafts a counteroffer in your voice."
            actionLabel="Draft counteroffer"
            onAction={(text) =>
              askAgentInChat(
                `Draft a counteroffer for this deal. Keep it concise, creator-first, and specific on deliverables, usage rights, and payment terms. Context: ${text.trim()}`,
              )
            }
            placeholder="Describe the deal, deliverables, and what feels off..."
          />
          <MiniToolCard
            icon={MessageSquareReply}
            title="Brand reply generator"
            body="Use when a brand replies and you want a fast, high-quality response or reply-all draft."
            actionLabel="Draft brand reply"
            onAction={(text) =>
              askAgentInChat(
                `Draft a reply to the brand using this context. Keep it natural, creator-first, and ready for approval. Context: ${text.trim()}`,
              )
            }
            placeholder="Paste the brand reply or summarize the thread..."
          />
        </section>

        <div className="space-y-4">
          <DealChecker />
          <RateHelperCard />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function MiniToolCard({
  icon: Icon,
  title,
  body,
  actionLabel,
  placeholder,
  onAction,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  actionLabel: string;
  placeholder: string;
  onAction: (text: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="mt-4 min-h-28 rounded-2xl"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          This drafts inside chat. Sending still requires the real confirmation flow.
        </p>
        <Button onClick={() => onAction(text)} disabled={!text.trim()} className="rounded-xl">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function NavCard({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <Link
      to={to as never}
      className="rounded-3xl border border-foreground/[0.06] bg-card/70 p-5 transition-all hover:-translate-y-0.5 hover:bg-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
