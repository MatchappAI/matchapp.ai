import { Sparkles } from "lucide-react";

export function FullScreenLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/30" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary hover:bg-primary/90 transition-colors shadow-[0_0_20px_oklch(0_0_0/0.15)]">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
      </div>
      <p className="mt-6 text-sm font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
