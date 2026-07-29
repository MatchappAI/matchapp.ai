import { motion } from "framer-motion";
import { Target, FileText, Mail, DollarSign } from "lucide-react";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal } from "./Reveal";

type Signal = { label: string; weight?: number };
type Group = {
  icon: typeof Target;
  title: string;
  caption: string;
  signals: Signal[];
};

const GROUPS: Group[] = [
  {
    icon: Target,
    title: "Finding best-fit brands",
    caption:
      "Every brand is ranked using audience fit, category relevance, sponsorship likelihood, deal potential, timing, brand credibility, and relationship strength.",
    signals: [
      { label: "Audience Fit" },
      { label: "Category Relevance" },
      { label: "Sponsorship Likelihood" },
      { label: "Conversion Potential" },
      { label: "Deal Value Potential" },
      { label: "Brand Credibility" },
      { label: "Outreach Timing" },
      { label: "Relationship Path" },
      { label: "Competitive White Space" },
      { label: "Creator Leverage" },
    ],
  },
  {
    icon: FileText,
    title: "Reading your content",
    caption: "What we extract from your last 30 posts.",
    signals: [
      { label: "Top-performing hooks" },
      { label: "Posting cadence & format mix" },
      { label: "Niche & sub-niche tags" },
      { label: "Tone & vocabulary fingerprint" },
      { label: "Audience demo & geo" },
      { label: "Engagement vs. view ratio" },
      { label: "Recent brand mentions" },
      { label: "Watch-time / completion" },
    ],
  },
  {
    icon: Mail,
    title: "Personalizing the email",
    caption: "Every pitch is rebuilt per brand, never templated.",
    signals: [
      { label: "Specific product or campaign" },
      { label: "Recent brand news / launches" },
      { label: "Comparable creators they paid" },
      { label: "Why-you-why-now angle" },
      { label: "Your hook in your voice" },
      { label: "Concrete deliverables + price" },
      { label: "Send-time for their inbox" },
      { label: "Subject line A/B variant" },
    ],
  },
  {
    icon: DollarSign,
    title: "Pricing, packaging & negotiation",
    caption: "How we shape offers to land the biggest deal.",
    signals: [
      { label: "Market rate for your tier & niche" },
      { label: "What this brand paid creators like you" },
      { label: "Bundle: Reel + Stories + Usage rights" },
      { label: "Tiered offer (Good / Better / Best)" },
      { label: "Usage window & exclusivity premium" },
      { label: "Whitelisting & paid-amplification add-on" },
      { label: "Performance bonus / affiliate kicker" },
      { label: "Anchor-high opening number" },
      { label: "Walk-away floor (never go below)" },
      { label: "Counter-offer scripts per objection" },
      { label: "Multi-deliverable & retainer upsell" },
      { label: "Payment terms: 50% upfront, external payment" },
    ],
  },
];

export function PersonalizationSignals({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="signals"
      className={compact ? "relative" : "relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24"}
    >
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <SectionEyebrow>UNDER THE HOOD</SectionEyebrow>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Every signal that goes into your next pitch
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Nothing generic. See exactly what your agent reads about you, scores about each brand,
            and stitches into the email.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g, gi) => (
          <motion.div
            key={g.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: gi * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/40 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]"
          >
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                <g.icon className="h-4 w-4 text-[hsl(230_70%_38%)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                <p className="text-[11px] text-muted-foreground">{g.caption}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5">
              {g.signals.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5 text-[12px] text-foreground/90 transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  <span className="flex items-start gap-2 min-w-0">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[hsl(230_70%_38%)]/80" />
                    <span className="break-words">{s.label}</span>
                  </span>

                  {typeof s.weight === "number" && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[hsl(230_70%_30%)] ring-1 ring-primary/25">
                      {s.weight}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {!compact && (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          You see every signal in your dashboard. Nothing is a black box.
        </p>
      )}
    </section>
  );
}
