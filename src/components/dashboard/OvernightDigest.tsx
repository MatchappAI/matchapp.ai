import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  Mail,
  Eye,
  MessageCircle,
  DollarSign,
  ChevronDown,
  Moon,
} from "lucide-react";
import { getJourneyStatus, type OvernightItem } from "@/lib/journey.functions";
import { cn } from "@/lib/utils";

const ICONS: Record<OvernightItem["kind"], typeof Mail> = {
  match: Sparkles,
  sent: Mail,
  opened: Eye,
  replied: MessageCircle,
  closed: DollarSign,
};

const TONES: Record<OvernightItem["kind"], string> = {
  match: "text-primary bg-primary/10",
  sent: "text-blue-700 bg-blue-500/10",
  opened: "text-amber-700 bg-amber-500/10",
  replied: "text-purple-700 bg-purple-500/10",
  closed: "text-emerald-700 bg-emerald-500/10",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function OvernightDigest() {
  const fetchStatus = useServerFn(getJourneyStatus);
  const { data } = useQuery({
    queryKey: ["journey-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;
  const items = data.overnight;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
            <Moon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="break-words text-sm font-semibold text-foreground">
              {items.length === 0
                ? "Quiet last 24 hours"
                : `Here's what I did in the last 24 hours`}
            </div>
            <div className="mt-0.5 break-words text-xs text-muted-foreground">
              {items.length === 0
                ? "No new activity — I'm still working. New matches usually land within 24h."
                : `${items.length} update${items.length === 1 ? "" : "s"} worth your attention`}
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </button>

      {expanded && items.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          {items.map((item, idx) => {
            const Icon = ICONS[item.kind];
            const tone = TONES[item.kind];
            const content = (
              <div className="flex flex-wrap items-start gap-3 py-2.5">
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    tone,
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium text-foreground">
                    {item.title}
                  </div>

                  <div className="mt-0.5 break-words text-xs text-muted-foreground">
                    {item.detail}
                  </div>
                </div>
                <div className="shrink-0 pt-1 text-[11px] text-muted-foreground">
                  {timeAgo(item.at)}
                </div>
              </div>
            );
            return (
              <li key={idx}>
                {item.route ? (
                  <Link
                    to={item.route}
                    className="block -mx-1 px-1 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
