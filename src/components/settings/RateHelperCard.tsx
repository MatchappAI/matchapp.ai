import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadSetup, type CreatorSetup } from "@/lib/creator-setup";
import {
  DELIVERABLE_LABELS,
  formatRange,
  suggestRate,
  type Deliverable,
} from "@/lib/rate-helper";
import { askAgentInChat } from "@/lib/open-email-in-chat";

const OPTIONS: Deliverable[] = [
  "ig_reel",
  "ig_post",
  "ig_story",
  "tiktok",
  "ugc_video",
];

export function RateHelperCard() {
  const [setup, setSetup] = useState<CreatorSetup>(() => loadSetup());
  const [pick, setPick] = useState<Deliverable>("ig_reel");
  const [scope, setScope] = useState("");

  useEffect(() => {
    const on = () => setSetup(loadSetup());
    window.addEventListener("matchai:setup-updated", on);
    return () => window.removeEventListener("matchai:setup-updated", on);
  }, []);

  const s = useMemo(() => suggestRate(pick, setup), [pick, setup]);

  const askAgent = () => {
    const scopeLine = scope.trim() ? ` The scope is: ${scope.trim()}.` : "";
    askAgentInChat(
      `What should I charge for a ${DELIVERABLE_LABELS[pick]}?${scopeLine} Use my saved rates and creator setup, factor in usage rights, and give me a low / target / stretch number with a one-line reason for each.`,
    );
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Rate helper</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick "what should I charge" for a specific deliverable. Uses your saved rates + usage rights.
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

      <div className="mt-5 rounded-2xl border border-border/60 bg-foreground/[0.03] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested range
        </div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{formatRange(s)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Target: <span className="font-medium text-foreground">${s.mid.toLocaleString()}</span> · {s.reason}
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
