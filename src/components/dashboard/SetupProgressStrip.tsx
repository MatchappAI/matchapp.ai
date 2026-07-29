import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { loadSetup, setupCompletion, type CreatorSetup } from "@/lib/creator-setup";

export function SetupProgressStrip() {
  const [setup, setSetup] = useState<CreatorSetup>(() => loadSetup());
  useEffect(() => {
    const on = () => setSetup(loadSetup());
    window.addEventListener("matchai:setup-updated", on);
    return () => window.removeEventListener("matchai:setup-updated", on);
  }, []);

  const { done, total, pct, steps } = setupCompletion(setup);
  if (done === total) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-semibold text-foreground">
            Finish setup so MatchAI can pitch as you
          </div>
          <div className="mt-0.5 break-words text-xs text-muted-foreground">
            {done}/{total} complete — takes about 3 minutes
          </div>
        </div>
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80"
        >
          Complete setup <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-primary/15 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <span
            key={s.label}
            className={`inline-flex max-w-full items-start gap-1 break-words text-[11px] px-2 py-0.5 rounded-full border ${
              s.done
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {s.done && <CheckCircle2 className="w-3 h-3 shrink-0" />}
            <span className="break-words">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
