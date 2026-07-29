import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Search = { token?: string };

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Unsubscribe — MatchAI" }] }),
  component: UnsubscribePage,
});

type State =
  | { kind: "validating" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) {
          setState({ kind: "invalid" });
          return;
        }
        if (json.valid) setState({ kind: "ready" });
        else if (json.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid" });
      } catch {
        setState({ kind: "error", message: "We couldn't reach the server. Try again in a moment." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (json.success) setState({ kind: "done" });
      else if (json.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: json.error ?? "Could not unsubscribe." });
    } catch {
      setState({ kind: "error", message: "Network error. Try again." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-foreground/[0.06] bg-foreground/[0.02] p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Email preferences</h1>
        <div className="mt-6">
          {state.kind === "validating" && (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Checking your link…
            </div>
          )}
          {state.kind === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirm you'd like to stop receiving emails sent through MatchAI to this address.
              </p>
              <Button onClick={confirm} className="mt-6 w-full rounded-xl">
                Unsubscribe
              </Button>
            </>
          )}
          {state.kind === "submitting" && (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Updating your preferences…
            </div>
          )}
          {state.kind === "done" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-foreground">You're unsubscribed. We won't email this address again.</p>
            </div>
          )}
          {state.kind === "already" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-foreground">You were already unsubscribed. No further action needed.</p>
            </div>
          )}
          {state.kind === "invalid" && (
            <div className="flex flex-col items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
            </div>
          )}
          {state.kind === "error" && (
            <div className="flex flex-col items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
