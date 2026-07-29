export function HeroCallout() {
  return (
    <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-2 pb-8">
      <div className="glass rounded-2xl border border-border/60 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <h3 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-foreground sm:min-w-[280px]">
            Free until you want to upgrade MatchAI.
          </h3>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            MatchAI finds brands, drafts personalized pitches, keeps your internal creator inbox
            organized, and follows up. MatchAI subscriptions cover the product; creator-brand
            payment is agreed and handled directly with the brand.
          </p>
        </div>
      </div>
    </section>
  );
}
