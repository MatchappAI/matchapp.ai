import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { loadAgentMessages } from "@/lib/agent-chat.functions";
import { getChatOpener } from "@/lib/chat-openers.functions";
import { ApprovalCard } from "./ApprovalCard";

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

const FALLBACK_ACTIONS = [
  { label: "Find brands", prompt: "Find brand matches that fit my niche and rate floor. Add the top 5 and tell me which to pitch first." },
  { label: "Draft outreach", prompt: "Draft outreach for my top matches — short, personal, ready to send. Show drafts for approval." },
  { label: "Price a deal", prompt: "Price a deal — ask brand and deliverables, then give quote, walk-away, and add-ons." },
  { label: "Deal status", prompt: "Status of every open deal and money owed. Flag anything stuck." },
];

export function HomeAgentChat({ displayName }: { displayName: string }) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMsgs = useServerFn(loadAgentMessages);
  const opener = useServerFn(getChatOpener);
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["agent-messages"],
    queryFn: () => loadMsgs({ data: {} as never }),
  });
  const { data: openerData } = useQuery({
    queryKey: ["agent-opener", "/dashboard"],
    queryFn: () => opener({ data: { currentPage: "/dashboard" } }),
    staleTime: 60_000,
  });
  const stored = (historyData?.messages ?? []) as StoredMessage[];
  const suggestions = (openerData?.suggestions?.length ? openerData.suggestions : FALLBACK_ACTIONS).slice(0, 6);


  const initialUIMessages = useMemo<UIMessage[]>(
    () =>
      stored.slice(-30).map<UIMessage>((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        parts: [{ type: "text", text: m.content }],
      })),
    [stored],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/agent",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return { body: { messages, currentPage: "/dashboard" }, headers };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "dashboard-agent",
    messages: initialUIMessages,
    transport,
  });

  // Seed restored history on first load.
  useEffect(() => {
    if (initialUIMessages.length && messages.length === 0) {
      setMessages(initialUIMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUIMessages.length]);

  // Auto-scroll.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Realtime refresh when approvals execute.
  useEffect(() => {
    const channel = supabase
      .channel("agent_messages_home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_messages" },
        () => refetchHistory(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchHistory]);

  // Focus textarea on mount.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    if (!text) setInput("");
    await sendMessage({ text: value });
    textareaRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const storedById = useMemo(() => {
    const m = new Map<string, StoredMessage>();
    stored.forEach((s) => m.set(s.id, s));
    return m;
  }, [stored]);

  const hasConversation = messages.length > 0;

  return (
    <div className="rounded-3xl border border-foreground/[0.07] bg-gradient-to-b from-secondary/60 to-transparent backdrop-blur-xl">
      {/* Hero greeting */}
      <div className="px-6 pt-7 sm:px-8 sm:pt-9">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          Online
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Hey {displayName}.
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          What should I do?
        </p>
      </div>

      {/* Conversation */}
      {hasConversation && (
        <div
          ref={scrollerRef}
          className="mt-6 max-h-[min(58vh,520px)] space-y-4 overflow-y-auto px-6 sm:px-8"
        >
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const dbRow = storedById.get(m.id);
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl text-sm leading-relaxed",
                    isUser
                      ? "bg-primary px-4 py-2.5 text-primary-foreground"
                      : "bg-transparent text-foreground",
                  )}
                >
                  {text && <p className="whitespace-pre-wrap">{text}</p>}
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
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
                </span>
                Working on it…
              </div>
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-7">
        <div className="rounded-2xl border border-foreground/[0.08] bg-background/40 p-3 shadow-inner shadow-black/10 focus-within:border-primary/40">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Find brands, draft outreach, price a deal…"
            className="min-h-[56px] resize-none border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground/70">
              Enter to send · Shift+Enter for newline
            </p>
            <Button
              size="sm"
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim()}
              className="h-9 gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>

        {/* Personalized suggestions */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Suggested next steps
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                onClick={() => void handleSend(s.prompt)}
                disabled={isLoading}
                className="group flex items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.03] px-3 py-2.5 text-left text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="break-words text-[13px]">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
