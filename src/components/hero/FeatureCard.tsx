export function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative rounded-2xl border border-border/70 bg-card-inner/70 p-4 backdrop-blur transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card-inner">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
