import { motion } from "framer-motion";
import { Radar, PenLine, Clock3, Scale } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

type Tone = "violet" | "fuchsia" | "sky" | "emerald";

const toneMap: Record<Tone, { chip: string; ring: string; accent: string; glow: string }> = {
  violet: {
    chip: "border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-700",
    ring: "ring-indigo-500/30",
    accent: "text-indigo-700",
    glow: "from-indigo-500/20",
  },
  fuchsia: {
    chip: "border-violet-500/25 bg-violet-500/[0.08] text-violet-700",
    ring: "ring-violet-500/30",
    accent: "text-violet-700",
    glow: "from-violet-500/20",
  },
  sky: {
    chip: "border-sky-500/25 bg-sky-500/[0.08] text-sky-700",
    ring: "ring-sky-500/30",
    accent: "text-sky-700",
    glow: "from-sky-500/20",
  },
  emerald: {
    chip: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-700",
    ring: "ring-emerald-500/30",
    accent: "text-emerald-700",
    glow: "from-emerald-500/20",
  },
};

type Module = {
  icon: typeof Radar;
  tone: Tone;
  kicker: string;
  title: string;
  formula: string;
  signals: string[];
  outcome: { label: string; value: string };
};

const modules: Module[] = [
  {
    icon: Radar,
    tone: "violet",
    kicker: "Matching",
    title: "How we find brands worth your time",
    formula:
      "fit = audience overlap × niche relevance × spend signal × geo proximity × reachability",
    signals: [
      "Your niche & sub-niches",
      "Audience age, gender, geo split",
      "Engagement rate vs. follower count",
      "Brand's recent paid-creator activity",
      "Funding stage & employee count",
      "Local / national reach",
      "Past category fit",
      "Direct contact found (yes/no)",
      "Seasonality & launch windows",
    ],
    outcome: { label: "Result", value: "0–100 fit score · pitch / maybe / skip" },
  },
  {
    icon: PenLine,
    tone: "fuchsia",
    kicker: "Personalization",
    title: "How every pitch sounds like you — to them",
    formula: "draft = your voice profile × brand context × recent post hook × deliverable proposal",
    signals: [
      "Your last 30 posts (tone & cadence)",
      "Phrases you actually use",
      "Brand's latest launch / campaign",
      "Their founder's bio & POV",
      "Audience match line (e.g. 38% Austin)",
      "Suggested deliverable mix",
      "Subject line A/B variants",
      "Opening hook tied to a real post",
      "Length tuned to inbox vs. DM",
    ],
    outcome: { label: "Result", value: "1 subject + 1 draft + alt opener, ready to send" },
  },
  {
    icon: Clock3,
    tone: "sky",
    kicker: "Follow-ups",
    title: "How we keep deals alive without being annoying",
    formula:
      "next_touch = days_since_open × reply_likelihood × your follow-up cap × time-of-day fit",
    signals: [
      "Open / read / click tracking",
      "Reply-likelihood by industry & role",
      "Best send window in their timezone",
      "Day-2, day-5, day-12 cadence (editable)",
      "Auto-stop after N silent touches",
      "Different angle each follow-up",
      "Holiday & weekend skips",
      "Auto-pause when they reply",
      "Ghost-list: don't re-pitch dead leads",
    ],
    outcome: { label: "Result", value: "2–3× more replies vs. one-and-done outreach" },
  },
  {
    icon: Scale,
    tone: "emerald",
    kicker: "Negotiation",
    title: "How we price the deal so you stop undercharging",
    formula: "rate = (CPM × reach) × deliverable mix × usage × exclusivity × brand size × scarcity",
    signals: [
      "Your true reach per platform",
      "Engagement-adjusted CPM",
      "Deliverable count & format (Reel/Story/UGC)",
      "Usage rights window (30/60/90d)",
      "Whitelisting & paid ads add-ons",
      "Category exclusivity premium",
      "Brand size & budget tier",
      "Current demand for your niche",
      "Floor price — never go below",
      "Clear terms + delivery milestones",
    ],
    outcome: {
      label: "Result",
      value: "Estimated rate + counter-offer script + clear payment terms",
    },
  },
];

export function Engine() {
  return (
    <section
      id="engine"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.18_295/0.04),transparent_70%)]" />

      <Reveal className="max-w-2xl">
        <SectionEyebrow>UNDER THE HOOD</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Not a chatbot.{" "}
          <span className="bg-gradient-to-br from-[#1E1B4B] via-[#4F46E5] to-[#8B5CF6] bg-clip-text text-transparent">
            A real system, doing real work.
          </span>
        </h2>
        <p className="mt-5 text-[15.5px] leading-[1.7] text-muted-foreground">
          Every match, pitch, follow-up, and rate comes out of a real formula — built from dozens of
          signals about you, the brand, and what's been closing for creators like you.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-5 lg:grid-cols-2" stagger={0.08}>
        {modules.map((m) => {
          const t = toneMap[m.tone];
          return (
            <motion.div
              key={m.title}
              variants={itemVariants}
              className="spotlight glass glass-hover group relative overflow-hidden rounded-2xl p-6 sm:p-7"
            >
              <div
                className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${t.glow} to-transparent blur-2xl`}
              />

              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-background/40 ring-1 ${t.ring}`}
                >
                  <m.icon className={`h-4 w-4 ${t.accent}`} strokeWidth={1.9} />
                </span>
                <div className="flex flex-col">
                  <span
                    className={`text-[10.5px] font-semibold uppercase tracking-[0.16em] ${t.accent}`}
                  >
                    {m.kicker}
                  </span>
                  <h3 className="text-[15.5px] font-semibold text-foreground">{m.title}</h3>
                </div>
              </div>

              {/* Formula */}
              <div className="mt-5 rounded-xl border border-foreground/[0.06] bg-background/40 p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  Formula
                </div>
                <code className="mt-1.5 block font-mono text-[12px] leading-relaxed text-foreground/90">
                  {m.formula}
                </code>
              </div>

              {/* Signal chips */}
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  Signals we use ({m.signals.length})
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.signals.map((s) => (
                    <span
                      key={s}
                      className={`rounded-md border px-2 py-1 text-[11px] leading-tight ${t.chip}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-foreground/[0.06] pt-4">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                  {m.outcome.label}
                </span>
                <span className={`text-right text-[12.5px] font-medium ${t.accent}`}>
                  {m.outcome.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </StaggerGroup>

      <Reveal className="mt-10">
        <p className="text-xs text-muted-foreground">
          Self-tuning: every reply and every close feeds back, so matches, drafts, cadence, and
          quotes sharpen week over week.
        </p>
      </Reveal>
    </section>
  );
}
