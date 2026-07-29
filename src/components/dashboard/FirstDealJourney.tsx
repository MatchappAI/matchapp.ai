import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, ArrowRight } from "lucide-react";
import { getJourneyStatus } from "@/lib/journey.functions";
import { cn } from "@/lib/utils";

export function FirstDealJourney() {
  const fetchStatus = useServerFn(getJourneyStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["journey-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your journey…
        </div>
      </div>
    );
  }

  const { steps, currentStepIndex, overallPct } = data;
  const currentStep = steps[currentStepIndex];
  const nextRoute =
    currentStep.key === "setup"
      ? "/dashboard/settings"
      : currentStep.key === "matches" || currentStep.key === "drafted"
      ? "/dashboard/brands"
      : currentStep.key === "sent" || currentStep.key === "opened" || currentStep.key === "replied"
      ? "/dashboard/approvals"
      : "/dashboard/wallet";

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-semibold uppercase tracking-wider text-primary">
            Your journey to first paid deal
          </div>
          <div className="mt-1 break-words text-sm font-semibold text-foreground">
            {overallPct === 100
              ? "You're closing paid deals — nice."
              : `Up next: ${currentStep.label}`}
          </div>
          <div className="mt-0.5 break-words text-xs text-muted-foreground">{currentStep.hint}</div>
        </div>
        {overallPct < 100 && (
          <Link
            to={nextRoute}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-primary/15 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <ol className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((s, idx) => {
          const isCurrent = idx === currentStepIndex && !s.done;
          return (
            <li
              key={s.key}
              className={cn(
                "flex min-w-[7.5rem] max-w-full flex-1 items-start gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] sm:flex-none",
                s.done
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : isCurrent
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-background/60 text-muted-foreground",
              )}
              title={s.hint}
            >
              {s.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Circle
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    isCurrent && "text-primary",
                  )}
                />
              )}
              <span className="font-medium break-words">{s.label}</span>
            </li>
          );
        })}
      </ol>

    </div>
  );
}
