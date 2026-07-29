import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Clock,
  Package,
  ShieldCheck,
  Flame,
  FileText,
  Coins,
  Repeat,
  Camera,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_OPPORTUNITIES, blockRealActionOnDemo, type DemoOpportunity } from "@/lib/demo-mode";
import {
  EARN_CATEGORIES,
  type EarnCategory,
  deadlineLabel,
  pursuePrompt,
} from "@/lib/ways-to-earn";
import { askAgentInChat } from "@/lib/open-email-in-chat";
import { OpportunityProgress } from "@/components/dashboard/OpportunityProgress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const EARN_META: Record<
  NonNullable<DemoOpportunity["earnType"]>,
  { label: string; icon: typeof Sparkles; tint: string }
> = {
  quick: { label: "Quick earnings", icon: Coins, tint: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  ugc_match: { label: "Matched UGC", icon: Camera, tint: "bg-primary/10 text-primary" },
  licensing: { label: "Licensing", icon: FileText, tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  sponsored: { label: "Sponsored", icon: Sparkles, tint: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  repeat_brand: { label: "Repeat brand", icon: Repeat, tint: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  monthly_retainer: { label: "Monthly retainer", icon: BadgeCheck, tint: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
};

function EarnCard({ opp }: { opp: DemoOpportunity }) {
  const meta = opp.earnType ? EARN_META[opp.earnType] : EARN_META.sponsored;
  const Icon = meta.icon;
  const cm = opp.contentMatch;
  const deadline = deadlineLabel(opp.deadlineIso);

  const pursue = () => {
    const blockMsg = blockRealActionOnDemo("send");
    if (blockMsg) toast.info(blockMsg);
    askAgentInChat(pursuePrompt(opp));
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.tint)}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        {cm && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Source: {cm.source}
          </span>
        )}
        {cm && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> {cm.matchConfidence}% match
          </span>
        )}
        {deadline.urgent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-300">
            <Flame className="h-3 w-3" /> {deadline.label}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-semibold">{opp.brand}</h3>
          <div className="whitespace-nowrap text-lg font-semibold text-foreground">{opp.estPayout}</div>
        </div>
        <p className="mt-0.5 break-words text-sm text-muted-foreground">
          {cm?.whyFit ?? opp.reasoning[0]}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Effort: {opp.effort ?? "—"}</span>
        <span className={cn("inline-flex items-center gap-1", deadline.urgent && "text-red-600 dark:text-red-300")}>
          <Flame className="h-3 w-3" /> {deadline.label}
        </span>
        <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> Usage: {opp.usageRights}</span>
      </div>

      <div className="rounded-xl bg-muted/40 p-3 text-sm">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Deliverables</div>
        <ul className="list-inside list-disc space-y-0.5 break-words text-foreground">
          {(opp.deliverables ?? [opp.dealType]).map((d) => (
            <li key={d} className="break-words">{d}</li>
          ))}
        </ul>
        <div className="mt-2 break-words text-xs text-muted-foreground">
          {opp.newContentRequired === false
            ? "Uses content you already have — no new shoot."
            : "New content required."}
        </div>
      </div>

      <OpportunityProgress step={opp.progress ?? "prepared"} />

      <div className="mt-1 flex items-center justify-end">
        <Button onClick={pursue} className="rounded-xl">
          <Sparkles className="mr-2 h-4 w-4" />
          Pursue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export function WaysToEarn() {
  const [cat, setCat] = useState<EarnCategory>("all");
  const list = useMemo(() => {
    if (cat === "all") return DEMO_OPPORTUNITIES;
    return DEMO_OPPORTUNITIES.filter((o) => o.earnType === cat);
  }, [cat]);

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-semibold tracking-tight">Ways to Earn</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            A personalized stream of clear ways to earn — from quick licensing to sponsored deals. Tap Pursue and MatchAI handles the rest.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EARN_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((o) => (
          <EarnCard key={o.id} opp={o} />
        ))}
        {list.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No opportunities in this category right now. MatchAI is scanning — new ones show up as soon as they match.
          </div>
        )}
      </div>
    </section>
  );
}
