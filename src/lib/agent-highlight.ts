// Lightweight in-tab pub/sub used by the chat agent to highlight a specific
// row/card in the dashboard when it "walks over" to look at something.
// Emitted by DashboardChatPanel when navigateView() carries a highlightId;
// consumed by list views (brands, deals, approvals) via useAgentHighlight()
// and by <AgentCursor /> which visibly animates a cursor to the target and
// scrolls it into view — so the creator literally sees MatchAI acting.

import { useEffect, useState } from "react";

type Detail = { view: string; id: string; at: number; label?: string };
const EVT = "matchai:highlight";

export function emitAgentHighlight(view: string, id: string, label?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<Detail>(EVT, { detail: { view, id, at: Date.now(), label } }),
  );
}

/** Stable data-attribute selector used by AgentCursor to locate the element. */
export function agentTargetAttr(view: string, id: string) {
  return { "data-agent-id": `${view}:${id}` } as const;
}

/** Returns the currently highlighted id for a given view, or null. Auto-clears after `ttl`ms. */
export function useAgentHighlight(view: string, ttl = 3200): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail;
      if (!d || d.view !== view) return;
      setId(d.id);
      const t = setTimeout(() => setId((cur) => (cur === d.id ? null : cur)), ttl);
      return () => clearTimeout(t);
    };
    window.addEventListener(EVT, onEvt);
    return () => window.removeEventListener(EVT, onEvt);
  }, [view, ttl]);
  return id;
}

/** Subscribe to raw highlight events (used by AgentCursor). */
export function onAgentHighlight(cb: (d: Detail) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<Detail>).detail);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
