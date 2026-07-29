import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link, useRouterState } from "@tanstack/react-router";
import { X, Send } from "lucide-react";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import mark from "@/assets/matchai-mark-transparent.png";

const STORAGE_KEY = "matchai:landing-chat:v1";
const NUDGE_DISMISS_KEY = "matchai:landing-chat:nudge-dismissed";
const AUTO_OPEN_SESSION_KEY = "matchai:landing-chat:auto-opened";
const CLOSED_KEY = "matchai:landing-chat:closed";
const AUTO_OPEN_DELAY_MS = 9000;
// Playful re-engage nudges when the chat sits idle
const IDLE_NUDGE_MS = 28000;
const MAX_IDLE_NUDGES = 2;
const IDLE_NUDGES = [
  "helllooo? 👀 still there?",
  "no rush — i'll be right here when you're ready ✌️",
];

type Persisted = {
  messages: UIMessage[];
  threadId: string;
  openedOnce: boolean;
};

const SUGGESTIONS = [
  "How do you find brands?",
  "I have 8K on IG — does this work for me?",
  "How much do creators earn?",
  "Is it really free to start?",
];

const GREETING: UIMessage = {
  id: "greeting-1",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "hey 👋 i'm MatchAI — the AI that lands brand deals for creators while you sleep. quick q: what kind of content do you make?",
    },
  ],
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { messages: [GREETING], threadId: "landing", openedOnce: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [GREETING], threadId: "landing", openedOnce: false };
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed.messages?.length) parsed.messages = [GREETING];
    return parsed;
  } catch {
    return { messages: [GREETING], threadId: "landing", openedOnce: false };
  }
}

type PageGuide = { label: string; context: string; nudge: string };

function describePage(pathname: string): PageGuide {
  const p = pathname || "/";
  if (p === "/" || p.startsWith("/#")) {
    return {
      label: "Landing",
      context:
        "User is on the public landing page. They haven't signed up yet. Help them understand if MatchAI fits their niche and nudge a free start.",
      nudge: "Curious if MatchAI fits your niche? Ask me anything — takes 30 seconds.",
    };
  }
  if (p.startsWith("/auth")) {
    return {
      label: "Sign in",
      context:
        "User is on the auth page. Reassure them: free to start, no card. Answer quick questions blocking sign-up.",
      nudge: "Stuck on sign-in? I can walk you through it.",
    };
  }
  if (p.startsWith("/onboarding")) {
    return {
      label: "Onboarding",
      context:
        "User is mid-onboarding. Guide them step by step: connect socials, set niche, set goals. Be encouraging and concrete.",
      nudge: "Want me to walk you through this step?",
    };
  }
  if (p.startsWith("/dashboard/approvals")) {
    return {
      label: "Approvals",
      context:
        "User is reviewing AI-drafted outreach awaiting their approval. Explain how approvals work, when to edit, when to send.",
      nudge: "Need a hand reviewing a draft?",
    };
  }
  if (p.startsWith("/dashboard/deals")) {
    return {
      label: "Deals",
      context:
        "User is on the deals tracker. Help them read deal stages, replies, and what to do next.",
      nudge: "Want me to read a brand reply for you?",
    };
  }
  if (p.startsWith("/dashboard/tracker")) {
    return {
      label: "Tracker",
      context:
        "User is on the tracker. Help them read thread status, follow-up timing, next actions, and how to move a deal forward.",
      nudge: "Want me to flag what needs action?",
    };
  }
  if (p.startsWith("/dashboard/tools")) {
    return {
      label: "Tools",
      context:
        "User is on the tools page. Help them check offers, estimate rates, draft counteroffers, and write replies.",
      nudge: "Want me to check an offer?",
    };
  }
  if (p.startsWith("/dashboard/brands")) {
    return {
      label: "Brand matches",
      context:
        "User is browsing brand matches. Explain fit scores, why brands match, and what to do next.",
      nudge: "Want me to explain a match?",
    };
  }
  if (p.startsWith("/dashboard/settings")) {
    return {
      label: "Settings",
      context:
        "User is in settings. Help them connect socials, set preferences, manage integrations.",
      nudge: "Need help configuring something?",
    };
  }
  if (p.startsWith("/dashboard")) {
    return {
      label: "Dashboard",
      context:
        "User is signed in and on the dashboard. Be a hands-on operator: tell them what to do next.",
      nudge: "Want me to suggest your next move?",
    };
  }
  return {
    label: "MatchAI",
    context: "User is somewhere in the MatchAI product. Be helpful and concise.",
    nudge: "Need a hand? I'm here.",
  };
}

