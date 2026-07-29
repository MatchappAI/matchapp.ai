import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const OPENING_TEXT =
  "Hey, I'm your brand deals agent. I can find brands, draft outreach, follow up, help you price deals, and track payments. Want me to show you what I'd do for your creator profile?";

const OPENING_SUGGESTIONS = [
  "Find brands for me",
  "Show me how it works",
  "What should I charge?",
  "Can this work for my niche?",
  "Try free",
];

const TRANSPORT = new DefaultChatTransport({ api: "/api/chat/landing" });

function parseSuggestions(text: string): { clean: string; suggestions: string[] } {
  const match = text.match(/\[SUGGEST:\s*([^\]]+)\]/i);
  if (!match) return { clean: text.trim(), suggestions: [] };
  const suggestions = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  const clean = text.replace(match[0], "").trim();
  return { clean, suggestions };
}

function messageText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export function LandingAgentChat() {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const opening = useMemo<UIMessage>(
    () => ({
      id: "opening",
      role: "assistant",
      parts: [{ type: "text", text: OPENING_TEXT }],
    }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: "landing",
    messages: [opening],
    transport: TRANSPORT,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // Determine suggestions: from latest assistant message, or opening
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? messageText(lastAssistant) : "";
  const parsedLast = parseSuggestions(lastAssistantText);
  const showOpeningSuggestions = messages.length <= 1;
  const activeSuggestions = showOpeningSuggestions
    ? OPENING_SUGGESTIONS
    : parsedLast.suggestions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_295/0.15),transparent_70%)] blur-2xl" />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-[0_30px_80px_-20px_oklch(0.2_0.05_280/0.5)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-card/40 px-4 py-3">
          <div className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-background ring-1 ring-foreground/15 shadow-[0_0_20px_-4px_oklch(0.55_0.22_295/0.8)]">
            <MatchAILogo variant="mark" size="sm" className="h-6 w-6" ariaLabel="MatchAI" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Your MatchAI agent</div>
            <div className="text-[11px] text-muted-foreground">Online · ready when you are</div>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-400">
            LIVE
          </span>
        </div>

        {/* Messages */}
        <div
          ref={scrollerRef}
          className="max-h-[420px] overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.map((m) => {
            const raw = messageText(m);
            if (!raw && m.role === "assistant" && !isLoading) return null;
            const isAssistant = m.role === "assistant";
            const isLast = m.id === lastAssistant?.id;
            const display = isAssistant
              ? isLast
                ? parsedLast.clean
                : parseSuggestions(raw).clean
              : raw;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  isAssistant ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] whitespace-pre-wrap break-words text-[14px] leading-relaxed",
                    isAssistant
                      ? "text-foreground"
                      : "rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground",
                  )}
                >
                  {display || (isAssistant && isLoading ? "…" : "")}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Suggested replies */}
        {activeSuggestions.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {activeSuggestions.map((s) => {
              const isTryFree = /try (it )?free/i.test(s);
              if (isTryFree) {
                return (
                  <Link
                    key={s}
                    to="/auth"
                    className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/25"
                  >
                    {s} →
                  </Link>
                );
              }
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/90 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 border-t border-border/60 bg-card/40 p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask anything, or tell me your niche…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary hover:bg-primary/90 transition-colors text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Free to start · No credit card · Your agent learns as you chat
      </p>
    </motion.div>
  );
}
