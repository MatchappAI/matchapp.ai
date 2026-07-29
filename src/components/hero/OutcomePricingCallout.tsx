import { Reveal } from "./Reveal";
import { SectionEyebrow } from "./SectionEyebrow";

export function OutcomePricingCallout() {
  return (
    <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-4 pb-2 sm:pt-8">
      <Reveal>
        <div className="glass rounded-2xl border border-border/60 px-6 py-6 sm:px-8 sm:py-7">
          <SectionEyebrow>HOW PRICING WORKS</SectionEyebrow>
          <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Free until there’s a real paid opportunity.
          </h3>
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">
            MatchAI finds the brands, drafts personalized pitches, sends them from our verified domain, and follows up automatically. When a MatchAI-sourced deal is completed and paid, pick a plan — or stay Free and pay a 20% success fee, capped at $99 per deal.
          </p>
          <p className="mt-3 text-[12.5px] font-medium text-foreground/70">
            Free includes unlimited outbound pitching and limited inbound threads. Paid plans unlock unlimited inbound threads. Repeat deals with the same brand are 0% forever.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