export function LandingChatWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [input, setInput] = useState("");
  // Initialize synchronously from localStorage so useChat below picks up
  // persisted messages on first render. loadPersisted() is SSR-safe.
  const initial = useRef<Persisted>(loadPersisted());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: initial.current.threadId,
    messages: initial.current.messages,
    transport: new DefaultChatTransport({ api: "/api/landing-chat" }),
    onError: (err) => console.error("[landing-chat]", err),
  });

  // Persist messages across pages/sessions
  useEffect(() => {
    if (!mounted) return;
    try {
      const payload: Persisted = {
        messages,
        threadId: initial.current.threadId,
        openedOnce: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [messages, mounted]);

  // Auto-open rules — never spam:
  //   • Only once per browser session (sessionStorage).
  //   • Never if the user has closed the widget before (respects their signal).
  //   • Never if they've already engaged (sent at least one message).
  //   • On non-landing pages, show a subtle nudge bubble instead.
  useEffect(() => {
    if (!mounted) return;
    if (open) return;

    const hasEngaged = messages.some((m) => m.role === "user");
    const wasClosed = localStorage.getItem(CLOSED_KEY) === "1";
    const alreadyAutoOpened = sessionStorage.getItem(AUTO_OPEN_SESSION_KEY) === "1";
    if (hasEngaged || wasClosed || alreadyAutoOpened) return;

    const isLanding = pathname === "/" || pathname.startsWith("/#");
    if (isLanding) {
      const t = setTimeout(() => {
        setOpen(true);
        try {
          sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
      }, 600);
      return () => clearTimeout(t);
    }
    const dismissed = localStorage.getItem(NUDGE_DISMISS_KEY) === "1";
    if (dismissed) return;
    const t = setTimeout(() => setShowNudge(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [mounted, open, pathname, messages]);

  // Auto-scroll
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, status]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Interactive idle nudges — playful "helllooo? 👀" style pings when the user
  // goes quiet after the agent's last message. Capped so we never spam.
  const idleNudgeCountRef = useRef(0);
  useEffect(() => {
    if (!open || status === "submitted" || status === "streaming") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") {
      // User just sent something — reset the counter for the next lull.
      idleNudgeCountRef.current = 0;
      return;
    }
    // Don't stack a nudge on top of an existing nudge.
    const lastText = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    if (IDLE_NUDGES.includes(lastText)) return;
    if (idleNudgeCountRef.current >= MAX_IDLE_NUDGES) return;

    const t = setTimeout(() => {
      const text = IDLE_NUDGES[idleNudgeCountRef.current] ?? IDLE_NUDGES[IDLE_NUDGES.length - 1];
      idleNudgeCountRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `nudge-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text }],
        },
      ]);
    }, IDLE_NUDGE_MS);
    return () => clearTimeout(t);
  }, [messages, open, status, setMessages]);

  function dismissNudge() {
    setShowNudge(false);
    try {
      localStorage.setItem(NUDGE_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function handleOpen() {
    setOpen(true);
    dismissNudge();
    // User re-opened intentionally — allow future idle nudges again.
    try {
      localStorage.removeItem(CLOSED_KEY);
    } catch {
      /* ignore */
    }
    idleNudgeCountRef.current = 0;
  }

  function reset() {
    setMessages([GREETING]);
    idleNudgeCountRef.current = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Page-aware context — route the assistant to act as a guide on the current page/section
  const pageContext = useMemo(() => describePage(pathname), [pathname]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text: trimmed }, { body: { pathname, pageContext: pageContext.context } });
  }

  if (!mounted) return null;

  const isLoading = status === "submitted" || status === "streaming";
  const nudgeCopy = pageContext.nudge;

  return (
    <>
      {/* Nudge bubble */}
      {showNudge && !open && (
        <div className="fixed bottom-24 right-4 z-[60] max-w-[260px] animate-in fade-in slide-in-from-bottom-2 sm:right-6">
          <div className="relative rounded-2xl border border-foreground/10 bg-background p-3.5 pr-8 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.35)] backdrop-blur-xl">
            <button
              type="button"
              onClick={dismissNudge}
              className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground on-dark"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
            <button type="button" onClick={handleOpen} className="block w-full text-left">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <span className="grid h-4 w-4 place-items-center overflow-hidden rounded-[5px] bg-transparent">
                  <MatchAILogo
                    variant="mark"
                    size="sm"
                    className="h-2.5 w-2.5"
                    ariaLabel="MatchAI"
                  />
                </span>
                MatchAI · live
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-foreground">{nudgeCopy}</p>
            </button>
          </div>
          <div className="ml-auto mr-6 h-2 w-2 rotate-45 -translate-y-1 rounded-sm border-b border-r border-foreground/10 bg-background" />
        </div>
      )}

      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Chat with MatchAI"
          className="fixed bottom-5 right-4 z-[60] grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-background text-primary-foreground shadow-[0_18px_40px_-10px_rgba(99,102,241,0.55)] ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-12px_rgba(99,102,241,0.7)] sm:right-6"
        >
          <img
            src={mark}
            alt="MatchAI"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]">
          <div className="chat-agent flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-2xl sm:max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-foreground/[0.06] bg-gradient-to-b from-secondary/60 to-transparent px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-transparent">
                  <MatchAILogo variant="mark" size="sm" className="h-5 w-5" ariaLabel="MatchAI" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">MatchAI</div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    online · usually replies instantly
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md px-2 py-1 text-[10.5px] font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    try {
                      localStorage.setItem(CLOSED_KEY, "1");
                    } catch {
                      /* ignore */
                    }
                  }}
                  aria-label="Close chat"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => {
                const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? "justify-end" : "items-start gap-2"}`}
                  >
                    {!isUser && (
                      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-transparent">
                        <MatchAILogo
                          variant="mark"
                          size="sm"
                          className="h-4 w-4"
                          ariaLabel="MatchAI"
                        />
                      </div>
                    )}
                    <div
                      className={
                        isUser
                          ? "max-w-[82%] rounded-2xl rounded-br-sm bg-primary hover:bg-primary/90 transition-colors px-3.5 py-2 text-[13px] font-medium leading-relaxed text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
                          : "max-w-[82%] rounded-2xl rounded-tl-sm border border-foreground/[0.06] bg-foreground/[0.03] px-3.5 py-2 text-[13px] leading-relaxed text-foreground"
                      }
                    >
                      {text || (isUser ? "" : "…")}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-transparent">
                    <MatchAILogo variant="mark" size="sm" className="h-4 w-4" ariaLabel="MatchAI" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-foreground/[0.06] bg-foreground/[0.03] px-3.5 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions (only on first turn) */}
            {messages.length <= 1 && !isLoading && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* CTA bar */}
            <div className="border-t border-foreground/[0.06] bg-gradient-to-r from-primary/10 to-transparent px-3 py-2">
              <Link
                to="/auth"
                className="flex items-center justify-between rounded-xl bg-foreground/95 px-3 py-2 text-[12px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                <span>Start free · first match in 2 min</span>
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="flex items-end gap-2 border-t border-foreground/[0.06] bg-foreground/[0.02] p-2.5"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
                placeholder="Ask me anything…"
                className="max-h-32 flex-1 resize-none rounded-xl border border-foreground/[0.06] bg-background/40 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary hover:bg-primary/90 transition-colors text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Send className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
