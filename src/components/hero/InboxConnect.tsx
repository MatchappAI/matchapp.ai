import { motion } from "framer-motion";
import { Check, Inbox, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

/**
 * Honest inbox story: MatchAI sends from its own verified domain and routes brand
 * replies straight back into the workspace. Every send waits for creator approval.
 */


const triageRows = [
  {
    sender: "partnerships@gymshark.com",
    channel: "MatchAI",
    preview: "Loved your last reel — interested in our Q3 capsule?",
    tag: "Draft ready · $1,800 est.",
    tone: "from-emerald-400/80 to-emerald-500/80",
  },
  {
    sender: "brand@aloyoga.com",
    channel: "MatchAI",
    preview: "Gifting + paid collab — deliverables attached.",
    tag: "Awaiting your approval",
    tone: "from-primary/80 to-[oklch(0.55_0.22_295)]/80",
  },
  {
    sender: "creators@hellofresh.com",
    channel: "MatchAI",
    preview: "Affiliate code + $400 flat for one Short. Interested?",
    tag: "Counter @ $750 drafted",
    tone: "from-[#7BA8FF]/80 to-indigo-500/80",
  },
  {
    sender: "hello@brandscout.io",
    channel: "Website form",
    preview: "Pitch deck request — details in the thread.",
    tag: "Lead captured",
    tone: "from-muted-foreground/40 to-muted-foreground/30",
  },
];

export function InboxConnect() {
  return (
    <section
      id="inbox"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_295/0.05),transparent_65%)]" />

      <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <SectionEyebrow>ONE INBOX FOR EVERY BRAND LEAD</SectionEyebrow>
          <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            One inbox. Every brand thread.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          MatchAI sends every pitch from our verified domain and routes brand replies
          straight back into your workspace. No provider to connect, no SMTP setup —
          one thread per deal, drafts and payout tracked together.
        </p>

      </Reveal>


      <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        {/* Left: what's actually wired up */}
        <StaggerGroup className="glass rounded-3xl p-6 sm:p-8">
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background ring-1 ring-foreground/10 overflow-hidden">
              <MatchAILogo variant="mark" size="sm" className="h-5 w-5" ariaLabel="MatchAI" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-semibold text-foreground">MatchAI workspace inbox</div>
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                  Active
                </span>
              </div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                One thread per deal · drafts, counters, and payment status in one place
              </div>
            </div>
          </motion.div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-background ring-1 ring-foreground/10">
                <Inbox className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Sends from our verified domain</div>
                <div className="text-[11.5px] text-muted-foreground">outreach@notify.www.matchapp.ai · shown as "You via MatchAI"</div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              No setup
            </span>

          </div>

          <motion.div
            variants={itemVariants}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background ring-1 ring-foreground/10">
              <Inbox className="h-5 w-5 text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground">Replies stay on-platform</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                Brand replies route back into your MatchAI workspace — never to a personal inbox
              </div>
            </div>
            <span className="rounded-md border border-foreground/10 bg-foreground/[0.03] px-2 py-1 text-[10.5px] font-medium text-muted-foreground">
              Auto-routed
            </span>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background ring-1 ring-foreground/10">
              <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground">Approval queue</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                Every outbound send waits for your one-tap approval
              </div>
            </div>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium text-emerald-300">
              On
            </span>
          </motion.div>


          <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 text-[12px] leading-relaxed text-muted-foreground">
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
            <div>
              <span className="text-foreground font-medium">Reply → Deal → Payout.</span>{" "}
              When a brand replies, the thread becomes a deal — terms, counter offers, and
              protected payout all tracked in your MatchAI workspace.
            </div>
          </div>
        </StaggerGroup>

        {/* Right: triage preview */}
        <Reveal className="glass rounded-3xl p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
              <div className="text-sm font-semibold text-foreground">Inbound brand threads</div>
            </div>
            <span className="rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground ring-1 ring-foreground/10">
              Limited on Free · Unlimited on paid
            </span>
          </div>

          <div className="mt-5 space-y-2.5">
            {triageRows.map((r, i) => (
              <motion.div
                key={r.sender}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3.5"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-foreground/10">
                  <Inbox className="h-4 w-4 text-primary/80" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[12px] font-semibold text-foreground">{r.sender}</div>
                    <div className="text-[10.5px] text-muted-foreground">{r.channel}</div>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{r.preview}</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-medium text-foreground ring-1 ring-foreground/10">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r ${r.tone}`} />
                    {r.tag}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-foreground/10 bg-gradient-to-r from-primary/10 to-transparent p-3.5">
            <div className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
              <div className="text-[12px] text-foreground">
                <span className="font-semibold">3 replies drafted</span>
                <span className="text-muted-foreground"> · waiting on your approval</span>
              </div>
            </div>
            <button className="rounded-lg bg-foreground px-3 py-1.5 text-[11.5px] font-semibold text-background transition-opacity hover:opacity-90">
              Open workspace
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
