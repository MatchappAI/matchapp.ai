import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  Sparkles,
  Inbox,
  Briefcase,
  BarChart3,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { loadAgentMessages } from "@/lib/agent-chat.functions";
import { getChatOpener } from "@/lib/chat-openers.functions";
import { ApprovalCard } from "./ApprovalCard";

type QuickAction = {
  icon: typeof Sparkles;
  label: string;
  hint: string;
  to: "/dashboard/brands" | "/dashboard/approvals" | "/dashboard/deals" | "/dashboard/analytics" | "/dashboard/settings";
  prompt: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Sparkles,
    label: "Brand Matches",
    hint: "Find & approve new brand fits",
    to: "/dashboard/brands",
    prompt: "Open Brand Matches and surface the top new fits for me to approve.",
  },
  {
    icon: Inbox,
    label: "Replies",
    hint: "Review incoming brand replies",
    to: "/dashboard/approvals",
    prompt: "Open Replies and summarize what needs my attention right now.",
  },
  {
    icon: Briefcase,
    label: "Deals",
    hint: "Track active partnerships",
    to: "/dashboard/deals",
    prompt: "Open Deals and tell me which ones need action today.",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    hint: "See revenue & performance",
    to: "/dashboard/analytics",
    prompt: "Open Analytics and highlight what changed this week.",
  },
  {
    icon: Settings,
    label: "Settings",
    hint: "Adjust preferences & auto-pilot",
    to: "/dashboard/settings",
    prompt: "Open Settings so I can tune what MatchAI can act on.",
  },
];


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

/**
 * Chat-first Home. The conversation IS the interface.
 * No stacked briefing cards, no chips, no widgets — the agent speaks first in
 * natural language. Approval cards render inline mid-conversation when the
 * agent surfaces a decision. Everything else lives in the sidebar.
 */
export function HomeChatStream() {
  const [input, setInput] = useState("");
  const [openerShown, setOpenerShown] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMsgs = useServerFn(loadAgentMessages);
  const opener = useServerFn(getChatOpener);

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["agent-messages"],
    queryFn: () => loadMsgs({ data: {} as never }),
  });

  const stored = (historyData?.messages ?? []) as StoredMessage[];

  const initialUIMessages = useMemo<UIMessage[]>(() => {
    if (!stored.length) return [];
    const last = stored[stored.length - 1];
    const age = Date.now() - new Date(last.created_at).getTime();
    if (age > SESSION_TTL_MS) return [];
    return stored.slice(-8).map<UIMessage>((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: m.content }],
    }));
  }, [stored]);

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
            body: { messages, currentPage: "/dashboard" },
            headers,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "dashboard-agent",
    messages: initialUIMessages,
    transport,
  });

  useEffect(() => {
    if (initialUIMessages.length && messages.length === 0) {
      setMessages(initialUIMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUIMessages.length]);

  // Hero greeting replaces the auto-opener on empty state.
  // Only fire the opener if we have restored history but no messages loaded yet.
  useEffect(() => {
    if (openerShown) return;
    if (initialUIMessages.length > 0) {
      setOpenerShown(true);
    }
  }, [openerShown, initialUIMessages.length]);
  void opener; // keep import used in case we re-enable later


  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text });
    textareaRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  const storedById = useMemo(() => {
    const m = new Map<string, StoredMessage>();
    stored.forEach((s) => m.set(s.id, s));
    return m;
  }, [stored]);

  const navigate = useNavigate();


  const hasConversation = messages.length > 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 overflow-y-auto px-4",
          hasConversation ? "space-y-8 py-8" : "flex flex-col justify-center py-6",
        )}
      >
        {!hasConversation && !isLoading && (
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
              <MatchAILogo variant="mark" className="h-12 w-12" ariaLabel="MatchAI" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              What should MatchAI do today?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Your agent can find brands, draft pitches, send outreach, and reply to deals — all it
              needs is your approval on what matters.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-foreground/10">
              <ShieldCheck className="h-3 w-3" />
              You approve everything before it goes out
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const dbRow = storedById.get(m.id);
          const isUser = m.role === "user";
          if (isUser) {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
                  <p className="whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            );
          }
          return <AgentTurn key={m.id} text={text} dbRow={dbRow} onChange={refetchHistory} />;
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <AgentAvatar />
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-[15px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer + quick actions (only shown on empty state) */}
      <div className="px-4 pb-4 pt-2">
        <div
          className={cn(
            "relative flex items-end gap-2 rounded-3xl border bg-foreground/[0.02] px-4 py-2 transition-colors",
            "border-foreground/10 focus-within:border-primary/50 focus-within:bg-foreground/[0.03]",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={hasConversation ? "Message MatchAI" : "Tell MatchAI what to do — it will ask before acting"}
            className="max-h-40 min-h-[48px] flex-1 resize-none border-0 bg-transparent px-1 py-3 text-[15px] placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className={cn(
              "mb-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-foreground/[0.06] text-muted-foreground/60",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {!hasConversation && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.to}
                  onClick={() => navigate({ to: a.to })}
                  disabled={isLoading}
                  className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-left transition hover:border-primary/40 hover:bg-foreground/[0.04] disabled:opacity-50"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25 transition group-hover:bg-primary/25">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground break-words">{a.label}</span>
                    <span className="block text-[12px] text-muted-foreground break-words">{a.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}


        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          MatchAI acts on your behalf. Every send, reply, and deal waits for your approval.
        </p>
      </div>
    </div>
  );
}


function AgentAvatar() {
  return (
    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/[0.04] ring-1 ring-foreground/10">
      <MatchAILogo variant="mark" className="h-6 w-6" ariaLabel="MatchAI" />
    </div>
  );
}

function AgentTurn({
  text,
  dbRow,
  onChange,
}: {
  text: string;
  dbRow: StoredMessage | undefined;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 pt-1">
        {text && (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {text}
          </p>
        )}
        {dbRow?.requires_approval && (
          <div className="mt-3">
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
              onChange={onChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
