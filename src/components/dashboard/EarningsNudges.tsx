import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Sparkles, X } from "lucide-react";
import { deriveNudges, pursuePrompt } from "@/lib/ways-to-earn";
import { askAgentInChat } from "@/lib/open-email-in-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "matchai:earn-nudges-dismissed";
const PERM_KEY = "matchai:earn-nudges-perm-asked";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function EarningsNudges() {
  const nudges = useMemo(() => deriveNudges(), []);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [permAsked, setPermAsked] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !!window.localStorage.getItem(PERM_KEY);
  });

  const visible = nudges.filter((n) => !dismissed.has(n.id));

  // Fire browser notifications for urgent nudges once granted.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const n of visible) {
      if (n.tone !== "urgent") continue;
      const key = `matchai:notif-fired:${n.id}`;
      if (window.localStorage.getItem(key)) continue;
      try {
        new Notification("MatchAI", { body: n.message, icon: "/favicon.ico" });
        window.localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    }
  }, [visible]);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  };

  const enableAlerts = async () => {
    setPermAsked(true);
    if (typeof window !== "undefined") window.localStorage.setItem(PERM_KEY, "1");
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  };

  if (visible.length === 0) return null;

  const notifSupported =
    typeof window !== "undefined" && "Notification" in window;
  const showAlertsPill =
    notifSupported && !permAsked && Notification.permission === "default";

  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          MatchAI has updates for you
        </div>
        {showAlertsPill && (
          <button
            onClick={enableAlerts}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-3 w-3" /> Turn on alerts
          </button>
        )}
        {notifSupported && Notification.permission === "denied" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <BellOff className="h-3 w-3" /> Alerts off
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visible.map((n) => (
          <div
            key={n.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 pl-4 shadow-sm",
              n.tone === "urgent"
                ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"
                : n.tone === "opportunity"
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card",
            )}
          >
            <div className="min-w-0 flex-1 break-words text-sm">{n.message}</div>
            <div className="flex items-center gap-2">
              {n.opp && (
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => askAgentInChat(pursuePrompt(n.opp!))}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Pursue
                </Button>
              )}
              <button
                onClick={() => dismiss(n.id)}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
