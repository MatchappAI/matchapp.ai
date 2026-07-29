import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadSetup, type CreatorSetup } from "@/lib/creator-setup";
import { DELIVERABLE_LABELS, suggestRate, type Deliverable } from "@/lib/rate-helper";
import { askAgentInChat } from "@/lib/open-email-in-chat";

const OPTIONS: Deliverable[] = ["ig_reel", "ig_post", "ig_story", "tiktok", "ugc_video"];

export function RateHelperCard() {
  const [setup, setSetup] = useState<CreatorSetup>(() => loadSetup());
  const [pick, setPick] = useState<Deliverable>("ig_reel");
  const [scope, setScope] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [followers, setFollowers] = useState("");
  const [engagement, setEngagement] = useState("");
  const [niche, setNiche] = useState("");
  const [usageRights, setUsageRights] = useState("organic");
  const [exclusive, setExclusive] = useState(false);
  const [rush, setRush] = useState(false);

  useEffect(() => {
    const on = () => setSetup(loadSetup());
    window.addEventListener("matchai:setup-updated", on);
    return () => window.removeEventListener("matchai:setup-updated", on);
  }, []);

  const s = useMemo(() => suggestRate(pick, setup), [pick, setup]);
  const adjusted = useMemo(() => {
    let factor = 1;
    const followerCount = Number(followers);
    const engagementRate = Number(engagement);
    if (followerCount > 0 && followerCount < 5_000) factor *= 0.85;
    if (followerCount >= 25_000) factor *= 1.15;
    if (engagementRate >= 5) factor *= 1.1;
    if (usageRights === "paid") factor *= 1.4;
    if (usageRights === "perpetual") factor *= 1.9;
    if (exclusive) factor *= 1.25;
    if (rush) factor *= 1.2;
    return {
      low: Math.round(s.low * factor),
      mid: Math.round(s.mid * factor),
      high: Math.round(s.high * factor),
    };
  }, [engagement, exclusive, followers, rush, s, usageRights]);
  const confidence = setup?.rates?.[pick] || Number(followers) > 0 ? "Medium" : "Low";
  const assumptions = [
    `${platform}${followers ? ` · ${Number(followers).toLocaleString()} followers` : ""}`,
    engagement ? `${engagement}% engagement/views signal` : "No engagement or views supplied",
    niche || "General niche assumption",
    usageRights === "organic" ? "Organic usage only" : `${usageRights} usage premium`,
    exclusive ? "Exclusivity premium" : "No exclusivity selected",
    rush ? "Rush timeline premium" : "Standard timeline",
  ];

  const askAgent = () => {
    const scopeLine = scope.trim() ? ` The scope is: ${scope.trim()}.` : "";
    askAgentInChat(
      `What should I charge for a ${DELIVERABLE_LABELS[pick]} on ${platform}?${scopeLine} Followers: ${followers || "unknown"}. Engagement/views: ${engagement || "unknown"}. Niche: ${niche || "unknown"}. Usage: ${usageRights}. Exclusivity: ${exclusive ? "yes" : "no"}. Rush: ${rush ? "yes" : "no"}. Give me a low / target / stretch number and a counteroffer draft for approval.`,
    );
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Rate helper</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimated range, not a guarantee. Add the scope signals below for a sharper counter.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setPick(o)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              pick === o
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {DELIVERABLE_LABELS[o]}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="Optional scope (e.g. 30-day organic usage, one round of edits)"
          className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Unposted UGC</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Followers
          <input
            type="number"
            min="0"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            placeholder="e.g. 12000"
            className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Engagement or average views
          <input
            value={engagement}
            onChange={(e) => setEngagement(e.target.value)}
            placeholder="e.g. 4.5% or 18000 views"
            className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Niche/category
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. wellness, gaming, food"
            className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Usage rights
          <select
            value={usageRights}
            onChange={(e) => setUsageRights(e.target.value)}
            className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="organic">Organic only</option>
            <option value="paid">Paid usage / ads</option>
            <option value="perpetual">Perpetual usage</option>
          </select>
        </label>
        <div className="flex items-end gap-4 pb-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exclusive}
              onChange={(e) => setExclusive(e.target.checked)}
            />{" "}
            Exclusivity
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} />{" "}
            Rush timeline
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border/60 bg-foreground/[0.03] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested range
        </div>
        <div className="mt-1 text-2xl font-semibold text-foreground">
          ${adjusted.low.toLocaleString()} – ${adjusted.high.toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Target:{" "}
          <span className="font-medium text-foreground">${adjusted.mid.toLocaleString()}</span> ·
          Confidence: {confidence} · {s.reason}
        </div>
        <div className="mt-3 rounded-xl bg-background/70 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Assumptions</p>
          <p className="mt-1">{assumptions.join(" · ")}</p>
          <p className="mt-2 text-foreground">
            Counteroffer draft: “For {DELIVERABLE_LABELS[pick]} with {usageRights} usage
            {exclusive ? " and exclusivity" : ""}, my rate is ${adjusted.mid.toLocaleString()}. This
            includes a defined scope, revision limit, and payment timing.”
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={askAgent} className="rounded-xl">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Ask MatchAI for a sharper number
          </Button>
        </div>
      </div>
    </Card>
  );
}
