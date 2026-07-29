import { cn } from "@/lib/utils";

export const PROGRESS_STEPS = [
  "prepared",
  "approved",
  "sent",
  "delivered",
  "replied",
  "negotiating",
  "won",
  "paid",
] as const;

export type ProgressStep = (typeof PROGRESS_STEPS)[number];

const LABELS: Record<ProgressStep, string> = {
  prepared: "Prepared",
  approved: "Approved",
  sent: "Sent",
  delivered: "Delivered",
  replied: "Replied",
  negotiating: "Negotiating",
  won: "Won",
  paid: "Paid",
};

export function OpportunityProgress({
  step,
  size = "md",
  showLabels = true,
  className,
}: {
  step: ProgressStep;
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
}) {
  const idx = PROGRESS_STEPS.indexOf(step);
  const pipH = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1">
        {PROGRESS_STEPS.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <div
              key={s}
              className={cn(
                "flex-1 rounded-full transition-colors",
                pipH,
                state === "done" && "bg-primary/80",
                state === "current" && "bg-primary",
                state === "todo" && "bg-muted",
              )}
              aria-label={LABELS[s]}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="truncate">Prepared</span>
          <span className="truncate font-medium text-foreground">
            {LABELS[step]}
          </span>
          <span className="truncate">Paid</span>
        </div>
      )}
    </div>
  );
}
