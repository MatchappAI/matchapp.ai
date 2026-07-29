import { cn } from "@/lib/utils";

const TONES = {
  violet: "from-indigo-300 to-violet-400",
  sky: "from-[#cfe0ff] to-[#7BA8FF]",
  emerald: "from-indigo-200 to-indigo-400",
} as const;

export function StatCard({
  value,
  label,
  tone = "violet",
}: {
  value: string;
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="group glass glass-hover relative overflow-hidden rounded-2xl px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)]">
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-70 transition-opacity duration-500 group-hover:opacity-100",
          TONES[tone],
        )}
      />
      <div className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{label}</div>
    </div>

  );
}
