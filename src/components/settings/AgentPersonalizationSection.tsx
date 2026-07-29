import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brain, Trash2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPersonalization,
  updatePersonalization,
  addAgentMemory,
  removeAgentMemory,
} from "@/lib/dashboard.functions";

type Key =
  | "growth_stage"
  | "confidence_level"
  | "voice_formality"
  | "voice_length"
  | "voice_warmth"
  | "cta_style"
  | "explanation_level"
  | "autonomy_level"
  | "pricing_aggressiveness";

const GROUPS: { key: Key; title: string; help: string; options: { id: string; label: string; hint: string }[] }[] = [
  {
    key: "growth_stage",
    title: "Where you are right now",
    help: "I'll match my strategy to your stage.",
    options: [
      { id: "beginner", label: "Just starting", hint: "Realistic brands, soft asks, more reassurance." },
      { id: "growing", label: "Growing", hint: "Mix of encouragement and strategy." },
      { id: "established", label: "Established", hint: "Direct, strategic, higher rates." },
    ],
  },
  {
    key: "confidence_level",
    title: "How you feel about pitching",
    help: "I'll match the energy so it doesn't feel scary or slow.",
    options: [
      { id: "nervous", label: "A bit nervous", hint: "I'll lower the pressure and frame asks softly." },
      { id: "balanced", label: "It's fine", hint: "Standard tone." },
      { id: "confident", label: "Confident", hint: "I'll skip the hand-holding and be blunt." },
    ],
  },
  {
    key: "voice_formality",
    title: "How I should sound",
    help: "Casual feels like a DM. Polished still stays human.",
    options: [
      { id: "casual", label: "Casual", hint: "Relaxed, contractions, DM-style." },
      { id: "balanced", label: "Balanced", hint: "Conversational but clean." },
      { id: "professional", label: "Polished", hint: "Tighter language, still human." },
    ],
  },
  {
    key: "voice_length",
    title: "How much I say",
    help: "Short = texting a friend. Detailed = full reasoning.",
    options: [
      { id: "short", label: "Short", hint: "1-2 sentences. No padding." },
      { id: "medium", label: "Medium", hint: "2-4 sentences when explaining." },
      { id: "detailed", label: "Detailed", hint: "Full context and reasoning." },
    ],
  },
  {
    key: "voice_warmth",
    title: "Warmth vs. directness",
    help: "Warm protects feelings. Direct saves time.",
    options: [
      { id: "warm", label: "Warm", hint: "Supportive, encouraging." },
      { id: "neutral", label: "Neutral", hint: "Friendly but matter-of-fact." },
      { id: "direct", label: "Direct", hint: "Straight to the point." },
    ],
  },
  {
    key: "cta_style",
    title: "How asks should land in outreach",
    help: "I'll tune every draft to match this.",
    options: [
      { id: "soft", label: "Soft ask", hint: "Open the door, no pressure." },
      { id: "balanced", label: "Balanced", hint: "Propose an idea, invite a reply." },
      { id: "direct", label: "Direct", hint: "Specific package + price." },
    ],
  },
  {
    key: "explanation_level",
    title: "How much I should explain",
    help: "Want me to teach as I go, or just do it?",
    options: [
      { id: "handle_it", label: "Just handle it", hint: "Decisions only, no commentary." },
      { id: "balanced", label: "A little reasoning", hint: "Decision + one short line." },
      { id: "teach_me", label: "Teach me", hint: "Explain the strategy so I learn." },
    ],
  },
  {
    key: "autonomy_level",
    title: "How much freedom I have",
    help: "How often I should pause to check with you.",
    options: [
      { id: "low", label: "Check first", hint: "Confirm before drafting or changing rules." },
      { id: "medium", label: "Draft freely", hint: "Pause on money or sending." },
      { id: "high", label: "Move fast", hint: "Only flag money, contracts, replies." },
    ],
  },
  {
    key: "pricing_aggressiveness",
    title: "Pricing posture",
    help: "How hard I should push on rates.",
    options: [
      { id: "conservative", label: "Realistic", hint: "Quote what won't scare brands off." },
      { id: "balanced", label: "Balanced", hint: "Fair market, hold above floor." },
      { id: "aggressive", label: "Aggressive", hint: "Top of range, defend hard." },
    ],
  },
];

export function AgentPersonalizationSection() {
  const qc = useQueryClient();
  const fetchPers = useServerFn(getPersonalization);
  const savePers = useServerFn(updatePersonalization);
  const addMem = useServerFn(addAgentMemory);
  const removeMem = useServerFn(removeAgentMemory);
  const [draft, setDraft] = useState("");

  const q = useQuery({
    queryKey: ["personalization"],
    queryFn: () => fetchPers({ data: {} as never }),
  });

  const p = q.data?.personalization;
  const memory = q.data?.memory ?? [];

  async function setVal(key: Key, value: string) {
    const res = await savePers({ data: { [key]: value } as never });
    if (res.ok) {
      toast.success("Saved — I'll adjust right away");
      qc.invalidateQueries({ queryKey: ["personalization"] });
    } else {
      toast.error(res.error ?? "Could not save");
    }
  }

  async function onAddMemory(e: React.FormEvent) {
    e.preventDefault();
    if (draft.trim().length < 4) return;
    const res = await addMem({ data: { text: draft.trim(), source: "manual" } });
    if (res.ok) {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["personalization"] });
      toast.success("Added to Agent Memory");
    } else {
      toast.error("error" in res ? res.error : "Could not save");
    }
  }

  async function onForget(id: string) {
    const res = await removeMem({ data: { id } });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["personalization"] });
      toast.success("Forgotten");
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {GROUPS.map((g) => {
          const current = (p?.[g.key] ?? "") as string;
          return (
            <div key={g.key} className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                <h4 className="text-sm font-semibold text-foreground">{g.title}</h4>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{g.help}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {g.options.map((opt) => {
                  const active = current === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVal(g.key, opt.id)}
                      title={opt.hint}
                      className={
                        "rounded-xl border px-2 py-2 text-center text-[11px] font-medium transition-colors " +
                        (active
                          ? "border-primary/50 bg-primary/[0.08] text-foreground"
                          : "border-foreground/[0.06] bg-foreground/[0.02] text-muted-foreground hover:border-foreground/15 hover:text-foreground")
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {current ? (
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {g.options.find((o) => o.id === current)?.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
        <div className="mb-1 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary/80" />
          <h4 className="text-sm font-semibold text-foreground">Agent Memory</h4>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Durable rules I'll always follow when finding brands, writing outreach, pricing deals, or negotiating. Add anything — "never recommend gifted-only", "don't mention my follower count", "use a soft CTA in message one".
        </p>
        <form onSubmit={onAddMemory} className="mb-4 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='e.g. "Always ask for budget before quoting rates."'
            className="h-9"
            maxLength={240}
          />
          <Button type="submit" size="sm" disabled={draft.trim().length < 4}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </form>
        {memory.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            Nothing saved yet. I'll also propose rules to remember when you correct me in chat.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {memory.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-foreground/[0.04] bg-black/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{m.text}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.source === "chat" ? "Saved from chat" : m.source === "manual" ? "Added by you" : (m.source ?? "Saved")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onForget(m.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  title="Forget this rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
