import { motion } from "framer-motion";
import {
  Zap,
  Mail,
  Clock,
  Users,
  Target,
  DollarSign,
  ShieldCheck,
  Flame,
  Lock,
  Info,
  MapPin,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_OPPORTUNITIES, blockRealActionOnDemo, type DemoOpportunity } from "@/lib/demo-mode";
import { askAgentInChat } from "@/lib/open-email-in-chat";
import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-indigo-700 bg-indigo-50 border-indigo-200";
  return "text-amber-800 bg-amber-50 border-amber-200";
}

function freshnessDot(freshness: DemoOpportunity["brandFreshness"]) {
  if (freshness === "Active this week") return "bg-emerald-500";
  if (freshness === "New campaign") return "bg-indigo-500";
  return "bg-amber-500";
}

function contactIcon(status: DemoOpportunity["contactStatus"]) {
  if (status === "Verified email") return <ShieldCheck className="h-3 w-3 text-emerald-600" />;
  if (status === "Likely email") return <Mail className="h-3 w-3 text-indigo-600" />;
  return <Info className="h-3 w-3 text-amber-600" />;
}

function OpportunityCard({ opp, rank }: { opp: DemoOpportunity; rank: number }) {
  const cm = opp.contentMatch;

  const handlePursue = () => {
    const blockMsg = blockRealActionOnDemo("send");
    if (blockMsg) toast.info(blockMsg);
    askAgentInChat(
      `Pursue ${opp.brand} — it's matched to ${cm?.matchedContent ?? "my recent content"}. Pick the best portfolio examples, draft the pitch with the suggested package (${cm?.suggestedPackage ?? opp.dealType}), verify the contact, and show it here for approval before sending.`,
    );
  };

  const handleSend = () => {
    const blockMsg = blockRealActionOnDemo("send");
    if (blockMsg) toast.info(blockMsg);
    askAgentInChat(
      `${opp.nextStep} for ${opp.brand} — pull up their info, draft the pitch right here in chat so I can review and send it without leaving.`,
    );
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Rank + Demo pill */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
            {rank}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-900">
            {opp.logoInitials}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          <Lock className="h-2.5 w-2.5" /> Demo
        </span>
      </div>

      {/* Brand + category */}
      <div className="mb-3">
        <h3 className="break-words text-[15px] font-semibold text-foreground">{opp.brand}</h3>
        <p className="break-words text-xs text-muted-foreground">{opp.category} · {opp.creatorTier} tier</p>
      </div>

      {/* Fit score + freshness */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", scoreColor(opp.fitScore))}>
          {opp.fitScore}% fit
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", freshnessDot(opp.brandFreshness))} />
          {opp.brandFreshness}
        </span>
      </div>

      {/* Locality — closer = cheaper shipping + faster close */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <MapPin className="h-3 w-3 shrink-0 text-indigo-600" />
        <span className="break-words text-foreground">{opp.brandLocation}</span>
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            opp.localFit === "Same city"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : opp.localFit === "Same region"
                ? "border-teal-300 bg-teal-50 text-teal-800"
                : opp.localFit === "Same country"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : opp.localFit === "Ships to you"
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-border bg-muted text-muted-foreground",
          )}
        >
          {opp.localFit}
        </span>
      </div>

      {/* Key numbers grid */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11.5px]">
        <div className="flex min-w-0 items-center gap-1.5 text-foreground">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          <span className="break-words font-semibold">{opp.estPayout}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-foreground">
          <Clock className="h-3.5 w-3.5 text-indigo-600" />
          <span className="break-words">~{opp.estCloseDays}d close</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="break-words">Aud {opp.audienceFit}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          <span className="break-words">Content {opp.contentFit}</span>
        </div>
      </div>

      {/* Deal terms row */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10.5px] text-foreground">
          {opp.dealType}
        </span>
        <span className="rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10.5px] text-foreground">
          {opp.usageRights}
        </span>
        {opp.exclusivityDays > 0 && (
          <span className="rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10.5px] text-foreground">
            {opp.exclusivityDays}d exclusive
          </span>
        )}
      </div>

      {/* Contact + response likelihood */}
      <div className="mb-3 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-foreground">
          {contactIcon(opp.contactStatus)} {opp.contactStatus}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Flame className="h-3 w-3 text-orange-500" /> {opp.responseLikelihood}% reply
        </span>
      </div>

      {/* Reasoning */}
      <ul className="mb-3 space-y-1 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
        {opp.reasoning.slice(0, 2).map((r, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
            <span className="break-words">{r}</span>
          </li>
        ))}
      </ul>

      {/* Content-to-Opportunity match — ties the pitch to existing content */}
      {cm && (
        <div className="mb-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-violet-50/50 p-2.5">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-indigo-900">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span className="break-words">Matched to {cm.matchedContent}</span>
          </div>
          <p className="mb-2 break-words text-[11.5px] leading-snug text-foreground/85">{cm.whyFit}</p>
          <div className="mb-2 flex items-start gap-1.5 text-[11px] text-foreground/90">
            <FileText className="mt-0.5 h-3 w-3 shrink-0 text-indigo-600" />
            <span className="break-words">
              <span className="font-semibold">Suggested:</span> {cm.suggestedPackage}
            </span>
          </div>
          <div className="mb-2 break-words text-[10.5px] text-muted-foreground">
            Usage: {cm.usageRecommendation}
          </div>
          <div className="flex flex-wrap gap-1 text-[10px] font-medium">
            <span className="rounded-md border border-indigo-200 bg-white/60 px-1.5 py-0.5 text-indigo-800">
              {cm.source}
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
              {cm.matchConfidence}% match
            </span>
            <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-sky-800">
              {cm.contactConfidence}% contact
            </span>
          </div>
          {cm.portfolioExamples.length > 0 && (
            <div className="mt-2 border-t border-indigo-200/60 pt-1.5 text-[10.5px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">Proof of fit:</span>{" "}
              {cm.portfolioExamples.join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Primary action — Pursue opportunity (one-tap, hands off to agent) */}
      <button
        onClick={handlePursue}
        className="mt-auto flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-center text-[12.5px] font-semibold leading-tight text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Sparkles className="h-3.5 w-3.5" /> Pursue opportunity
      </button>
      <button
        onClick={handleSend}
        className="mt-2 flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-center text-[11.5px] font-medium leading-tight text-foreground transition-colors hover:bg-muted/40"
      >
        <Zap className="h-3 w-3" /> {opp.nextStep}
      </button>
    </motion.article>
  );
}

// Fastest-to-cash score: weighted blend of fit, response likelihood,
// contact quality, freshness, competition, expected close time, and
// locality (same city/region closes faster + cheaper shipping).
function fastestToCashScore(o: DemoOpportunity): number {
  const contact = o.contactStatus === "Verified email" ? 100 : o.contactStatus === "Likely email" ? 70 : 35;
  const freshness = o.brandFreshness === "Active this week" ? 100 : o.brandFreshness === "New campaign" ? 80 : 55;
  const competition = o.competitionLevel === "Low" ? 100 : o.competitionLevel === "Medium" ? 70 : 40;
  const speed = Math.max(0, 100 - o.estCloseDays * 6); // 5d=70, 10d=40
  const locality =
    o.localFit === "Same city"
      ? 100
      : o.localFit === "Same region"
        ? 85
        : o.localFit === "Same country"
          ? 70
          : o.localFit === "Ships to you"
            ? 45
            : 25;
  return (
    o.fitScore * 0.20 +
    o.responseLikelihood * 0.22 +
    contact * 0.14 +
    freshness * 0.12 +
    competition * 0.08 +
    speed * 0.12 +
    locality * 0.12
  );
}

export function FastestToCashStrip() {
  const ranked = [...DEMO_OPPORTUNITIES]
    .sort((a, b) => fastestToCashScore(b) - fastestToCashScore(a))
    .slice(0, 6);
  return (
    <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-5">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[520px]:grid-cols-1">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <h2 className="break-words text-[15px] font-semibold text-foreground">Matched to your content · Top 6 fastest-to-cash</h2>
          </div>
          <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
            Each opportunity is tied to a specific piece of content you already make. Tap <span className="font-semibold text-foreground">Pursue opportunity</span> and MatchAI picks portfolio proof, drafts the pitch, verifies the contact, and handles follow-ups.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          Test data
        </span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ranked.map((opp, i) => (
          <OpportunityCard key={opp.id} opp={opp} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}

