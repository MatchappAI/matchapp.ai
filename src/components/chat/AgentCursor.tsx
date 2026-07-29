import { useEffect, useRef, useState } from "react";
import { onAgentHighlight } from "@/lib/agent-highlight";
import matchaiMark from "@/assets/matchai-mark-transparent.png";

/**
 * Visible "agent cursor" overlay. When the chat agent emits a highlight
 * event (via a tool call), we:
 *   1. Find the matching [data-agent-id="view:id"] element inside `containerRef`.
 *   2. Smooth-scroll it into view.
 *   3. Animate a MatchAI-branded cursor from its current position to the
 *      target, streak a soft glow trail, show a "thinking" label, then flash
 *      a click pulse — so the user literally watches MatchAI act.
 *
 * Mounted once inside the dashboard's right pane; positioned absolutely
 * within that pane so it never leaks into the chat column.
 */
export function AgentCursor({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [prevPos, setPrevPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking, setClicking] = useState(false);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState<string>("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = onAgentHighlight((d) => {
      const container = containerRef.current;
      if (!container) return;
      const selector = `[data-agent-id="${cssEscape(`${d.view}:${d.id}`)}"]`;
      let tries = 0;
      const tryLocate = () => {
        const el = container.querySelector<HTMLElement>(selector);
        if (!el) {
          if (tries++ < 12) setTimeout(tryLocate, 120);
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const containerRect = container.getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          const x = Math.max(
            24,
            Math.min(
              containerRect.width - 180,
              rect.left - containerRect.left + Math.min(rect.width * 0.35, 120),
            ),
          );
          const y = Math.max(
            48,
            Math.min(
              containerRect.height - 48,
              rect.top - containerRect.top + Math.min(rect.height * 0.4, 44),
            ),
          );
          setPrevPos((cur) => cur ?? { x: x - 180, y: y + 80 });
          setLabel(d.label || labelFor(d.view));
          setVisible(true);
          setPos({ x, y });
          setTimeout(() => {
            setClicking(true);
            setTimeout(() => setClicking(false), 480);
          }, 680);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setVisible(false), 4800);
        }, 380);
      };
      tryLocate();
    });
    return () => {
      off();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [containerRef]);

  useEffect(() => {
    if (pos) setPrevPos(pos);
  }, [pos]);

  if (!pos) return null;

  // Compute glow-trail line between prev and current position.
  const trail =
    prevPos && visible
      ? (() => {
          const dx = pos.x - prevPos.x;
          const dy = pos.y - prevPos.y;
          const len = Math.hypot(dx, dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return { x: prevPos.x, y: prevPos.y, len, angle };
        })()
      : null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {/* Soft glow trail */}
      {trail && trail.len > 24 && (
        <div
          className="absolute h-[2px] origin-left rounded-full"
          style={{
            left: trail.x,
            top: trail.y,
            width: trail.len,
            transform: `rotate(${trail.angle}deg)`,
            background:
              "linear-gradient(90deg, hsl(var(--primary) / 0) 0%, hsl(var(--primary) / 0.55) 60%, hsl(var(--primary) / 0.9) 100%)",
            filter: "blur(2px)",
            animation: "matchai-trail-fade 900ms ease-out forwards",
          }}
        />
      )}

      <div
        className="absolute transition-all duration-[680ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Click ripple */}
        {clicking && (
          <>
            <span
              className="absolute -left-4 -top-4 h-12 w-12 rounded-full border-2 border-primary/60"
              style={{ animation: "matchai-cursor-ping 480ms ease-out forwards" }}
            />
            <span
              className="absolute -left-2 -top-2 h-8 w-8 rounded-full bg-primary/25"
              style={{ animation: "matchai-cursor-ping 380ms ease-out forwards" }}
            />
          </>
        )}

        {/* Thinking label — above cursor */}
        {label && (
          <div
            className="absolute -top-12 left-6 max-w-[min(15rem,calc(100vw-3rem))] rounded-2xl border border-primary/25 bg-background/95 px-2.5 py-1 text-[11px] font-medium leading-tight text-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.35)] backdrop-blur-sm"
            style={{ animation: "matchai-label-in 320ms ease-out both" }}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-[1px] animate-pulse rounded-full bg-primary align-middle" />
            {label}
          </div>
        )}

        {/* MatchAI-branded cursor mark */}
        <div className="relative">
          {/* Ambient halo */}
          <span className="absolute -inset-2 rounded-full bg-primary/25 blur-md" />
          <div className="relative grid h-7 w-7 place-items-center rounded-full bg-background ring-2 ring-primary/70 shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.65)]">
            <img src={matchaiMark} alt="" className="h-4 w-4 select-none" draggable={false} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes matchai-cursor-ping {
          0%   { transform: scale(0.5); opacity: 0.95; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes matchai-trail-fade {
          0%   { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes matchai-label-in {
          0%   { opacity: 0; transform: translateY(4px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function labelFor(view: string): string {
  const map: Record<string, string> = {
    brands: "Opening this brand…",
    deals: "Checking the deal…",
    approvals: "Reviewing to approve…",
    campaigns: "Pulling up the campaign…",
    tracker: "Opening external payment tracking…",
    outreach: "Prepping this pitch…",
  };
  return map[view] || "MatchAI is on it…";
}

function cssEscape(v: string) {
  return v.replace(/["\\]/g, "\\$&");
}
