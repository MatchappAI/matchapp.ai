import { Reveal } from "./Reveal";
import { SectionEyebrow } from "./SectionEyebrow";

export function OutcomePricingCallout() {
  return (
    <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-4 pb-2 sm:pt-8">
      <Reveal>
        <div className="glass rounded-2xl border border-border/60 px-6 py-6 sm:px-8 sm:py-7">
          <SectionEyebrow>HOW PRICING WORKS</SectionEyebrow>
          <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Free until you want to upgrade MatchAI.
          </h3>
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">
            MatchAI finds the brands, drafts personalized pitches, keeps your internal creator inbox
            in one place, and helps you follow up. MatchAI subscriptions are separate from
            creator-brand payments, which happen externally.
          </p>
          <p className="mt-3 text-[12.5px] font-medium text-foreground/70">
            Free includes limited inbound threads for exploration. Paid plans unlock more inbox
            capacity and support. Repeat brand payment terms are handled outside MatchAI.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
