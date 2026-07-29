// Fires an event the DashboardChatPanel listens for, so every email surface
// (drafts, replies, sent threads) opens INSIDE the chat instead of a slide-over
// or separate page. The chat then asks the agent to render the email inline
// using the existing showEmailDraft / showReplyDraft / showEmailThread tools.

export type OpenEmailKind = "outreach" | "reply" | "thread";

export type OpenEmailDetail = {
  kind: OpenEmailKind;
  outreachId?: string | null;
  approvalId?: string | null;
  brandName?: string | null;
};

export const OPEN_EMAIL_EVENT = "matchai:open-email";

export function openEmailInChat(detail: OpenEmailDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EMAIL_EVENT, { detail }));
}

// Generic "ask MatchAI in chat" — any button on the stage can push a natural
// language prompt into the chat panel so the agent handles it inline.
export const ASK_AGENT_EVENT = "matchai:ask-agent";
export function askAgentInChat(prompt: string) {
  if (typeof window === "undefined" || !prompt.trim()) return;
  window.dispatchEvent(new CustomEvent(ASK_AGENT_EVENT, { detail: { prompt } }));
}
