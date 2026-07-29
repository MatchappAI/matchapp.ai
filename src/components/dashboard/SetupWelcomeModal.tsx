import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { loadSetup, setupCompletion, type CreatorSetup } from "@/lib/creator-setup";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "matchai:setup-welcome:dismissed:v1";

export function SetupWelcomeModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<CreatorSetup | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    const s = loadSetup();
    const { done, total } = setupCompletion(s);
    if (done < total) {
      setSetup(s);
      // Small delay so it doesn't fight the initial route paint
      const t = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const on = () => setSetup(loadSetup());
    window.addEventListener("matchai:setup-updated", on);
    return () => window.removeEventListener("matchai:setup-updated", on);
  }, []);

  if (!open || !setup) return null;

  const { done, total, pct, steps } = setupCompletion(setup);
  const nextStep = steps.find((s) => !s.done);

  const dismiss = (persist: boolean) => {
    if (persist && typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setOpen(false);
  };

  const goToSetup = (anchor?: string) => {
    dismiss(true);
    navigate({ to: "/dashboard/settings", hash: anchor });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => dismiss(false)}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-card shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => dismiss(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome to MatchAI
          </div>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Give me 3 minutes and I'll pitch as you
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The more I know about your rates, niche, and voice, the sharper every brand pitch gets. Nothing sends without your approval.
          </p>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Setup progress</span>
            <span className="font-medium text-foreground">{done}/{total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ul className="px-6 pb-4 space-y-1.5">
          {steps.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => goToSetup(`setup-${String(s.key)}`)}
                className="w-full flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-foreground/5 transition-colors"
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.hint}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-6 py-3">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            I'll do this later
          </button>
          <Button size="sm" onClick={() => goToSetup(nextStep ? `setup-${String(nextStep.key)}` : undefined)}>
            {nextStep ? `Start with ${nextStep.label}` : "Open setup"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
