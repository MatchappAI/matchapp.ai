import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Send } from "lucide-react";

import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  loadAgentMessages,
  importLandingChat,
  openOutreachDraftInChat,
} from "@/lib/agent-chat.functions";
import { getChatOpener } from "@/lib/chat-openers.functions";
import { getTopActions } from "@/lib/top-actions.functions";
import { getAutonomySettings, setAutonomySettings } from "@/lib/autonomy.functions";
import { ApprovalCard } from "./ApprovalCard";
import { InlineToolCard } from "./InlineToolCard";
import { AgentActivityStep, labelForToolCall } from "./AgentActivityStep";
import { emitAgentHighlight } from "@/lib/agent-highlight";
import { OPEN_EMAIL_EVENT, ASK_AGENT_EVENT, type OpenEmailDetail } from "@/lib/open-email-in-chat";

type StoredMessage = {
  id: string;
  role: string;
  content: string;
  inline_card_type: string | null;
  inline_card_data: unknown;
  requires_approval: boolean;
  approval_status: string | null;
  created_at: string;
};

const SESSION_TTL_MS = 30 * 60 * 1000;

const AUTONOMY_LEVELS = [
  { key: "manual", label: "Manual", tooltip: "I only answer & suggest. You do everything." },
  {
    key: "suggest",
    label: "Suggest",
    tooltip: "I recommend the next move and prep options. You approve each step.",
  },
  {
    key: "draft",
    label: "Draft",
    tooltip: "I draft, queue, and set everything up. You tap Send / Release.",
  },
  {
    key: "auto",
    label: "Autopilot",
    tooltip: "I run the whole flow and only ask on money, contracts, or unclear judgment calls.",
  },
] as const;

const AUTONOMY_STATUS = [
  "manual · I'll wait for your call",
  "suggest · I'll recommend next moves",
  "draft · I'll prep everything, you send",
  "autopilot on · I'll take the next steps",
] as const;

/**
 * Persistent MatchAI chat. Renders inline inside its parent container —
 * the dashboard layout owns positioning so the chat is always visible.
 */
