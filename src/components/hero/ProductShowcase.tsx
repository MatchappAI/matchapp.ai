import { motion } from "framer-motion";
import { Send, Check, Pencil, CornerDownLeft, ShieldCheck, Clock, Wallet } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal } from "./Reveal";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

const tags = [
  "Beauty & skincare",
  "Prestige retailer",
  "Beauty Insider creators",
  "Reels + Tutorials",
];

function AgentAvatar() {
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background ring-1 ring-foreground/15 shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] overflow-hidden">
      <MatchAILogo variant="mark" size="sm" className="h-5 w-5" ariaLabel="MatchAI" />
    </div>
  );
}

function UserBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary hover:bg-primary/90 transition-colors px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]">
        {children}
      </div>
    </motion.div>
  );
}

function AgentBubble({
  children,
  delay = 0,
  bare = false,
}: {
  children: React.ReactNode;
  delay?: number;
  bare?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex items-start gap-2.5"
    >
      <AgentAvatar />
      <div
        className={
          bare
            ? "max-w-[88%] flex-1"
            : "max-w-[88%] flex-1 rounded-2xl rounded-tl-sm border border-foreground/[0.06] bg-foreground/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground"
        }
      >
        {children}
      </div>
    </motion.div>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "violet";
}) {
  const tones = {
    default: "border-foreground/[0.08] bg-foreground/[0.03] text-foreground",
    emerald: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
    violet: "border-violet-400/25 bg-violet-400/[0.08] text-violet-200",
  };
  return (
    <div className={`flex flex-col rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <span className="text-[9.5px] uppercase tracking-wider opacity-75">{label}</span>
      <span className="mt-0.5 text-[13px] font-bold tracking-tight">{value}</span>
    </div>
  );
}

export function ProductShowcase() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_295/0.08),transparent_70%)]" />

      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <SectionEyebrow>ONE CHAT · END-TO-END</SectionEyebrow>
        </div>
        <h2 className="mt-6 text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          From brand match to{" "}
          <span className="bg-gradient-to-br from-[#1E1B4B] via-[#4F46E5] to-[#8B5CF6] bg-clip-text text-transparent">
            money in your account.
          </span>
        </h2>
        <p className="mt-5 text-[15px] leading-[1.7] text-muted-foreground">
          Your agent finds the brand, sends the pitch from our verified domain, handles replies in
          one thread per brand, negotiates the rate, tracks payment through Stripe, and pays out to
          your bank. You just tap Approve.
        </p>
      </Reveal>

      {/* Overnight stats strip */}
      <Reveal className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Brands scanned" value="2,000" />
        <StatPill label="Matched 90%+" value="12" tone="violet" />
        <StatPill label="Pitches drafted" value="6" />
        <StatPill label="Potential deal value" value="$800" tone="emerald" />
      </Reveal>

      <div className="relative mx-auto mt-12 max-w-3xl">
        {/* Browser frame */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ perspective: 1200 }}
          className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
        >
          {/* glass top sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* title bar */}
          <div className="flex items-center gap-2 border-b border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <div className="ml-3 hidden flex-1 items-center justify-center gap-2 sm:flex">
              <MatchAILogo variant="mark" size="sm" className="h-4 w-4" ariaLabel="MatchAI" />
              <div className="text-[11px] font-medium text-foreground/80">
                MatchAI · your brand-deals manager
              </div>
              <span className="ml-2 flex items-center gap-1 text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                online
              </span>
            </div>
          </div>

          {/* Chat thread */}
          <div className="space-y-3.5 p-5 sm:p-7">
            {/* 1. Overnight scan summary */}
            <AgentBubble delay={0.05}>
              Morning ☀️ Overnight I scanned{" "}
              <span className="font-semibold text-foreground">2,000 brands</span>, shortlisted{" "}
              <span className="font-semibold text-foreground">12</span> at 90%+ fit, and drafted{" "}
              <span className="font-semibold text-foreground">6 pitches</span>. Here's the one I'd
              send first —
            </AgentBubble>

            {/* 2. Brand match card */}
            <AgentBubble delay={0.15} bare>
              <div className="relative overflow-hidden rounded-2xl rounded-tl-sm border border-primary/25 bg-gradient-to-br from-violet-500/[0.08] via-violet-500/[0.02] to-transparent p-4">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/[0.06] blur-3xl" />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-foreground/20">
                      <span className="whitespace-nowrap text-[7px] font-bold tracking-[0.08em] text-black">
                        SEPHORA
                      </span>
                    </div>
                    <div>
                      <div className="text-[13.5px] font-semibold text-foreground">Sephora</div>
                      <div className="text-[11px] text-muted-foreground">
                        Prestige beauty retailer · Holiday Beauty drop
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Pitch this
                  </span>
                </div>

                {/* fit bar */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    <span>Fit score</span>
                    <span className="text-foreground">90%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: "90%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, delay: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-foreground/[0.06] bg-foreground/[0.03] px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* rate row */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-foreground/[0.06] bg-background/40 px-3 py-2.5">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Quote range
                    </div>
                    <div className="mt-0.5 text-[13.5px] font-semibold text-foreground">
                      $600 – $900
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      1 Reel + 3 Stories · 30-day usage
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-300/90">
                      I'd ask
                    </span>
                    <span className="text-base font-bold text-foreground">$750</span>
                  </div>
                </div>
              </div>
            </AgentBubble>

            {/* 3. Draft pitch */}
            <AgentBubble delay={0.3} bare>
              <div className="rounded-2xl rounded-tl-sm border border-foreground/[0.07] bg-foreground/[0.03] p-3.5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  <Send className="h-3 w-3" />
                  Draft · written in your voice
                </div>
                <p className="mt-2 text-[12px] font-medium text-foreground">
                  Subject: obsessed with the Holiday Beauty Insider edit
                </p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Hey Sephora team — the new Rare Beauty + Rhode set is everywhere on my FYP this
                  week. I shoot clean-girl makeup tutorials for Gen Z
                  <span className="text-foreground/80"> (15K on IG, 40% US)</span> and would love to
                  put a Reel together for the holiday push…
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button className="flex items-center gap-1 rounded-lg bg-primary hover:bg-primary/90 transition-colors px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]">
                    <Check className="h-3 w-3" /> Approve &amp; send
                  </button>
                  <button className="flex items-center gap-1 rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" /> Tweak
                  </button>
                  <button className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                    Not this one
                  </button>
                </div>
              </div>
            </AgentBubble>

            {/* 4. User approves */}
            <UserBubble delay={0.45}>Approve &amp; send 👍</UserBubble>

            {/* 5. Auto follow-up + negotiation */}
            <AgentBubble delay={0.55} bare>
              <div className="rounded-2xl rounded-tl-sm border border-foreground/[0.07] bg-foreground/[0.03] p-3.5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  <Clock className="h-3 w-3" />4 days later · auto follow-up worked
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                  Sephora replied. They countered <span className="font-semibold">$500</span>. I
                  pushed back to <span className="font-semibold">$750</span> citing your reach + 5%
                  ER. They came back at{" "}
                  <span className="font-semibold text-emerald-300">$700 + product</span>.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <StatPill label="Their open" value="$500" />
                  <StatPill label="My counter" value="$750" tone="violet" />
                  <StatPill label="Landed" value="$700" tone="emerald" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button className="flex items-center gap-1 rounded-lg bg-primary hover:bg-primary/90 transition-colors px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]">
                    <Check className="h-3 w-3" /> Accept $700
                  </button>
                  <button className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                    Hold for $750
                  </button>
                </div>
              </div>
            </AgentBubble>

            {/* 6. Deal closed + external payment tracking */}
            <AgentBubble delay={0.7} bare>
              <div className="rounded-2xl rounded-tl-sm border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent p-3.5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-300/90">
                  <ShieldCheck className="h-3 w-3" />
                  Deal closed · payment tracked
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  <StatPill label="Deal value" value="$700" tone="emerald" />
                  <StatPill label="Delivery" value="Oct 14" />
                  <StatPill label="External status" value="Creator-reported" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Wallet className="h-3 w-3 text-emerald-300" />
                  Creator-brand payment is tracked externally and recorded here for context.
                </div>
              </div>
            </AgentBubble>

            {/* Composer */}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.03] px-3 py-2">
              <input
                readOnly
                placeholder="Ask your agent anything — “find me 5 skincare brands in LA”…"
                className="flex-1 bg-transparent text-[12px] text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <span className="flex items-center gap-1 rounded-md bg-foreground/[0.05] px-1.5 py-0.5 text-[10px] text-muted-foreground/80">
                <CornerDownLeft className="h-2.5 w-2.5" /> send
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer: pipeline stat row */}
      <Reveal className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Matched" value="12 brands" />
        <StatPill label="Sent" value="6 pitches" />
        <StatPill label="Replied" value="3 brands" tone="violet" />
        <StatPill label="Closed today" value="$700" tone="emerald" />
      </Reveal>

      <p className="mx-auto mt-4 max-w-2xl text-center text-[12px] text-muted-foreground">
        You approve the moves. Your agent does the rest — match, pitch, follow-up, negotiate, and
        track external payment status.
      </p>
    </section>
  );
}
