import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal, StaggerGroup, itemVariants } from "./Reveal";

const steps = [
  {
    n: "01",
    title: "Set up your profile in 2 minutes",
    body: "Platform, niche, audience, city, rates. Upload a moodboard, portfolio, or press kit — or let AI generate one.",
  },
  {
    n: "02",
    title: "See best-fit brand matches",
    body: "Ranked by fit, sponsorship likelihood, and fastest-to-cash — with the reasoning behind every match.",
  },
  {
    n: "03",
    title: "Approve pitches in your voice",
    body: "Personalized per brand. You approve, tweak, or skip. Approved sending uses your internal MatchAI email once the email API provider is configured.",
  },
  {
    n: "04",
    title: "Reply → negotiate → track",
    body: "Every brand thread lives in one Inbox. Your agent helps with follow-ups and counters; you report payment status after the brand pays you externally.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
      <Reveal className="max-w-2xl">
        <SectionEyebrow>HOW MATCHAI WORKS</SectionEyebrow>
        <h2 className="mt-6 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Four steps from brand match to paid deal.
        </h2>
      </Reveal>

      <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <motion.div
            key={s.n}
            variants={itemVariants}
            className="spotlight glass glass-hover relative rounded-2xl p-6"
          >
            <div className="text-[11px] font-semibold tracking-widest text-primary">{s.n}</div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}