export function DashboardChatPanel() {
  const [input, setInput] = useState("");
  const [openerShown, setOpenerShown] = useState(false);
  const [openerSuggestions, setOpenerSuggestions] = useState<
    Array<{ label: string; prompt: string }>
  >([]);
  const [instantRows, setInstantRows] = useState<StoredMessage[]>([]);
  // Autonomy: 0 Manual · 1 Suggest · 2 Draft · 3 Autopilot
  const [autonomy, setAutonomy] = useState<number>(() => {
    if (typeof window === "undefined") return 2;
    const v = localStorage.getItem("matchai:autonomy");
    if (v !== null) return Math.max(0, Math.min(3, Number(v) || 0));
    // migrate from old boolean
    return localStorage.getItem("matchai:autopilot") === "1" ? 3 : 2;
  });
  // Sync from server profile once on mount so autonomy travels across devices.
  const getAutonomyFn = useServerFn(getAutonomySettings);
  const setAutonomyFn = useServerFn(setAutonomySettings);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    (async () => {
      try {
        const r = await getAutonomyFn({});
        if (typeof r?.autonomy_level === "number") {
          setAutonomy(Math.max(0, Math.min(3, r.autonomy_level)));
        }
      } catch {
        /* keep local value */
      }
    })();
  }, [getAutonomyFn]);
  const setAutonomyFnRef = useRef(setAutonomyFn);
  useEffect(() => {
    setAutonomyFnRef.current = setAutonomyFn;
  }, [setAutonomyFn]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("matchai:autonomy", String(autonomy));
    }
    if (hydratedRef.current) {
      // Best-effort persist to profile; ignore failures.
      setAutonomyFnRef.current({ data: { autonomy_level: autonomy } }).catch(() => {});
    }
  }, [autonomy]);
  const autonomyRef = useRef(autonomy);
  useEffect(() => {
    autonomyRef.current = autonomy;
  }, [autonomy]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const navigatedRef = useRef<Set<string>>(new Set());

  const loadMsgs = useServerFn(loadAgentMessages);
  const openDraftInChat = useServerFn(openOutreachDraftInChat);
  const opener = useServerFn(getChatOpener);
  const topActions = useServerFn(getTopActions);
  const importLanding = useServerFn(importLandingChat);

  // One-time handoff: pull the landing-page chat transcript out of
  // localStorage and import it into agent_messages so the dashboard chat
  // continues the same conversation with the same MatchAI.
  const bridgedRef = useRef(false);
  useEffect(() => {
    if (bridgedRef.current) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("matchai:landing-bridged") === "1") return;
    try {
      const raw = localStorage.getItem("matchai:landing-chat:v1");
      if (!raw) {
        localStorage.setItem("matchai:landing-bridged", "1");
        bridgedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as {
        messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>;
      };
      const msgs = (parsed.messages ?? [])
        .map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          text: (m.parts ?? [])
            .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
            .join("")
            .trim(),
        }))
        .filter((m) => m.text.length > 0);
      bridgedRef.current = true;
      localStorage.setItem("matchai:landing-bridged", "1");
      if (msgs.length === 0) return;
      void importLanding({ data: { messages: msgs } }).then(() => {
        void refetchHistory();
      });
    } catch {
      bridgedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["agent-messages"],
    queryFn: () => loadMsgs({ data: {} as never }),
  });

  // Top 5 Next Actions rail — always 5, stage-aware, max 3 of same kind.
  // Refetches on route change and whenever the DB signals new activity.
  const { data: topData, refetch: refetchTopActions } = useQuery({
    queryKey: ["top-actions", pathname],
    queryFn: () => topActions({ data: { currentPage: pathname } }),
    staleTime: 15_000,
  });
  // Hide the landing-handoff marker + internal system nudges from the visible UI,
  // but keep them in the DB so the model still reads them as context.
  const LANDING_BRIDGE_MARKER = "[[landing-handoff]]";
  const stored = ((historyData?.messages ?? []) as StoredMessage[]).filter(
    (m) =>
      !m.content.startsWith(LANDING_BRIDGE_MARKER) &&
      !m.content.trimStart().startsWith("[system nudge"),
  );

  const combinedStored = useMemo(() => {
    const byId = new Map<string, StoredMessage>();
    [...stored, ...instantRows].forEach((row) => byId.set(row.id, row));
    return [...byId.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [stored, instantRows]);

  const initialUIMessages = useMemo<UIMessage[]>(() => {
    if (!combinedStored.length) return [];
    const last = combinedStored[combinedStored.length - 1];
    const age = Date.now() - new Date(last.created_at).getTime();
    if (age > SESSION_TTL_MS) return [];
    return combinedStored.slice(-6).map<UIMessage>((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: m.content }],
    }));
  }, [combinedStored]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/agent",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return {
            body: { messages, currentPage: pathname, autonomy: autonomyRef.current },
            headers,
          };
        },
      }),
    [pathname],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "dashboard-agent",
    messages: initialUIMessages,
    transport,
    onError: (err) => {
      // Surface failures inline so the user is never left without a response.
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "Sorry — I hit a snag reaching the model. Tap send again or ask another way and I'll pick right back up.",
            },
          ],
        },
      ]);
      console.error("[chat] stream error", err);
    },
  });

  useEffect(() => {
    if (initialUIMessages.length && messages.length === 0) {
      setMessages(initialUIMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUIMessages.length]);

  const seenIdsRef = useRef<Set<string>>(new Set(initialUIMessages.map((m) => m.id)));
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    const additions: UIMessage[] = [];
    for (const m of combinedStored.slice(-40)) {
      if (seenIdsRef.current.has(m.id)) continue;
      seenIdsRef.current.add(m.id);
      additions.push({
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        parts: [{ type: "text", text: m.content }],
      });
    }
    if (!additions.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = additions.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [combinedStored, setMessages, status]);

  // If the last stored message is from the user with no assistant reply
  // (e.g. previous stream errored / user reloaded mid-turn), auto-resume
  // so every user message eventually gets a response.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!initialUIMessages.length) return;
    if (status === "submitted" || status === "streaming") return;
    const last = initialUIMessages[initialUIMessages.length - 1];
    if (last?.role !== "user") return;
    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim();
    if (!text) return;
    resumedRef.current = true;
    void sendMessage({ text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUIMessages.length]);

  useEffect(() => {
    setOpenerShown(false);
    setOpenerSuggestions([]);
  }, [pathname]);

  useEffect(() => {
    if (openerShown) return;
    // Skip opener entirely if there's already a recent (< session TTL)
    // assistant/user exchange — no more stacking greetings on top of an
    // ongoing conversation every time the route changes.
    if (combinedStored.length > 0) {
      const last = combinedStored[combinedStored.length - 1];
      const age = Date.now() - new Date(last.created_at).getTime();
      if (age < SESSION_TTL_MS) {
        setOpenerShown(true);
        // Still refresh page-aware suggestion chips.
        opener({ data: { currentPage: pathname } })
          .then((res) => setOpenerSuggestions(res.suggestions ?? []))
          .catch(() => {});
        return;
      }
    }
    let cancelled = false;
    opener({ data: { currentPage: pathname } }).then((res) => {
      if (cancelled) return;
      setOpenerSuggestions(res.suggestions ?? []);
      if (!res.message) {
        setOpenerShown(true);
        return;
      }
      const text = res.message;
      setMessages((prev) => [
        ...prev,
        {
          id: `opener-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text }],
        },
      ]);
      setOpenerShown(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openerShown, pathname, opener, setMessages]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Agent-driven navigation + row highlighting: when the model calls
  // navigateView, switch the right pane; if it passed a highlightId, pulse
  // that row so the creator literally sees where MatchAI is looking.
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const p of m.parts) {
        if (p.type !== "tool-navigateView") continue;
        const key = `${m.id}:${(p as { toolCallId?: string }).toolCallId ?? ""}`;
        if (navigatedRef.current.has(key)) continue;
        const output = (
          p as { output?: { navigate?: string; view?: string; highlightId?: string | null } }
        ).output;
        if (!output?.navigate) continue;
        navigatedRef.current.add(key);
        if (output.navigate !== pathname) {
          navigate({ to: output.navigate });
        }
        if (output.view && output.highlightId) {
          // Small delay so the destination view has mounted its list.
          setTimeout(() => emitAgentHighlight(output.view!, output.highlightId!), 250);
        }
      }
    }
  }, [messages, navigate, pathname]);

  // Cursor follows the agent's other tool calls: opening a brand card, deal,
  // draft, earnings, etc. so the creator watches MatchAI act on the right stage.
  const highlightedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const p of m.parts) {
        if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
        const key = `${m.id}:${(p as { toolCallId?: string }).toolCallId ?? ""}:${p.type}`;
        if (highlightedRef.current.has(key)) continue;
        highlightedRef.current.add(key);
        const output = (p as { output?: Record<string, unknown> }).output;
        if (!output || typeof output !== "object") continue;
        const t = setTimeout(() => {
          switch (p.type) {
            case "tool-showBrandCard":
              if (output.id) emitAgentHighlight("brands", String(output.id), "Opening this brand…");
              break;
            case "tool-showDealCard":
              if (output.id) emitAgentHighlight("deals", String(output.id), "Opening this deal…");
              break;
            case "tool-showEmailDraft":
              if (output.approvalId) {
                emitAgentHighlight("approvals", String(output.approvalId), "Prepping this pitch…");
                // Chain: cursor then moves to press the Review button so the
                // creator literally sees MatchAI click it open.
                setTimeout(
                  () =>
                    emitAgentHighlight(
                      "approvals",
                      `${output.approvalId}:review`,
                      "Clicking Review…",
                    ),
                  1400,
                );
              }
              break;
            case "tool-showReplyDraft":
              if (output.approvalId) {
                emitAgentHighlight("approvals", String(output.approvalId), "Drafting your reply…");
                setTimeout(
                  () =>
                    emitAgentHighlight(
                      "approvals",
                      `${output.approvalId}:review`,
                      "Opening the reply…",
                    ),
                  1400,
                );
              }
              break;
            case "tool-requestBrandPayment":
              if (output.dealId)
                emitAgentHighlight("deals", String(output.dealId), "Creating payment link…");
              break;
            case "tool-showBrandList":
              if (Array.isArray(output.items) && output.items[0]?.id) {
                emitAgentHighlight("brands", String(output.items[0].id), "Ranking your matches…");
              }
              break;
            case "tool-showReplyList":
              if (Array.isArray(output.items) && output.items[0]?.id) {
                const first = String((output.items[0] as { id: string }).id);
                emitAgentHighlight("approvals", first, "Checking replies…");
                setTimeout(
                  () => emitAgentHighlight("approvals", `${first}:review`, "Clicking Review…"),
                  1400,
                );
              }
              break;

            case "tool-showEarnings":
              emitAgentHighlight("wallet", "balance", "Checking external payment status…");
              break;
            case "tool-suggestAttachments": {
              const names: string[] = Array.isArray(output.names) ? output.names : [];
              const channel =
                output.target === "reply"
                  ? `reply:${output.outreachId}`
                  : `outreach:${output.outreachId}`;

              if (typeof window !== "undefined" && names.length) {
                window.dispatchEvent(
                  new CustomEvent("matchai:suggest-attachments", {
                    detail: { channel, names },
                  }),
                );
              }
              if (output.approvalId ?? output.outreachId) {
                emitAgentHighlight(
                  "approvals",
                  String(output.approvalId ?? output.outreachId),
                  "Attaching files…",
                );
              }
              break;
            }
          }
        }, 320);
        return () => clearTimeout(t);
      }
    }
  }, [messages]);

  useEffect(() => {
    const refresh = () => {
      refetchHistory();
      refetchTopActions();
    };
    const channel = supabase
      .channel("agent_messages_panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () =>
        refetchTopActions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_emails" }, () =>
        refetchTopActions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () =>
        refetchTopActions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "brand_matches" }, () =>
        refetchTopActions(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchHistory, refetchTopActions]);

  // Refetch the rail after each assistant turn too, so it reflects
  // anything the agent just did (draft sent, status updated, etc.).
  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      refetchTopActions();
    }
  }, [status, messages.length, refetchTopActions]);

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || status === "submitted" || status === "streaming") return;
    if (!override) setInput("");
    setOpenerSuggestions([]);
    await sendMessage({ text });
  };

  // Every email surface across the dashboard routes email opens into chat
  // via this event. We synthesize a natural-language message so the agent
  // picks the right inline tool (showEmailThread / showReplyDraft / showEmailDraft).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenEmailDetail>).detail;
      if (!detail) return;
      const brand = detail.brandName?.trim() || "this brand";
      const idHint = detail.outreachId ? ` (outreach id: ${detail.outreachId})` : "";
      if (detail.kind === "outreach" && detail.outreachId) {
        void openDraftInChat({
          data: {
            outreachId: detail.outreachId,
            approvalId: detail.approvalId ?? null,
            brandName: detail.brandName ?? null,
          },
        })
          .then((res) => {
            if (!res.ok) throw new Error(res.error);
            const row = res.message as StoredMessage;
            setInstantRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
            setMessages((prev) =>
              prev.some((m) => m.id === row.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: row.id,
                      role: "assistant",
                      parts: [{ type: "text", text: row.content }],
                    } satisfies UIMessage,
                  ],
            );
            void refetchHistory();
          })
          .catch(() => {
            void handleSend(
              `Open my pitch draft to ${brand} right here in chat so I can review, edit, and send it without leaving.${idHint}`,
            );
          });
        return;
      }
      let prompt = "";
      if (detail.kind === "reply") {
        prompt = `Open the reply from ${brand} right here in chat — show me what they said and draft the response so I can edit and send it from here.${idHint}`;
      } else if (detail.kind === "outreach") {
        prompt = `Open my pitch draft to ${brand} right here in chat so I can review, edit, and send it without leaving.${idHint}`;
      } else {
        prompt = `Show me the full email thread with ${brand} right here in chat — what I sent and anything back.${idHint}`;
      }
      void handleSend(prompt);
    };
    window.addEventListener(OPEN_EMAIL_EVENT, handler as EventListener);
    const askHandler = (e: Event) => {
      const d = (e as CustomEvent<{ prompt: string }>).detail;
      if (d?.prompt) void handleSend(d.prompt);
    };
    window.addEventListener(ASK_AGENT_EVENT, askHandler as EventListener);
    return () => {
      window.removeEventListener(OPEN_EMAIL_EVENT, handler as EventListener);
      window.removeEventListener(ASK_AGENT_EVENT, askHandler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  const storedById = useMemo(() => {
    const m = new Map<string, StoredMessage>();
    combinedStored.forEach((s) => m.set(s.id, s));
    return m;
  }, [combinedStored]);

  return (
    <div className="chat-agent flex h-full flex-col bg-secondary/50">
      {/* Header — matches landing widget */}
      <header className="flex flex-col gap-2 border-b border-foreground/[0.06] bg-gradient-to-b from-secondary/60 to-transparent px-4 py-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-background ring-1 ring-foreground/15 shadow-[0_0_20px_-4px_oklch(0.55_0.22_295/0.6)]">
            <MatchAILogo variant="mark" size="sm" className="h-6 w-6" ariaLabel="MatchAI" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="break-words text-[13px] font-semibold text-foreground">
              Your MatchAI agent
            </div>
            <div className="flex min-w-0 items-start gap-1.5 text-[10.5px] text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  autonomy >= 2
                    ? "bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]"
                    : "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                )}
              />
              <span className="min-w-0 break-words">{AUTONOMY_STATUS[autonomy]}</span>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600">
            LIVE
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Autonomy level"
          title="How much MatchAI does on its own. Manual = confirm everything. Suggest = I recommend, you decide. Draft = I draft & queue, you send. Autopilot = I run it, only ask on money or unclear judgment calls."
          className="grid w-full grid-cols-2 gap-0.5 rounded-2xl border border-foreground/10 bg-white/70 p-0.5 sm:grid-cols-4"
        >
          {AUTONOMY_LEVELS.map((lvl, i) => (
            <button
              key={lvl.key}
              type="button"
              role="radio"
              aria-checked={autonomy === i}
              onClick={() => setAutonomy(i)}
              title={lvl.tooltip}
              className={cn(
                "min-h-8 min-w-0 rounded-full px-2 py-1 text-[10.5px] font-semibold leading-tight transition-all",
                autonomy === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground",
              )}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const dbRow = storedById.get(m.id);
          const isUser = m.role === "user";
          const toolParts = m.parts.filter(
            (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
          ) as Array<{ type: string; input?: unknown; output?: unknown; state?: string }>;
          const toolSteps = toolParts.map((p) => ({
            type: p.type.replace(/^tool-/, ""),
            input: p.input,
            output: p.output,
            done: p.output !== undefined,
          }));
          const toolCards = toolSteps
            .filter((c) => c.output)
            .map((c) => ({ type: c.type, output: c.output }));
          return (
            <div key={m.id} className={cn("flex", isUser ? "justify-end" : "items-start gap-2")}>
              {!isUser && (
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-transparent">
                  <MatchAILogo variant="mark" size="sm" className="h-4 w-4" ariaLabel="MatchAI" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] text-[13px] leading-relaxed",
                  isUser
                    ? "rounded-2xl rounded-br-sm bg-primary hover:bg-primary/90 transition-colors px-3.5 py-2 font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
                    : "text-foreground",
                )}
              >
                {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                {!isUser && toolSteps.length > 0 && (
                  <div className="mt-1">
                    {toolSteps.map((s, i) => (
                      <AgentActivityStep
                        key={`step-${m.id}-${i}`}
                        label={labelForToolCall(s.type, s.input, s.output)}
                        done={s.done}
                      />
                    ))}
                  </div>
                )}
                {!isUser &&
                  toolCards.map((c, i) => (
                    <InlineToolCard
                      key={`${m.id}-${i}`}
                      type={c.type}
                      output={c.output}
                      messageId={dbRow?.id}
                      onQuickPrompt={(p) => void sendMessage({ text: p })}
                      onNavigate={(to) => navigate({ to })}
                    />
                  ))}
                {dbRow?.requires_approval && (
                  <ApprovalCard
                    messageId={dbRow.id}
                    data={dbRow.inline_card_data}
                    cardType={dbRow.inline_card_type}
                    status={
                      (dbRow.approval_status as
                        | "pending"
                        | "executed"
                        | "declined"
                        | "failed"
                        | null) ?? "pending"
                    }
                    onChange={refetchHistory}
                  />
                )}
              </div>
            </div>
          );
        })}
        {isLoading && <AgentThinking pathname={pathname} />}
      </div>

      {/* Top 5 Next Actions rail — always 5, stage-aware, max 3 per kind.
          Updates live as approvals/outreach/deals/brand_matches change. */}
      {!isLoading &&
        (() => {
          const actions = topData?.actions ?? [];
          if (!actions.length) return null;
          return (
            <div className="border-t border-foreground/[0.04] bg-gradient-to-b from-primary/[0.03] to-transparent px-4 pb-3 pt-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-1.5">
                <span className="min-w-0 break-words text-[11px] font-semibold tracking-wide text-foreground/80">
                  ✨ Here's what I'd tackle next
                </span>
                <span className="break-words text-[10.5px] italic text-muted-foreground/80">
                  tap one — I'll take it from here
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((a, i) => (
                  <button
                    key={`${a.kind}-${i}-${a.label}`}
                    type="button"
                    onClick={() => void handleSend(a.prompt)}
                    title={a.prompt}
                    className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/90 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="flex items-end gap-2 border-t border-foreground/[0.06] bg-foreground/[0.02] p-2.5"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask MatchAI to find, draft, send, release, or update anything…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-foreground/[0.06] bg-background/40 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary hover:bg-primary/90 transition-colors text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/**
 * Perplexity-style rotating "thinking" line. Cycles contextual reasoning states
 * every 1.8s so the wait feels like the agent is actively working, not stalled.
 */
function AgentThinking({ pathname }: { pathname: string }) {
  const states = useMemo(() => thinkingStatesFor(pathname), [pathname]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % states.length), 1800);
    return () => clearInterval(t);
  }, [states.length]);
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-transparent">
        <MatchAILogo variant="mark" size="sm" className="h-4 w-4" ariaLabel="MatchAI" />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]"
          style={{ animation: "pulse 1.4s ease-in-out infinite" }}
        />
        <span
          key={states[i]}
          className="animate-fade-in bg-gradient-to-r from-foreground/30 via-foreground to-foreground/30 bg-[length:200%_100%] bg-clip-text text-[12.5px] font-medium text-transparent"
          style={{ animation: "fade-in 0.4s ease-out, shimmerText 2.6s linear infinite" }}
        >
          {states[i]}
        </span>
      </div>
      <style>{`@keyframes shimmerText { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

function thinkingStatesFor(pathname: string): string[] {
  if (pathname.startsWith("/dashboard/brands")) {
    return [
      "Reading your creator profile…",
      "Scanning 2,400+ brand signals…",
      "Ranking fit by audience overlap…",
      "Shortlisting the top matches…",
    ];
  }
  if (pathname.startsWith("/dashboard/approvals")) {
    return [
      "Reading the latest brand reply…",
      "Checking your voice + rate floor…",
      "Drafting the response…",
    ];
  }
  if (pathname.startsWith("/dashboard/deals")) {
    return [
      "Pulling deal + external payment status…",
      "Checking deliverables and terms…",
      "Preparing the next best action…",
    ];
  }
  if (pathname.startsWith("/dashboard/analytics")) {
    return [
      "Aggregating outreach → reply → close…",
      "Computing conversion by cohort…",
      "Summarizing what's working…",
    ];
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return ["Reading your account…", "Checking connections…"];
  }
  return ["Reading your workspace…", "Thinking through your ask…", "Preparing the answer…"];
}
