import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import type React from "react";
import { type IconTone } from "@/components/hero/IconTile";
import { SectionEyebrow } from "@/components/hero/SectionEyebrow";

interface HowItWorksProps extends React.HTMLAttributes<HTMLElement> {}

interface StepCardProps {
  tone: IconTone;
  title: string;
  description: string;
  benefits: string[];
  index: number;
}

const toneNumberClasses: Record<IconTone, string> = {
  sky: "border-sky-500/40 text-sky-700 bg-sky-500/10 shadow-[0_0_24px_rgba(56,132,255,0.18)]",
  violet: "border-indigo-500/40 text-indigo-700 bg-indigo-500/10 shadow-[0_0_24px_rgba(99,102,241,0.18)]",
  fuchsia: "border-violet-500/40 text-violet-700 bg-violet-500/10 shadow-[0_0_20px_oklch(0_0_0/0.15)]",
  emerald: "", amber: "", rose: "", indigo: "", cyan: "",
};

const StepCard: React.FC<StepCardProps> = ({ tone, title, description, benefits, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6, delay: index * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
    className="group relative flex h-full flex-col rounded-2xl border border-foreground/[0.07] bg-gradient-to-b from-secondary/60 to-transparent p-7 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-30px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_30px_60px_-25px_rgba(139,92,246,0.5)]"
  >
    <div className="mb-5">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border font-display text-lg font-semibold", toneNumberClasses[tone])}>
        {index + 1}
      </div>
    </div>

    <h3 className="font-display text-[19px] font-semibold tracking-tight text-foreground">
      {title}
    </h3>
    <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
      {description}
    </p>

    <ul className="mt-5 space-y-2.5 border-t border-foreground/5 pt-5">
      {benefits.map((b) => (
        <li key={b} className="flex items-start gap-2.5 text-[13px] text-foreground/80">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40">
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
          <span className="leading-snug">{b}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

const stepsData: Omit<StepCardProps, "index">[] = [
  {
    tone: "sky",
    title: "Paste your social links",
    description:
      "Two minutes. Your agent learns your niche, audience, tone, and which brands fit.",
    benefits: [
      "TikTok, IG, YouTube, LinkedIn, newsletters",
      "Reads your tone and niche automatically",
      "No follower minimum — fit matters more",
    ],
  },
  {
    tone: "violet",
    title: "See who to pitch first",
    description:
      "Real brands that pay creators like you, ranked by fit — with my take (pitch / maybe / skip) and the contact already pulled.",
    benefits: [
      "Local, niche, and national brands",
      "Why each one fits, in one line",
      "No more guessing who to email",
    ],
  },
  {
    tone: "fuchsia",
    title: "Approve. I send.",
    description:
      "Tap approve and the pitch goes out. Get a ping when a brand opens, replies, or goes quiet — one-tap action ready.",
    benefits: [
      "Open / read / reply tracking",
      "One-tap responses when they write back",
      "Reminders so deals don't slip",
    ],
  },
];

export const HowItWorks: React.FC<HowItWorksProps> = ({ className, ...props }) => {
  return (
    <section
      id="how"
      className={cn("relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24 scroll-mt-24", className)}
      {...props}
    >
      <div className="max-w-2xl">
        <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
        <h2 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Set up in 2 minutes.{" "}
          <span className="bg-gradient-to-br from-[#1E1B4B] via-[#4F46E5] to-[#8B5CF6] bg-clip-text text-transparent">
            Your agent runs the rest.
          </span>
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Brands that fit. Pitches that sound like you. Follow-ups that actually happen.
        </p>

        <div className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] via-violet-500/[0.05] to-transparent p-4 backdrop-blur-sm">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l7 16 2-7 7-2z" />
            </svg>
          </span>
          <p className="text-[13.5px] leading-relaxed text-foreground/85">
            <span className="font-semibold text-foreground">Just chat. Watch it work.</span>{" "}
            You'll literally see MatchAI move the cursor, click buttons, open brands, edit your pitch, and send — all from one conversation. No tabs to hunt through, no gaps, no handoffs.
          </p>
        </div>
      </div>



      <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
        {stepsData.map((s, i) => (
          <StepCard key={s.title} {...s} index={i} />
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
